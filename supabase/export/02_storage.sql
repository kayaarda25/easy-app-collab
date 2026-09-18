-- flatch: Dateiablagen (Storage Buckets) + Zugriffsregeln
-- Auf dem NEUEN Supabase-Projekt im SQL Editor ausfuehren, NACH 01_schema.sql

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', false),
  ('chat-attachments', 'chat-attachments', false),
  ('property-images', 'property-images', false),
  ('recommendation-media', 'recommendation-media', false)
on conflict (id) do nothing;

-- avatars
create policy "Authenticated read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- property-images
create policy "Authenticated read property images"
  on storage.objects for select to authenticated
  using (bucket_id = 'property-images');
create policy "Users upload own property images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own property images"
  on storage.objects for update to authenticated
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own property images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- chat-attachments
create policy "Users read own chat attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users upload own chat attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- recommendation-media
create policy "Users can read recommendation media"
  on storage.objects for select to authenticated
  using (bucket_id = 'recommendation-media');
create policy "Users can upload recommendation media to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recommendation-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own recommendation media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recommendation-media' and (storage.foldername(name))[1] = auth.uid()::text);
