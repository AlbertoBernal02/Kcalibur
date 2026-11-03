-- Entreno: rutina importada (programa → días → ejercicios) y registro de cada serie.
-- Todo es del usuario (RLS por user_id) y se borra en cascada al borrar el programa.

create table public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  weeks int not null check (weeks between 1 and 52),
  current_week int not null default 1 check (current_week >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Solo un programa activo por usuario.
create unique index workout_programs_one_active on public.workout_programs (user_id) where active;

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.workout_programs (id) on delete cascade,
  position int not null,
  name text not null check (char_length(name) between 1 and 120),
  weekday smallint check (weekday between 1 and 7) -- 1 = lunes … 7 = domingo; null = sin día fijo
);
create index workout_days_program_idx on public.workout_days (program_id, position);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_id uuid not null references public.workout_days (id) on delete cascade,
  position int not null,
  name text not null check (char_length(name) between 1 and 160),
  notes text not null default '',
  rest_seconds int check (rest_seconds between 0 and 1800),
  video_url text,
  -- {"1": [{"reps": "15 - 20", "rir": "0"}, …], "2": […]}: objetivo de cada serie en cada semana
  plan jsonb not null default '{}'
);
create index workout_exercises_day_idx on public.workout_exercises (day_id, position);

-- Una fila por serie realizada. Que exista la fila = serie hecha.
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  week int not null check (week >= 1),
  set_index int not null check (set_index >= 0),
  weight numeric(7, 2) check (weight >= 0),
  reps numeric(6, 1) check (reps >= 0),
  rir numeric(3, 1) check (rir >= 0),
  note text not null default '', -- texto original del Excel o nota del usuario
  logged_on date not null default current_date,
  updated_at timestamptz not null default now(),
  unique (exercise_id, week, set_index)
);

alter table public.workout_programs enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.set_logs enable row level security;

create policy "workout_programs_all_own" on public.workout_programs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Los hijos solo pueden colgar de filas del propio usuario.
create policy "workout_days_all_own" on public.workout_days
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.workout_programs p where p.id = program_id and p.user_id = auth.uid()));

create policy "workout_exercises_all_own" on public.workout_exercises
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.workout_days d where d.id = day_id and d.user_id = auth.uid()));

create policy "set_logs_all_own" on public.set_logs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.workout_exercises e where e.id = exercise_id and e.user_id = auth.uid()));
