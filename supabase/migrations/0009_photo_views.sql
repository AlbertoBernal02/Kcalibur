-- Cada foto de progreso pertenece a una vista del cuerpo: frente, lado o espalda.
-- Las fotos que ya existían quedan como "front" (frente) y se pueden borrar y volver a subir.
alter table public.progress_photos
  add column view text not null default 'front' check (view in ('front', 'side', 'back'));

-- Como mucho una foto por vista y día: subir otra del mismo día sustituye a la anterior desde la app.
create index progress_photos_user_date_view_idx on public.progress_photos (user_id, taken_on, view);
