-- Alimentos: genéricos (user_id null, visibles para todos) y propios (user_id = dueño).
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text,
  barcode text,
  category text not null default 'otros' check (category in (
    'carne', 'pescado', 'huevos', 'cereales', 'tuberculos', 'legumbres',
    'fruta', 'verdura', 'lacteos', 'grasas', 'frutos_secos', 'otros')),
  state text check (state in ('raw', 'cooked')),
  kcal_100g numeric(6, 1) not null check (kcal_100g between 0 and 950),
  protein_100g numeric(5, 1) not null check (protein_100g between 0 and 100),
  carbs_100g numeric(5, 1) not null check (carbs_100g between 0 and 100),
  fat_100g numeric(5, 1) not null check (fat_100g between 0 and 100),
  serving_g numeric(6, 1) check (serving_g > 0),
  source text not null default 'custom' check (source in ('generic', 'custom', 'off')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index foods_user_idx on public.foods (user_id);
create unique index foods_user_barcode_idx on public.foods (user_id, barcode) where barcode is not null;

alter table public.foods enable row level security;

create policy "foods_select" on public.foods for select using (user_id is null or user_id = auth.uid());
create policy "foods_insert_own" on public.foods for insert with check (user_id = auth.uid());
create policy "foods_update_own" on public.foods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "foods_delete_own" on public.foods for delete using (user_id = auth.uid());

create trigger foods_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

-- Favoritos.
create table public.food_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);
alter table public.food_favorites enable row level security;
create policy "fav_all_own" on public.food_favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Recientes: última vez que se usó cada alimento (lo actualiza el diario).
create table public.food_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  last_used_at timestamptz not null default now(),
  primary key (user_id, food_id)
);
alter table public.food_usage enable row level security;
create policy "usage_all_own" on public.food_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Precarga de genéricos (valores aproximados por 100 g, basados en USDA/BEDCA).
insert into public.foods (name, category, state, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g, source) values
-- Carnes
('Pechuga de pollo', 'carne', 'raw', 110, 23, 0, 1.2, null, 'generic'),
('Pechuga de pollo', 'carne', 'cooked', 165, 31, 0, 3.6, null, 'generic'),
('Muslo de pollo sin piel', 'carne', 'raw', 121, 20, 0, 4.5, null, 'generic'),
('Muslo de pollo sin piel', 'carne', 'cooked', 175, 26, 0, 7.5, null, 'generic'),
('Pechuga de pavo', 'carne', 'raw', 107, 23.6, 0, 1.2, null, 'generic'),
('Pechuga de pavo', 'carne', 'cooked', 157, 29, 0, 3.2, null, 'generic'),
('Ternera magra (filete)', 'carne', 'raw', 120, 21, 0, 4, null, 'generic'),
('Ternera magra (filete)', 'carne', 'cooked', 190, 30, 0, 7, null, 'generic'),
('Carne picada de ternera', 'carne', 'raw', 215, 18, 0, 15, null, 'generic'),
('Carne picada de ternera', 'carne', 'cooked', 250, 26, 0, 15, null, 'generic'),
('Lomo de cerdo', 'carne', 'raw', 143, 21, 0, 6, null, 'generic'),
('Lomo de cerdo', 'carne', 'cooked', 200, 29, 0, 9, null, 'generic'),
('Jamón serrano', 'carne', null, 241, 31, 0, 13, 15, 'generic'),
('Jamón cocido', 'carne', null, 110, 18, 1, 3.5, 15, 'generic'),
('Chorizo', 'carne', null, 455, 24, 2, 38, 20, 'generic'),
('Bacon', 'carne', null, 417, 14, 1.4, 40, 10, 'generic'),
-- Pescados y mariscos
('Salmón', 'pescado', 'raw', 208, 20, 0, 13, null, 'generic'),
('Salmón', 'pescado', 'cooked', 232, 25, 0, 14, null, 'generic'),
('Merluza', 'pescado', 'raw', 82, 17, 0, 1.5, null, 'generic'),
('Merluza', 'pescado', 'cooked', 100, 21, 0, 1.8, null, 'generic'),
('Bacalao fresco', 'pescado', 'raw', 82, 18, 0, 0.7, null, 'generic'),
('Bacalao fresco', 'pescado', 'cooked', 105, 23, 0, 0.9, null, 'generic'),
('Atún fresco', 'pescado', 'raw', 144, 23, 0, 5, null, 'generic'),
('Atún en conserva al natural', 'pescado', null, 116, 26, 0, 1, 52, 'generic'),
('Atún en conserva en aceite (escurrido)', 'pescado', null, 198, 26, 0, 10, 52, 'generic'),
('Gambas', 'pescado', 'raw', 85, 18, 1, 1, null, 'generic'),
('Gambas', 'pescado', 'cooked', 99, 24, 0.2, 0.3, null, 'generic'),
('Sardinas en lata', 'pescado', null, 208, 25, 0, 11, null, 'generic'),
('Lubina', 'pescado', 'raw', 97, 18, 0, 2.5, null, 'generic'),
('Dorada', 'pescado', 'raw', 96, 19, 0, 2, null, 'generic'),
('Calamar', 'pescado', 'raw', 92, 16, 3, 1.4, null, 'generic'),
('Mejillones', 'pescado', 'cooked', 172, 24, 7, 4.5, null, 'generic'),
-- Huevos
('Huevo entero', 'huevos', 'raw', 143, 12.6, 0.7, 9.5, 55, 'generic'),
('Huevo cocido', 'huevos', 'cooked', 155, 13, 1.1, 11, 50, 'generic'),
('Clara de huevo', 'huevos', 'raw', 52, 11, 0.7, 0.2, 33, 'generic'),
('Yema de huevo', 'huevos', 'raw', 322, 16, 3.6, 27, 17, 'generic'),
-- Cereales, arroz, pasta y pan
('Arroz blanco', 'cereales', 'raw', 360, 7, 79, 0.6, null, 'generic'),
('Arroz blanco', 'cereales', 'cooked', 130, 2.7, 28, 0.3, null, 'generic'),
('Arroz integral', 'cereales', 'raw', 362, 7.5, 76, 2.7, null, 'generic'),
('Arroz integral', 'cereales', 'cooked', 123, 2.7, 25.6, 1, null, 'generic'),
('Pasta', 'cereales', 'raw', 355, 12.5, 72, 1.5, null, 'generic'),
('Pasta', 'cereales', 'cooked', 158, 5.8, 31, 0.9, null, 'generic'),
('Pasta integral', 'cereales', 'raw', 340, 13, 64, 2.5, null, 'generic'),
('Pasta integral', 'cereales', 'cooked', 150, 6, 29, 1, null, 'generic'),
('Cuscús', 'cereales', 'raw', 360, 12.8, 72.4, 1.6, null, 'generic'),
('Cuscús', 'cereales', 'cooked', 112, 3.8, 23, 0.2, null, 'generic'),
('Quinoa', 'cereales', 'raw', 368, 14, 64, 6, null, 'generic'),
('Quinoa', 'cereales', 'cooked', 120, 4.4, 21, 1.9, null, 'generic'),
('Copos de avena', 'cereales', null, 372, 13, 60, 7, 40, 'generic'),
('Pan blanco (barra)', 'cereales', null, 265, 9, 50, 3, 30, 'generic'),
('Pan integral', 'cereales', null, 247, 13, 41, 3.4, 30, 'generic'),
('Pan de molde', 'cereales', null, 265, 8, 49, 3.5, 25, 'generic'),
('Cereales de desayuno (corn flakes)', 'cereales', null, 378, 7, 84, 0.9, 30, 'generic'),
('Galletas María', 'cereales', null, 440, 7, 75, 12, 6, 'generic'),
-- Patata y boniato
('Patata', 'tuberculos', 'raw', 77, 2, 17, 0.1, null, 'generic'),
('Patata', 'tuberculos', 'cooked', 86, 1.9, 20, 0.1, null, 'generic'),
('Boniato', 'tuberculos', 'raw', 86, 1.6, 20, 0.1, null, 'generic'),
('Boniato', 'tuberculos', 'cooked', 90, 2, 21, 0.2, null, 'generic'),
('Patatas fritas de bolsa', 'tuberculos', null, 536, 7, 53, 34, 30, 'generic'),
-- Legumbres
('Lentejas', 'legumbres', 'raw', 353, 25, 60, 1.1, null, 'generic'),
('Lentejas', 'legumbres', 'cooked', 116, 9, 20, 0.4, null, 'generic'),
('Garbanzos', 'legumbres', 'raw', 364, 19, 61, 6, null, 'generic'),
('Garbanzos', 'legumbres', 'cooked', 164, 8.9, 27.4, 2.6, null, 'generic'),
('Alubias blancas', 'legumbres', 'raw', 333, 23, 60, 0.9, null, 'generic'),
('Alubias blancas', 'legumbres', 'cooked', 139, 9.7, 25, 0.5, null, 'generic'),
('Tofu', 'legumbres', null, 76, 8, 1.9, 4.8, null, 'generic'),
-- Frutas
('Manzana', 'fruta', null, 52, 0.3, 14, 0.2, 180, 'generic'),
('Plátano', 'fruta', null, 89, 1.1, 23, 0.3, 100, 'generic'),
('Naranja', 'fruta', null, 47, 0.9, 12, 0.1, 180, 'generic'),
('Mandarina', 'fruta', null, 53, 0.8, 13, 0.3, 80, 'generic'),
('Pera', 'fruta', null, 57, 0.4, 15, 0.1, 170, 'generic'),
('Fresas', 'fruta', null, 32, 0.7, 7.7, 0.3, null, 'generic'),
('Uvas', 'fruta', null, 69, 0.7, 18, 0.2, null, 'generic'),
('Sandía', 'fruta', null, 30, 0.6, 7.6, 0.2, null, 'generic'),
('Melón', 'fruta', null, 34, 0.8, 8.2, 0.2, null, 'generic'),
('Kiwi', 'fruta', null, 61, 1.1, 15, 0.5, 75, 'generic'),
('Piña', 'fruta', null, 50, 0.5, 13, 0.1, null, 'generic'),
('Melocotón', 'fruta', null, 39, 0.9, 9.5, 0.3, 150, 'generic'),
('Aguacate', 'fruta', null, 160, 2, 8.5, 14.7, 100, 'generic'),
('Arándanos', 'fruta', null, 57, 0.7, 14, 0.3, null, 'generic'),
('Cerezas', 'fruta', null, 63, 1, 16, 0.2, null, 'generic'),
-- Verduras y hortalizas
('Tomate', 'verdura', null, 18, 0.9, 3.9, 0.2, 120, 'generic'),
('Lechuga', 'verdura', null, 15, 1.4, 2.9, 0.2, null, 'generic'),
('Zanahoria', 'verdura', null, 41, 0.9, 10, 0.2, 80, 'generic'),
('Cebolla', 'verdura', null, 40, 1.1, 9.3, 0.1, null, 'generic'),
('Pimiento rojo', 'verdura', null, 31, 1, 6, 0.3, null, 'generic'),
('Pimiento verde', 'verdura', null, 20, 0.9, 4.6, 0.2, null, 'generic'),
('Pepino', 'verdura', null, 15, 0.7, 3.6, 0.1, null, 'generic'),
('Calabacín', 'verdura', null, 17, 1.2, 3.1, 0.3, null, 'generic'),
('Berenjena', 'verdura', null, 25, 1, 5.9, 0.2, null, 'generic'),
('Brócoli', 'verdura', 'raw', 34, 2.8, 7, 0.4, null, 'generic'),
('Brócoli', 'verdura', 'cooked', 35, 2.4, 7.2, 0.4, null, 'generic'),
('Espinacas', 'verdura', 'raw', 23, 2.9, 3.6, 0.4, null, 'generic'),
('Espinacas', 'verdura', 'cooked', 23, 3, 3.8, 0.3, null, 'generic'),
('Judías verdes', 'verdura', 'raw', 31, 1.8, 7, 0.2, null, 'generic'),
('Judías verdes', 'verdura', 'cooked', 35, 1.9, 7.9, 0.3, null, 'generic'),
('Coliflor', 'verdura', null, 25, 1.9, 5, 0.3, null, 'generic'),
('Champiñones', 'verdura', null, 22, 3.1, 3.3, 0.3, null, 'generic'),
('Ajo', 'verdura', null, 149, 6.4, 33, 0.5, 3, 'generic'),
('Maíz dulce (lata)', 'verdura', null, 86, 3.2, 19, 1.2, null, 'generic'),
('Espárragos', 'verdura', null, 20, 2.2, 3.9, 0.1, null, 'generic'),
('Calabaza', 'verdura', null, 26, 1, 6.5, 0.1, null, 'generic'),
-- Lácteos
('Leche entera', 'lacteos', null, 61, 3.2, 4.8, 3.3, 200, 'generic'),
('Leche semidesnatada', 'lacteos', null, 46, 3.3, 4.8, 1.6, 200, 'generic'),
('Leche desnatada', 'lacteos', null, 35, 3.4, 5, 0.1, 200, 'generic'),
('Yogur natural', 'lacteos', null, 61, 3.5, 4.7, 3.3, 125, 'generic'),
('Yogur natural desnatado', 'lacteos', null, 40, 4.2, 5.5, 0.2, 125, 'generic'),
('Yogur griego natural', 'lacteos', null, 97, 9, 3.9, 5, 125, 'generic'),
('Queso fresco batido 0%', 'lacteos', null, 46, 8, 3.5, 0.2, 125, 'generic'),
('Queso fresco (tipo Burgos)', 'lacteos', null, 174, 12, 3, 13, 30, 'generic'),
('Queso mozzarella', 'lacteos', null, 280, 22, 2.2, 22, 30, 'generic'),
('Queso curado (manchego)', 'lacteos', null, 392, 27, 0.5, 31, 30, 'generic'),
('Requesón / cottage', 'lacteos', null, 98, 11, 3.4, 4.3, null, 'generic'),
('Mantequilla', 'lacteos', null, 717, 0.9, 0.1, 81, 10, 'generic'),
('Nata líquida (35 %)', 'lacteos', null, 340, 2.1, 3, 36, 15, 'generic'),
('Proteína whey (suero)', 'lacteos', null, 380, 78, 6, 5, 30, 'generic'),
-- Aceites y grasas
('Aceite de oliva virgen extra', 'grasas', null, 884, 0, 0, 100, 10, 'generic'),
('Aceite de girasol', 'grasas', null, 884, 0, 0, 100, 10, 'generic'),
('Mayonesa', 'grasas', null, 680, 1, 0.6, 75, 15, 'generic'),
('Tomate frito', 'grasas', null, 80, 1.4, 11, 3.5, 50, 'generic'),
-- Frutos secos
('Almendras', 'frutos_secos', null, 579, 21, 22, 50, 30, 'generic'),
('Nueces', 'frutos_secos', null, 654, 15, 14, 65, 30, 'generic'),
('Cacahuetes', 'frutos_secos', null, 567, 26, 16, 49, 30, 'generic'),
('Avellanas', 'frutos_secos', null, 628, 15, 17, 61, 30, 'generic'),
('Anacardos', 'frutos_secos', null, 553, 18, 30, 44, 30, 'generic'),
('Pistachos', 'frutos_secos', null, 560, 20, 28, 45, 30, 'generic'),
('Crema de cacahuete', 'frutos_secos', null, 588, 25, 20, 50, 15, 'generic'),
('Pipas de girasol', 'frutos_secos', null, 584, 21, 20, 51, 30, 'generic'),
-- Otros
('Azúcar', 'otros', null, 400, 0, 100, 0, 5, 'generic'),
('Miel', 'otros', null, 304, 0.3, 82, 0, 15, 'generic'),
('Chocolate negro 70 %', 'otros', null, 598, 7.8, 45.9, 42.6, 20, 'generic'),
('Chocolate con leche', 'otros', null, 535, 7.6, 59, 30, 20, 'generic'),
('Hummus', 'otros', null, 166, 7.9, 14.3, 9.6, 30, 'generic'),
('Aceitunas verdes', 'otros', null, 145, 1, 3.8, 15, null, 'generic');
