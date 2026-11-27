-- Keeps public.quotes fresh from inside the database, with no service keys:
-- pg_cron runs sync_quotes() every minute; it reads the responses that pg_net
-- fetched on the previous run, writes quotes, fills limit orders, and sends
-- the next round of requests.
--
-- PROTOTYPE FEED: Yahoo Finance (unofficial, ~15 min delayed, personal use
-- only). Before a public launch, point quote_url() and parse_quote() at a
-- licensed delayed feed. Nothing else changes.

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then create extension if not exists pg_net; end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then create extension if not exists pg_cron; end if;
end $$;

create table if not exists public.quote_requests (
  request_id bigint primary key,
  symbol text not null references public.instruments (symbol) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.quote_requests enable row level security;  -- no policies, no grants: internal only

create or replace function public.quote_url(p_symbol text, p_exchange text)
returns text language sql immutable as $$
  select 'https://query1.finance.yahoo.com/v8/finance/chart/'
         || p_symbol || case p_exchange when 'BSE' then '.BO' else '.NS' end
         || '?interval=1d&range=5d'
$$;

-- Returns (ltp, prev_close) from a feed response body, or nulls if unusable.
create or replace function public.parse_quote(p_body text, out ltp numeric, out prev_close numeric)
language plpgsql immutable as $$
declare m jsonb;
begin
  m := (p_body::jsonb) #> '{chart,result,0,meta}';
  ltp := round((m ->> 'regularMarketPrice')::numeric, 2);
  prev_close := round(coalesce(m ->> 'chartPreviousClose', m ->> 'previousClose')::numeric, 2);
  if ltp is null or ltp <= 0 then ltp := null; end if;
exception when others then
  ltp := null; prev_close := null;
end $$;

create or replace function public.sync_quotes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_q record; v_updated int := 0; v_sent int := 0; v_filled int;
begin
  -- 1. read responses to earlier requests
  for r in
    select qr.request_id, qr.symbol, resp.status_code, resp.content
      from quote_requests qr join net._http_response resp on resp.id = qr.request_id
  loop
    if r.status_code = 200 then
      select * into v_q from parse_quote(r.content);
      if v_q.ltp is not null then
        insert into quotes (symbol, ltp, prev_close, source, delayed, updated_at)
          values (r.symbol, v_q.ltp, v_q.prev_close, 'Yahoo Finance (delayed, prototype)', true, now())
          on conflict (symbol) do update
            set ltp = excluded.ltp, prev_close = excluded.prev_close, source = excluded.source, updated_at = excluded.updated_at;
        v_updated := v_updated + 1;
      end if;
    end if;
    delete from quote_requests where request_id = r.request_id;
  end loop;
  delete from quote_requests where created_at < now() - interval '10 minutes';  -- lost or timed out

  -- 2. fill limit orders against the new prices
  v_filled := match_open_orders();

  -- 3. ask for fresh prices
  insert into quote_requests (request_id, symbol)
    select net.http_get(url := quote_url(i.symbol, i.exchange),
                        headers := '{"User-Agent": "Mozilla/5.0 (compatible; MocketMaama/0.2)"}'::jsonb,
                        timeout_milliseconds := 8000),
           i.symbol
      from instruments i
     where i.active and i.exchange in ('NSE', 'BSE');
  get diagnostics v_sent = row_count;

  return jsonb_build_object('updated', v_updated, 'filled', v_filled, 'requested', v_sent);
end $$;
revoke all on function public.sync_quotes() from public, anon, authenticated;
revoke all on function public.parse_quote(text) from anon;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mocket-maama-sync-quotes', '* * * * *', 'select public.sync_quotes()');
  end if;
end $$;
