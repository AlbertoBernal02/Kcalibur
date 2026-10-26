import type { Entry } from "./data/diary.ts";
import { MEALS, type Meal } from "./meals.ts";

export type Totals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

const ZERO: Totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

// Suma kcal y macros de una lista de entradas.
export function totals(entries: Pick<Entry, keyof Totals>[]): Totals {
  return entries.reduce(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein_g: a.protein_g + e.protein_g,
      carbs_g: a.carbs_g + e.carbs_g,
      fat_g: a.fat_g + e.fat_g,
    }),
    ZERO,
  );
}

export type MealShare = Totals & { meal: Meal; label: string; pct: number };

// Totales por comida y su porcentaje de las kcal del día (0 si el día está vacío).
export function mealBreakdown(entries: (Pick<Entry, keyof Totals> & { meal: Meal })[]): MealShare[] {
  const day = totals(entries).kcal;
  return MEALS.map(({ id, label }) => {
    const t = totals(entries.filter((e) => e.meal === id));
    return { ...t, meal: id, label, pct: day > 0 ? (t.kcal / day) * 100 : 0 };
  });
}
