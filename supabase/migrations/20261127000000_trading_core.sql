-- Mocket Maama trading core.
--
-- Virtual tokens only: 1 token buys ₹1 of stock. Tokens are free, and can never
-- be bought, withdrawn, transferred or exchanged for anything of value.
--
-- Every token movement goes through token_ledger, and every order is executed
-- by the security-definer functions below, against prices in public.quotes.
-- The app can read its own rows but cannot write any table directly, so users
-- cannot fake fills or balances. Rules mirror src/lib/portfolio.ts.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Trader',
  created_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  starting_tokens numeric(14, 2) not null default 1000000,
  tokens numeric(14, 2) not null check (tokens >= 0),          -- free to trade
  blocked numeric(14, 2) not null default 0 check (blocked >= 0), -- held for open buy orders
  daily_claimed numeric(14, 2) not null default 0,
  total_charges numeric(14, 2) not null default 0,
  last_daily_claim date,
  reset_at timestamptz not null default now()
);

create table public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null,
  balance_after numeric(14, 2) not null,
  reason text not null check (reason in ('signup_grant', 'reset', 'daily_claim', 'buy', 'sell', 'charges', 'block', 'unblock')),
  order_id uuid,
  created_at timestamptz not null default now()
);
create index on public.token_ledger (user_id, created_at desc);

create table public.instruments (
  symbol text primary key,
  exchange text not null default 'NSE' check (exchange in ('NSE', 'BSE', 'MCX')),
  name text not null,
  segment text not null default 'EQ',
  lot_size int not null default 1 check (lot_size > 0),
  tick_size numeric(10, 2) not null default 0.05,
  active boolean not null default true
);

create table public.quotes (
  symbol text primary key references public.instruments (symbol) on delete cascade,
  ltp numeric(14, 2) not null check (ltp > 0),
  prev_close numeric(14, 2),
  source text not null,
  delayed boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null references public.instruments (symbol),
  side text not null check (side in ('BUY', 'SELL')),
  qty int not null check (qty > 0),
  order_type text not null check (order_type in ('MARKET', 'LIMIT')),
  limit_price numeric(14, 2) check (limit_price > 0),
  status text not null check (status in ('OPEN', 'COMPLETE', 'REJECTED', 'CANCELLED')),
  blocked numeric(14, 2) not null default 0,
  fill_price numeric(14, 2),
  charges numeric(14, 2) not null default 0,
  realized_pnl numeric(14, 2),
  reject_reason text,
  created_at timestamptz not null default now(),
  filled_at timestamptz
);
create index on public.orders (user_id, created_at desc);
create index orders_open_idx on public.orders (symbol) where status = 'OPEN';

create table public.positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null references public.instruments (symbol),
  qty int not null check (qty > 0),
  avg_price numeric(14, 2) not null,
  primary key (user_id, symbol)
);

-- ------------------------------------------------------- row level security
-- Read own rows only. No insert/update/delete policies: all writes go
-- through the functions below.

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.token_ledger enable row level security;
alter table public.instruments enable row level security;
alter table public.quotes enable row level security;
alter table public.orders enable row level security;
alter table public.positions enable row level security;

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "own ledger" on public.token_ledger for select to authenticated using (user_id = auth.uid());
create policy "own orders" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "own positions" on public.positions for select to authenticated using (user_id = auth.uid());
create policy "instruments are public" on public.instruments for select to anon, authenticated using (true);
create policy "quotes are public" on public.quotes for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- helpers

create or replace function public.compute_charges(p_side text, p_value numeric)
returns numeric language sql immutable as $$
  -- Keep in sync with src/lib/charges.ts (NSE equity delivery).
  select round(
      0                                              -- brokerage
    + round(p_value * 0.001, 2)                      -- STT 0.1%
    + round(p_value * 0.0000297, 2)                  -- exchange txn
    + round(p_value * 0.000001, 2)                   -- SEBI
    + case when p_side = 'BUY' then round(p_value * 0.00015, 2) else 0 end  -- stamp duty
    + round((round(p_value * 0.0000297, 2) + round(p_value * 0.000001, 2)) * 0.18, 2)  -- GST
    + case when p_side = 'SELL' and p_value > 0 then 15.34 else 0 end, 2)  -- DP charge
