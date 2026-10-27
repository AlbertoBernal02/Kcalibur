-- Comidas fuera de casa: marca de "estimado/fuera" en el diario y en las comidas guardadas.
-- Una entrada "fuera" guarda directamente sus kcal y macros (grams = 1: es un plato/ración, no gramos).
alter table public.diary_entries add column external boolean not null default false;
alter table public.saved_meal_items add column external boolean not null default false;

-- Nueva categoría de alimentos "Comida fuera" (se cuentan por unidades: pieza, taco, porción...).
alter table public.foods drop constraint foods_category_check;
alter table public.foods add constraint foods_category_check check (category in (
  'carne', 'pescado', 'huevos', 'cereales', 'tuberculos', 'legumbres',
  'fruta', 'verdura', 'lacteos', 'grasas', 'frutos_secos', 'otros', 'comida_fuera'));

-- Precarga: valores aproximados por 100 g; serving_g es el peso medio de UNA unidad (así 14 nigiris = 14 raciones).
-- Los tamaños cambian de un restaurante a otro: son una referencia, se pueden editar copiándolos como alimento propio.
insert into public.foods (name, category, state, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g, source) values
('Nigiri de salmón (pieza)', 'comida_fuera', null, 165, 7.5, 27, 3, 30, 'generic'),
('Maki / rollo (pieza)', 'comida_fuera', null, 140, 4, 26, 2, 28, 'generic'),
('Uramaki California (pieza)', 'comida_fuera', null, 160, 4, 24, 5, 32, 'generic'),
('Sashimi de salmón (pieza)', 'comida_fuera', null, 200, 20, 0, 13, 20, 'generic'),
('Gyoza frita (pieza)', 'comida_fuera', null, 230, 8, 24, 10, 25, 'generic'),
('Tempura de gamba (pieza)', 'comida_fuera', null, 250, 12, 20, 14, 30, 'generic'),
('Taco mexicano de carne (unidad)', 'comida_fuera', null, 200, 10, 18, 9, 90, 'generic'),
('Nachos con queso (ración)', 'comida_fuera', null, 470, 8, 55, 25, 150, 'generic'),
('Burrito (unidad)', 'comida_fuera', null, 200, 9, 25, 7, 300, 'generic'),
('Quesadilla (media)', 'comida_fuera', null, 300, 13, 28, 15, 120, 'generic'),
('Pizza de pizzería (porción)', 'comida_fuera', null, 270, 11, 31, 11, 110, 'generic'),
('Hamburguesa street food completa (unidad)', 'comida_fuera', null, 290, 15, 20, 16, 250, 'generic'),
('Patatas fritas de restaurante (ración)', 'comida_fuera', null, 312, 3.4, 41, 15, 150, 'generic'),
('Patatas bravas (ración)', 'comida_fuera', null, 200, 3, 24, 10, 200, 'generic'),
('Perrito caliente (unidad)', 'comida_fuera', null, 260, 10, 24, 14, 150, 'generic'),
('Croqueta (unidad)', 'comida_fuera', null, 230, 6, 20, 14, 30, 'generic'),
('Alita de pollo frita (unidad)', 'comida_fuera', null, 260, 20, 6, 16, 35, 'generic'),
('Nugget de pollo (unidad)', 'comida_fuera', null, 250, 14, 16, 15, 18, 'generic'),
('Cerveza (caña 200 ml)', 'comida_fuera', null, 43, 0.5, 3.6, 0, 200, 'generic'),
('Refresco de cola (vaso 330 ml)', 'comida_fuera', null, 42, 0, 10.6, 0, 330, 'generic'),
('Helado (bola)', 'comida_fuera', null, 200, 3.5, 24, 10, 60, 'generic');
