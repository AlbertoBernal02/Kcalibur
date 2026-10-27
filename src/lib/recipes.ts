import type { SavedItem } from "./data/saved-meals.ts";
import { totals, type Totals } from "./summary.ts";

type Item = Totals & { grams: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

// Totales de todos los elementos (kcal, macros y peso).
export function mealTotals(items: Item[]): Totals & { grams: number } {
  return { ...totals(items), grams: items.reduce((a, i) => a + i.grams, 0) };
}

// Peso de una ración: peso total / nº de raciones.
export function servingGrams(items: Item[], servings: number): number {
  return servings > 0 ? round1(mealTotals(items).grams / servings) : 0;
}

// Valores por 100 g de la receta completa (para escalar cualquier cantidad con scaleMacros).
export function recipePer100(items: Item[]): Totals {
  const t = mealTotals(items);
  if (t.grams <= 0) return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const per = (v: number) => (v / t.grams) * 100;
  return { kcal: per(t.kcal), protein_g: per(t.protein_g), carbs_g: per(t.carbs_g), fat_g: per(t.fat_g) };
}

// Valores de una ración.
export function perServing(items: Item[], servings: number): Totals {
  const t = mealTotals(items);
  const s = servings > 0 ? servings : 1;
  return { kcal: round1(t.kcal / s), protein_g: round1(t.protein_g / s), carbs_g: round1(t.carbs_g / s), fat_g: round1(t.fat_g / s) };
}

// Filas para insertar los elementos de una comida guardada. TODAS llevan las mismas claves: en una inserción en bloque,
// una clave que falte en alguna fila se envía como null y la base de datos rechaza el lote (p. ej. `external` NOT NULL).
export function savedItemRows(userId: string, mealId: string, items: SavedItem[]) {
  return items.map((it, position) => ({ ...it, external: it.external ?? false, user_id: userId, saved_meal_id: mealId, position }));
}
