-- Seguimiento: peso diario, agua diaria y totales por día para estadísticas.

-- Un peso por día (se sobrescribe al volver a registrarlo).
create table public.weight_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 300),
  primary key (user_id, log_date)
);
alter table public.weight_logs enable row level security;
create policy "weight_all_own" on public.weight_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Agua: total de ml por día.
create table public.water_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  ml integer not null default 0 check (ml between 0 and 20000),
  primary key (user_id, log_date)
);
alter table public.water_logs enable row level security;
create policy "water_all_own" on public.water_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Objetivo diario de agua.
alter table public.profiles
  add column water_goal_ml integer not null default 2000 check (water_goal_ml between 500 and 10000);

-- Totales por día de un rango (agregado en servidor: evita el límite de 1000 filas de la API).
-- security invoker (por defecto): se aplica RLS del usuario que llama.
create function public.daily_totals(from_date date, to_date date)
returns table (entry_date date, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric)
language sql stable
as $$
  select e.entry_date, sum(e.kcal), sum(e.protein_g), sum(e.carbs_g), sum(e.fat_g)
  from public.diary_entries e
  where e.user_id = auth.uid() and e.entry_date between from_date and to_date
  group by e.entry_date
  order by e.entry_date
$$;
