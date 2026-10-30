-- Security migration applied to the Supabase TEST project on 2026-10-30.
-- Moves the role lookup helper out of the exposed public schema so it cannot
-- be invoked as a public Data API RPC endpoint.
--
-- SECURITY DEFINER is retained intentionally: the helper reads public.profiles,
-- whose RLS policies also use this helper. The fixed empty search_path and
-- schema qualification prevent search_path-based object substitution.

create schema if not exists private authorization postgres;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
  limit 1;
$function$;

revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

-- Preserve the existing role rules while using the private helper.
drop policy if exists "Superadmins can view activity logs" on public.activity_logs;
create policy "Superadmins can view activity logs"
on public.activity_logs
for select
to authenticated
using ((select private.current_user_role()) = 'superadmin');

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders"
on public.orders
for all
to authenticated
using ((select private.current_user_role()) = any (array['admin','superadmin']))
with check ((select private.current_user_role()) = any (array['admin','superadmin']));

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
on public.products
for all
to authenticated
using ((select private.current_user_role()) = any (array['admin','superadmin']))
with check ((select private.current_user_role()) = any (array['admin','superadmin']));

drop policy if exists "Superadmins can manage profiles" on public.profiles;
create policy "Superadmins can manage profiles"
on public.profiles
for all
to authenticated
using ((select private.current_user_role()) = 'superadmin')
with check ((select private.current_user_role()) = 'superadmin');

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (select private.current_user_role()) = any (array['admin','superadmin'])
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (select private.current_user_role()) = any (array['admin','superadmin'])
)
with check (
  bucket_id = 'product-images'
  and (select private.current_user_role()) = any (array['admin','superadmin'])
);

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select private.current_user_role()) = any (array['admin','superadmin'])
);

-- Remove the old exposed RPC only after all policies use the private helper.
drop function if exists public.current_user_role();
