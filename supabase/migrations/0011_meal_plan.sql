-- Plan semanal: qué opción de dieta o comida guardada toca en cada comida de cada día.
-- Solo se guarda la referencia: si luego se edita la opción, el plan y la lista de la compra se actualizan solos.
create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner', 'extras')),
  option_id uuid not null references public.saved_meals (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, plan_date, meal)
);

create index meal_plan_user_date_idx on public.meal_plan (user_id, plan_date);

alter table public.meal_plan enable row level security;

-- Solo sobre filas propias y apuntando a comidas/opciones del propio usuario.
create policy "meal_plan_all_own" on public.meal_plan
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.saved_meals m where m.id = option_id and m.user_id = auth.uid())
  );
