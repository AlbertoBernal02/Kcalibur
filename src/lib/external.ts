import type { Entry } from "./data/diary.ts";
import type { Meal } from "./meals.ts";

// Macros de un plato de fuera de casa (valores totales, no por 100 g).
export type OutsideDish = { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export const MAX_DISH_KCAL = 5000;

// Número escrito por el usuario ("12,5" o "12.5"). Vacío = 0 si `emptyIs0`; null si no es válido o se sale de rango.
export function parseAmount(text: string, max: number, emptyIs0 = false): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return emptyIs0 ? 0 : null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Entrada de diario de un plato de fuera: guarda los totales tal cual y cuenta como 1 ración (grams = 1).
export function outsideEntry(dish: OutsideDish, date: string, meal: Meal): Omit<Entry, "id"> {
  return {
    entry_date: date, meal, food_id: null, name: dish.name.trim(), grams: 1, serving_g: null,
    kcal: r1(dish.kcal), protein_g: r1(dish.protein_g), carbs_g: r1(dish.carbs_g), fat_g: r1(dish.fat_g),
    external: true,
  };
}

// Escala un plato por un factor (p. ej. kcal editadas o el "valor alto" del rango estimado).
export function scaleDish(d: OutsideDish, factor: number): OutsideDish {
  return { name: d.name, kcal: d.kcal * factor, protein_g: d.protein_g * factor, carbs_g: d.carbs_g * factor, fat_g: d.fat_g * factor };
}

// ¿El mensaje cuenta que el usuario ha comido algo? ("he comido…", "cené…", "me he tomado…"). Heurística sencilla:
// decide si el chat ofrece el botón "Añadir al diario"; si falla, el usuario puede usar la pestaña Fuera.
export function looksLikeMealReport(text: string): boolean {
  // (?<!\p{L})…(?!\p{L}) hace de límite de palabra también con tildes ("comí"), donde \b falla.
  return /(?<!\p{L})((he|hemos|me he|me hemos)\s+(comido|cenado|desayunado|almorzado|merendado|tomado|picado|zampado)|com[ií]|cen[eé]|desayun[eé]|almorc[eé]|merend[eé]|tom[eé]|me com[ií]|me zamp[eé])(?!\p{L})/iu.test(text.replace(/¿[^?]*\?/g, " ")); // una pregunta ("¿qué he comido hoy?") no cuenta como relato
}
