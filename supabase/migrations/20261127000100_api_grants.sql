-- Newer Supabase projects don't expose new tables to the API roles by
-- default, so grant exactly what the app needs: read-only access. Row-level
-- security (previous migration) still limits each user to their own rows, and
-- all writes go through the security-definer functions.
grant usage on schema public to anon, authenticated;
grant select on public.instruments, public.quotes to anon, authenticated;
grant select on public.profiles, public.wallets, public.token_ledger, public.orders, public.positions to authenticated;
