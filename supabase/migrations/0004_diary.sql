-- Entradas del diario. Guardan una copia de los valores nutricionales calculados,
-- así el historial no cambia si luego se edita o borra el alimento.
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(), -- el cliente puede generarlo (modo offline)
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner', 'extras')),
  food_id uuid references public.foods (id) on delete set null,
  name text not null,
  grams numeric(7, 1) not null check (grams > 0),
  serving_g numeric(6, 1) check (serving_g > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(7, 1) not null check (protein_g >= 0),
  carbs_g numeric(7, 1) not null check (carbs_g >= 0),
  fat_g numeric(7, 1) not null check (fat_g >= 0),
  created_at timestamptz not null default now()
);

create index diary_entries_user_date_idx on public.diary_entries (user_id, entry_date);

alter table public.diary_entries enable row level security;
create policy "diary_all_own" on public.diary_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