$$;

create or replace function public.buy_cost(p_qty int, p_price numeric)
returns numeric language sql immutable as $$
  select round(p_qty * p_price, 2) + public.compute_charges('BUY', round(p_qty * p_price, 2))
$$;

create or replace function public.ist_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- Moves free tokens and writes the ledger row. Caller holds the wallet lock.
create or replace function public.private_ledger(p_user uuid, p_amount numeric, p_reason text, p_order uuid)
returns void language plpgsql set search_path = public as $$
declare v_bal numeric;
begin
  update wallets set tokens = tokens + p_amount where user_id = p_user returning tokens into v_bal;
  insert into token_ledger (user_id, amount, balance_after, reason, order_id) values (p_user, p_amount, v_bal, p_reason, p_order);
end $$;
revoke all on function public.private_ledger(uuid, numeric, text, uuid) from public, anon, authenticated;

-- Executes an order row at p_price. Caller holds the wallet lock and has validated it.
create or replace function public.execute_fill(p_order public.orders, p_price numeric)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_value numeric := round(p_order.qty * p_price, 2);
  v_charges numeric := public.compute_charges(p_order.side, v_value);
  v_pos public.positions;
  v_pnl numeric;
  v_done public.orders;
begin
  if p_order.blocked > 0 then
    update wallets set blocked = blocked - p_order.blocked where user_id = p_order.user_id;
    perform private_ledger(p_order.user_id, p_order.blocked, 'unblock', p_order.id);
  end if;

  select * into v_pos from positions where user_id = p_order.user_id and symbol = p_order.symbol for update;

  if p_order.side = 'BUY' then
    perform private_ledger(p_order.user_id, -v_value, 'buy', p_order.id);
    insert into positions (user_id, symbol, qty, avg_price)
      values (p_order.user_id, p_order.symbol, p_order.qty, p_price)
      on conflict (user_id, symbol) do update
        set avg_price = round((positions.qty * positions.avg_price + v_value) / (positions.qty + excluded.qty), 2),
            qty = positions.qty + excluded.qty;
  else
    if v_pos is null or v_pos.qty < p_order.qty then
      raise exception 'not enough shares to sell';
    end if;
    v_pnl := round((p_price - v_pos.avg_price) * p_order.qty, 2);
    if v_pos.qty = p_order.qty then
      delete from positions where user_id = p_order.user_id and symbol = p_order.symbol;
    else
      update positions set qty = qty - p_order.qty where user_id = p_order.user_id and symbol = p_order.symbol;
    end if;
    perform private_ledger(p_order.user_id, v_value, 'sell', p_order.id);
  end if;

  perform private_ledger(p_order.user_id, -v_charges, 'charges', p_order.id);
  update wallets set total_charges = total_charges + v_charges where user_id = p_order.user_id;

  update orders set status = 'COMPLETE', blocked = 0, fill_price = p_price, charges = v_charges,
         realized_pnl = v_pnl, filled_at = now()
   where id = p_order.id returning * into v_done;
  return v_done;
end $$;
revoke all on function public.execute_fill(public.orders, numeric) from public, anon, authenticated;

