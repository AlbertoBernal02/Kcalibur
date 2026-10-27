-- AOVE en spray: 1 puff ≈ 0,25 g. La ración (serving_g) admitía solo un decimal (0,3 g = 20 % de error por puff),
-- así que se ensancha a dos decimales en las tres tablas que la guardan.
alter table public.foods alter column serving_g type numeric(7, 2);
alter table public.diary_entries alter column serving_g type numeric(7, 2);
alter table public.saved_meal_items alter column serving_g type numeric(7, 2);

-- Alimento genérico: la ración es 1 puff, así que "10 raciones" = 10 puffs = 2,5 g de aceite.
insert into public.foods (name, category, state, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g, source)
values ('AOVE en spray', 'grasas', null, 884, 0, 0, 100, 0.25, 'generic');
