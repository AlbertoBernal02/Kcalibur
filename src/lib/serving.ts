// Cómo se llama la ración de un alimento y el AOVE en spray que acompaña a la carne y el pescado (puro, sin red).
import { scaleMacros } from "./nutrition.ts";

export type ServingNames = { one: string; many: string; defaultCount?: number };

// Nombre de la unidad según el alimento: "puffs" para el AOVE en spray (10 por defecto), "unidades" para la comida de fuera.
// undefined = ración normal ("Ración / Raciones").
export function servingNamesFor(f: { name: string; category: string }): ServingNames | undefined {
  if (/spray|puff/i.test(f.name)) return { one: "Puff", many: "Puffs", defaultCount: AOVE_PUFFS };
  if (f.category === "comida_fuera") return { one: "Unidad", many: "Unidades" };
  return undefined;
}

export const AOVE_PUFFS = 10;

// ¿Suele cocinarse en sartén con aceite? Carne y pescado: se ofrece añadir el AOVE junto al alimento.
export const needsAove = (f: { category: string }) => f.category === "carne" || f.category === "pescado";

type AoveFood = { id: string; name: string; kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number; serving_g: number | null };

// Elemento "AOVE en spray" de `puffs` puffs (la ración del alimento es 1 puff, 0,25 g) con sus valores ya calculados.
export function aoveItem(food: AoveFood, puffs = AOVE_PUFFS) {
  const serving = food.serving_g ?? 0.25;
  const grams = Math.round(serving * puffs * 100) / 100;
  const m = scaleMacros({ kcal: food.kcal_100g, protein_g: food.protein_100g, carbs_g: food.carbs_100g, fat_g: food.fat_100g }, grams);
  return { food_id: food.id, name: food.name, grams, serving_g: serving, ...m };
}
