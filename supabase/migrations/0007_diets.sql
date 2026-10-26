-- Dietas: cada dieta tiene, por cada comida del día, varias opciones.
-- Una opción es una comida guardada (saved_meals) vinculada a la dieta y a una comida.
create table public.diets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.diets enable row level security;
create policy "diets_all_own" on public.diets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.saved_meals
  add column diet_id uuid references public.diets (id) on delete cascade,
  add column diet_meal text check (diet_meal in ('breakfast', 'lunch', 'snack', 'dinner', 'extras')),
  -- O es una comida suelta (ambos nulos) o es una opción de dieta (ambos presentes).
  add constraint diet_option_slot check ((diet_id is null) = (diet_meal is null));

-- Una opción solo puede colgar de una dieta del propio usuario.
drop policy "saved_meals_all_own" on public.saved_meals;
create policy "saved_meals_all_own" on public.saved_meals
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (diet_id is null or exists (select 1 from public.diets d where d.id = diet_id and d.user_id = auth.uid()))
  );
