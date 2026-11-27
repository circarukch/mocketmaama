-- Minimal stand-in for the parts of Supabase the migrations rely on, so they
-- can be tested on plain Postgres. Not used in a real Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- pg_net stand-in: requests are recorded; tests write responses themselves.
create schema if not exists net;
create sequence if not exists net.req_seq;
create table if not exists net._http_response (id bigint primary key, status_code int, content text, created timestamptz default now());
create table if not exists net.sent (id bigint primary key, url text);
create or replace function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$
declare v bigint := nextval('net.req_seq');
begin insert into net.sent values (v, url); return v; end $$;
