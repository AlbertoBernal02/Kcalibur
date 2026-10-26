-- Comidas guardadas (combinaciones habituales) y recetas (con nº de raciones).
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('meal', 'recipe')),
  servings numeric(6, 2) not null default 1 check (servings > 0),
  created_at timestamptz not null default now()
);

-- Cada elemento guarda una copia de los valores calculados (igual que el diario).
create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null,
  grams numeric(7, 1) not null check (grams > 0),
  serving_g numeric(6, 1) check (serving_g > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(7, 1) not null check (protein_g >= 0),
  carbs_g numeric(7, 1) not null check (carbs_g >= 0),
  fat_g numeric(7, 1) not null check (fat_g >= 0),
  position integer not null default 0
);

create index saved_meal_items_meal_idx on public.saved_meal_items (saved_meal_id);

alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;

create policy "saved_meals_all_own" on public.saved_meals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Los elementos solo pueden colgar de una comida del propio usuario.
create policy "saved_meal_items_all_own" on public.saved_meal_items
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.saved_meals m where m.id = saved_meal_id and m.user_id = auth.uid())
  );
