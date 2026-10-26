-- Fotos de progreso: ficheros en un bucket privado de Storage + una fila por foto.
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  taken_on date not null,
  path text not null unique, -- ruta en el bucket: "<user_id>/<uuid>.jpg"
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index progress_photos_user_date_idx on public.progress_photos (user_id, taken_on);

alter table public.progress_photos enable row level security;
create policy "photos_all_own" on public.progress_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bucket privado (nunca público), solo imágenes y máx. 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Cada usuario solo puede leer/escribir/borrar dentro de su carpeta ("<user_id>/...").
create policy "progress_photos_storage_own" on storage.objects
  for all
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