-- ------------------------------------------------------------ account setup

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
    values (new.id, coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Trader'));
  insert into wallets (user_id, starting_tokens, tokens) values (new.id, 1000000, 0);
  perform private_ledger(new.id, 1000000, 'signup_grant', null);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Starts the account over with 1 lakh, 10 lakh or 1 crore tokens.
create or replace function public.reset_account(p_starting_tokens numeric)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_w wallets;
begin
  if v_user is null then raise exception 'sign in first'; end if;
  if p_starting_tokens not in (100000, 1000000, 10000000) then
    raise exception 'starting balance must be 1 lakh, 10 lakh or 1 crore';
  end if;
  select * into v_w from wallets where user_id = v_user for update;
  update orders set status = 'CANCELLED', blocked = 0 where user_id = v_user and status = 'OPEN';
  delete from positions where user_id = v_user;
  -- Keep the ledger's running sum equal to free tokens: release, clear, then grant.
  update wallets set blocked = 0 where user_id = v_user;
  if v_w.blocked > 0 then perform private_ledger(v_user, v_w.blocked, 'unblock', null); end if;
  perform private_ledger(v_user, -(v_w.tokens + v_w.blocked), 'reset', null);
  update wallets set starting_tokens = p_starting_tokens, daily_claimed = 0, total_charges = 0,
         last_daily_claim = null, reset_at = now()
   where user_id = v_user;
  perform private_ledger(v_user, p_starting_tokens, 'reset', null);
  select * into v_w from wallets where user_id = v_user;
  return v_w;
end $$;

-- Free daily top-up: 1% of the starting balance, once per IST calendar day.
create or replace function public.claim_daily_tokens()
returns public.wallets language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_w wallets; v_amt numeric;
begin
  if v_user is null then raise exception 'sign in first'; end if;
  select * into v_w from wallets where user_id = v_user for update;
  if v_w.last_daily_claim = public.ist_today() then
    raise exception 'already claimed today, come back tomorrow';
  end if;
  v_amt := round(v_w.starting_tokens * 0.01, 2);
  update wallets set last_daily_claim = public.ist_today(), daily_claimed = daily_claimed + v_amt where user_id = v_user;
  perform private_ledger(v_user, v_amt, 'daily_claim', null);
  select * into v_w from wallets where user_id = v_user;
  return v_w;
end $$;

-- ------------------------------------------------------------------ orders

create or replace function public.place_order(
  p_symbol text, p_side text, p_qty int, p_order_type text default 'MARKET', p_limit_price numeric default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_w wallets;
  v_q quotes;
  v_held int;
  v_reserved int;
  v_limit numeric := round(p_limit_price, 2);
  v_fills_now boolean;
  v_need numeric;
  v_o orders;
begin
  if v_user is null then raise exception 'sign in first'; end if;
  if p_side not in ('BUY', 'SELL') then raise exception 'side must be BUY or SELL'; end if;
  if p_order_type not in ('MARKET', 'LIMIT') then raise exception 'order type must be MARKET or LIMIT'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'quantity must be at least 1'; end if;
  if p_order_type = 'LIMIT' and (v_limit is null or v_limit <= 0) then raise exception 'enter a limit price above zero'; end if;

  select * into v_w from wallets where user_id = v_user for update;  -- serialises this user's orders
  select * into v_q from quotes where symbol = p_symbol;
  if v_q is null then raise exception 'no price for % yet', p_symbol; end if;

  v_fills_now := p_order_type = 'MARKET'
              or (p_side = 'BUY' and v_q.ltp <= v_limit)
              or (p_side = 'SELL' and v_q.ltp >= v_limit);

  if p_side = 'BUY' then
    v_need := public.buy_cost(p_qty, case when v_fills_now then v_q.ltp else v_limit end);
    if v_need > v_w.tokens then
      raise exception 'not enough tokens: this order needs % but you have % free', v_need, v_w.tokens;
    end if;
  else
    select coalesce(qty, 0) into v_held from positions where user_id = v_user and symbol = p_symbol;
    select coalesce(sum(qty), 0) into v_reserved from orders
      where user_id = v_user and symbol = p_symbol and side = 'SELL' and status = 'OPEN';
    if coalesce(v_held, 0) - v_reserved < p_qty then
      raise exception 'you can sell up to % %', greatest(coalesce(v_held, 0) - v_reserved, 0), p_symbol;
    end if;
  end if;

  insert into orders (user_id, symbol, side, qty, order_type, limit_price, status)
    values (v_user, p_symbol, p_side, p_qty, p_order_type, v_limit, 'OPEN') returning * into v_o;

  if v_fills_now then
    return public.execute_fill(v_o, v_q.ltp);
  end if;

  if p_side = 'BUY' then
    update wallets set blocked = blocked + v_need where user_id = v_user;
    perform private_ledger(v_user, -v_need, 'block', v_o.id);
    update orders set blocked = v_need where id = v_o.id returning * into v_o;
  end if;
  return v_o;
end $$;

create or replace function public.cancel_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_o orders;
begin
  if v_user is null then raise exception 'sign in first'; end if;
  perform 1 from wallets where user_id = v_user for update;
  select * into v_o from orders where id = p_order_id and user_id = v_user for update;
  if v_o is null or v_o.status <> 'OPEN' then raise exception 'order is not open'; end if;
  if v_o.blocked > 0 then
    update wallets set blocked = blocked - v_o.blocked where user_id = v_user;
    perform private_ledger(v_user, v_o.blocked, 'unblock', v_o.id);
  end if;
  update orders set status = 'CANCELLED', blocked = 0 where id = v_o.id returning * into v_o;
  return v_o;
end $$;

-- Fills open limit orders whose price has been reached, at the limit price.
-- Called by the quote sync job after it writes new prices. Not callable by users.
create or replace function public.match_open_orders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_held int;
begin
  for r in
    select o.*, q.ltp from orders o join quotes q using (symbol)
     where o.status = 'OPEN'
       and ((o.side = 'BUY' and q.ltp <= o.limit_price) or (o.side = 'SELL' and q.ltp >= o.limit_price))
     order by o.created_at
  loop
    perform 1 from wallets where user_id = r.user_id for update;
    if (select status from orders where id = r.id) <> 'OPEN' then continue; end if;
    if r.side = 'SELL' then
      select qty into v_held from positions where user_id = r.user_id and symbol = r.symbol;
      if coalesce(v_held, 0) < r.qty then continue; end if;
    end if;
    perform public.execute_fill((select o from orders o where o.id = r.id), r.limit_price);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.match_open_orders() from public, anon, authenticated;
grant execute on function public.match_open_orders() to service_role;

-- ------------------------------------------------------------- leaderboard
-- Ranks by trading return, so 1 lakh and 1 crore accounts compete fairly.
-- Daily claims count as money given, not profit.

create or replace function public.leaderboard(p_limit int default 50)
returns table (rank bigint, display_name text, return_pct numeric, is_me boolean)
language sql stable security definer set search_path = public as $$
  with eq as (
    select w.user_id,
           w.tokens + w.blocked + coalesce(sum(p.qty * coalesce(q.ltp, p.avg_price)), 0) as equity,
           w.starting_tokens + w.daily_claimed as given
      from wallets w
      left join positions p on p.user_id = w.user_id
      left join quotes q on q.symbol = p.symbol
     group by w.user_id
  )
  select rank() over (order by eq.equity / eq.given desc),
         pr.display_name,
         round((eq.equity / eq.given - 1) * 100, 2),
         eq.user_id = auth.uid()
    from eq join profiles pr on pr.id = eq.user_id
   order by 1
   limit least(greatest(p_limit, 1), 200)
$$;

create or replace function public.set_display_name(p_name text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if length(trim(p_name)) not between 2 and 24 then raise exception 'name must be 2 to 24 characters'; end if;
  update profiles set display_name = trim(p_name) where id = auth.uid() returning * into v_p;
  return v_p;
end $$;

-- Only these functions are callable from the app.
revoke all on function public.place_order(text, text, int, text, numeric) from public, anon;
revoke all on function public.cancel_order(uuid) from public, anon;
revoke all on function public.reset_account(numeric) from public, anon;
revoke all on function public.claim_daily_tokens() from public, anon;
revoke all on function public.leaderboard(int) from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.place_order(text, text, int, text, numeric) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.reset_account(numeric) to authenticated;
grant execute on function public.claim_daily_tokens() to authenticated;
grant execute on function public.leaderboard(int) to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Live updates for the app.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.quotes, public.orders, public.wallets, public.positions;
  end if;
end $$;
