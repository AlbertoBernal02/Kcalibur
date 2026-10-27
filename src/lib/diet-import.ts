// Convierte lo que devuelve la IA al importar una dieta en opciones listas para guardar: cada alimento se asocia con tu
// catálogo (valores reales) o, si no se encuentra, conserva los valores estimados por la IA (puro, sin red).
import type { DietImport, ImportMeal } from "./ai/diet-import.ts";
import { baseName } from "./plan.ts";

export type CatalogFood = {
  id: string; name: string; state: "raw" | "cooked" | null;
  kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number;
};

export type BuiltItem = {
  food_id: string | null; name: string; grams: number;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  estimated: boolean; // true = valores estimados por la IA (no se encontró en el catálogo)
};
export type BuiltOption = { meal: ImportMeal; name: string; items: BuiltItem[] };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const STATE_WORDS = /\b(cocinad[oa]s?|cocid[oa]s?|hervid[oa]s?|crud[oa]s?|secos?)\b/g;
const words = (s: string) => s.split(/[^a-z0-9%]+/).filter(Boolean);

// Estado con el que se pesa un alimento según su nombre en el plan: "cocinado", "crudo" o null si no lo dice.
const wantedState = (n: string): "raw" | "cooked" | null => (/\b(cocinad|cocid|hervid)/.test(n) ? "cooked" : /\b(crud|seco)/.test(n) ? "raw" : null);

// Alimento del catálogo que corresponde a un nombre del plan ("Pasta cocida (o ñoquis…)"), o null si no hay uno claro.
// Prioriza coincidencia exacta del nombre, luego prefijos y, para nombres de una sola palabra, que esté contenida.
export function matchFood(name: string, foods: CatalogFood[]): CatalogFood | null {
  const base = norm(baseName(name));
  const state = wantedState(base);
  const core = base.replace(STATE_WORDS, " ").replace(/\s+/g, " ").trim();
  if (core.length < 3) return null;
  const coreWords = words(core);

  let best: { f: CatalogFood; score: number } | null = null;
  for (const f of foods) {
    const fn = norm(f.name);
    let score = 0;
    if (fn === core) score = 3;
    else if (fn.startsWith(core + " ")) score = 2;
    else if (fn.length >= 4 && core.startsWith(fn + " ")) score = 1;
    else if (coreWords.length === 1 && coreWords[0].length >= 4 && words(fn).includes(coreWords[0])) score = 0.5;
    if (score === 0) continue;
    if (state && f.state === state) score += 0.4;
    else if (!state && f.state === null) score += 0.2;
    // A igual puntuación gana el nombre más corto (el más genérico).
    if (!best || score > best.score || (score === best.score && f.name.length < best.f.name.length)) best = { f, score };
  }
  return best?.f ?? null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildOptions(parsed: DietImport, foods: CatalogFood[]): BuiltOption[] {
  return parsed.options.map((o) => ({
    meal: o.meal,
    name: o.name,
    items: o.items.map((i) => {
      const f = matchFood(i.name, foods);
      const per = f
        ? { kcal: f.kcal_100g, p: f.protein_100g, c: f.carbs_100g, f: f.fat_100g }
        : { kcal: i.kcal_100g, p: i.protein_100g, c: i.carbs_100g, f: i.fat_100g };
      const k = i.grams / 100;
      return {
        food_id: f?.id ?? null, name: i.name, grams: i.grams,
        kcal: r1(per.kcal * k), protein_g: r1(per.p * k), carbs_g: r1(per.c * k), fat_g: r1(per.f * k),
        estimated: !f,
      };
    }),
  }));
}
