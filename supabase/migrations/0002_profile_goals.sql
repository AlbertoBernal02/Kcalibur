-- Datos corporales para el cálculo del gasto calórico (TDEE).
alter table public.profiles
  add column sex text check (sex in ('male', 'female')),
  add column birth_date date,
  add column height_cm numeric(5, 1) check (height_cm between 100 and 250),
  add column weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  add column activity text check (activity in ('sedentary', 'light', 'moderate', 'high', 'extreme')),
  add column goal text check (goal in ('lose', 'maintain', 'gain'));

-- Objetivos diarios (una fila por usuario).
create table public.goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kcal integer not null check (kcal between 500 and 10000),
  protein_g integer not null check (protein_g >= 0),
  carbs_g integer not null check (carbs_g >= 0),
  fat_g integer not null check (fat_g >= 0),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
