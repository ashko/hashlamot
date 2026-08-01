-- השלמות — photo storage
--
-- Two kinds of photo, both taken on their own phones: Mom shooting the product
-- where the brand is what matters, and Dad shooting what he actually took off
-- the shelf when he had to substitute.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Public read: the URLs are unguessable and the service worker caches them, so
-- the list still shows pictures with no signal in the shop.
drop policy if exists "photos are readable" on storage.objects;
create policy "photos are readable" on storage.objects
  for select using (bucket_id = 'photos');

-- Writes are limited to signed-in members, and each file must land under their
-- own household's folder.
drop policy if exists "members upload photos" on storage.objects;
create policy "members upload photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

drop policy if exists "members replace photos" on storage.objects;
create policy "members replace photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

drop policy if exists "members delete photos" on storage.objects;
create policy "members delete photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );
