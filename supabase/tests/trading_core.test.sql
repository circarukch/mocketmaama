-- Run with: supabase/tests/run.sh
\set ON_ERROR_STOP 1
-- Supabase grants table privileges to these roles by default; RLS is what protects the data.
grant all on all tables in schema public to anon, authenticated;

insert into public.quotes (symbol, ltp, prev_close, source) values ('INFY', 1500, 1490, 'test'), ('SBIN', 800, 790, 'test');
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'asha@example.com'),
                                          ('22222222-2222-2222-2222-222222222222', 'ravi@example.com');

create function pg_temp.check(cond boolean, what text) returns void language plpgsql as $$
begin if not cond then raise exception 'FAILED: %', what; end if; raise notice 'ok - %', what; end $$;
create function pg_temp.fails(sql text, what text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'ok - % (%)', what, sqlerrm; return; end;
  raise exception 'FAILED: % should have been rejected', what;
end $$;

select pg_temp.check((select tokens from wallets where user_id = '11111111-1111-1111-1111-111111111111') = 1000000, 'sign-up grants 10 lakh tokens');
select pg_temp.check((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111') = 'asha', 'profile uses email name');
select pg_temp.check(public.compute_charges('BUY', 100000) = 118.62, 'buy charges match the app');
select pg_temp.check(public.compute_charges('SELL', 100000) = 118.96, 'sell charges match the app');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- users cannot write tables directly
update wallets set tokens = 99999999;
select pg_temp.check((select tokens from wallets) = 1000000, 'direct wallet update changes nothing');
select pg_temp.fails($$insert into positions values ('11111111-1111-1111-1111-111111111111', 'INFY', 1000, 1)$$, 'direct position insert');
select pg_temp.fails($$select public.match_open_orders()$$, 'user calling the matcher');
select pg_temp.fails($$select public.private_ledger('11111111-1111-1111-1111-111111111111', 1e9, 'sell', null)$$, 'user calling the ledger');

-- market buy
select (public.place_order('INFY', 'BUY', 10, 'MARKET')).status as s \gset
select pg_temp.check(:'s' = 'COMPLETE', 'market buy fills');
select pg_temp.check((select tokens from wallets) = 1000000 - 15000 - public.compute_charges('BUY', 15000), 'buy deducts value and charges');
select pg_temp.check((select qty from positions where symbol = 'INFY') = 10, 'position opened');

-- buy limit below market waits and blocks tokens
select (public.place_order('SBIN', 'BUY', 10, 'LIMIT', 780)).id as lim \gset
select pg_temp.check((select status from orders where id = :'lim') = 'OPEN', 'limit below market stays open');
select pg_temp.check((select blocked from wallets) = public.buy_cost(10, 780), 'limit blocks tokens');

-- other users see nothing of this
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select count(*) from orders) = 0, 'RLS hides other users orders');
select pg_temp.check((select count(*) from wallets) = 1, 'RLS shows only own wallet');
select pg_temp.fails($$select public.cancel_order('$$ || :'lim' || $$')$$, 'cancelling someone else''s order');
select pg_temp.fails($$select public.place_order('INFY', 'SELL', 1)$$, 'selling shares you do not hold');
select pg_temp.fails($$select public.place_order('INFY', 'BUY', 1000)$$, 'buying beyond your tokens');
select pg_temp.fails($$select public.reset_account(5000000)$$, 'reset to a non-standard balance');

-- the quote job moves SBIN through the limit
reset role;
update quotes set ltp = 779 where symbol = 'SBIN';
select pg_temp.check(public.match_open_orders() = 1, 'matcher fills one order');
select pg_temp.check((select fill_price from orders where id = :'lim') = 780, 'fills at the limit price');
select pg_temp.check((select blocked from wallets where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'blocked tokens released');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- open sell reserves shares
select (public.place_order('INFY', 'SELL', 8, 'LIMIT', 1700)).status as s \gset
select pg_temp.check(:'s' = 'OPEN', 'sell limit above market stays open');
select pg_temp.fails($$select public.place_order('INFY', 'SELL', 5)$$, 'selling shares reserved by an open sell');

-- market sell books P&L
reset role;
update quotes set ltp = 1600 where symbol = 'INFY';
set role authenticated;
select (public.place_order('INFY', 'SELL', 2)).realized_pnl as pnl \gset
select pg_temp.check(:pnl = 200, 'sell books gross P&L');

-- daily claim once per day
select (public.claim_daily_tokens()).daily_claimed as dc \gset
select pg_temp.check(:dc = 10000, 'daily claim pays 1% of start');
select pg_temp.fails($$select public.claim_daily_tokens()$$, 'second claim the same day');

-- ledger always explains the balance
select pg_temp.check((select sum(amount) from token_ledger) = (select tokens from wallets), 'ledger sums to free tokens');

select pg_temp.check((select bool_or(is_me) from public.leaderboard()), 'leaderboard marks me');

-- reset to 1 crore
select (public.reset_account(10000000)).tokens as t \gset
select pg_temp.check(:t = 10000000, 'reset gives the chosen balance');
select pg_temp.check((select count(*) from positions) = 0, 'reset clears positions');
select pg_temp.check((select count(*) from orders where status = 'OPEN') = 0, 'reset cancels open orders');
select pg_temp.check((select sum(amount) from token_ledger) = 10000000, 'ledger still sums to free tokens after reset');
reset role;
\echo ALL TESTS PASSED
