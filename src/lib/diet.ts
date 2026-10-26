import { MEALS, type Meal } from "./meals.ts";
import { mealTotals } from "./recipes.ts";
import type { Totals } from "./summary.ts";

// Mínimo que necesita el cálculo de una opción de dieta.
export type OptionLike = {
  id: string;
  dietMeal: Meal | null;
  items: (Totals & { grams: number })[];
};

// Opción elegida por comida (id de la opción).
export type Selection = Partial<Record<Meal, string>>;

const optionKcal = (o: OptionLike) => mealTotals(o.items).kcal;

// Agrupa las opciones por comida, respetando el orden recibido.
export function optionsBySlot<T extends OptionLike>(options: T[]): Record<Meal, T[]> {
  const out = Object.fromEntries(MEALS.map((m) => [m.id, [] as T[]])) as Record<Meal, T[]>;
  for (const o of options) if (o.dietMeal) out[o.dietMeal].push(o);
  return out;
}

// Selección por defecto: la primera opción de cada comida que tenga opciones.
export function defaultSelection(options: OptionLike[]): Selection {
  const sel: Selection = {};
  for (const [slot, opts] of Object.entries(optionsBySlot(options))) if (opts[0]) sel[slot as Meal] = opts[0].id;
  return sel;
}

// Limpia una selección guardada: descarta opciones que ya no existen y rellena las que faltan.
export function normalizeSelection(options: OptionLike[], saved: Selection | null): Selection {
  const sel = defaultSelection(options);
  if (!saved) return sel;
  for (const [slot, opts] of Object.entries(optionsBySlot(options))) {
    const keep = opts.find((o) => o.id === saved[slot as Meal]);
    if (keep) sel[slot as Meal] = keep.id;
  }
  return sel;
}

export type DaySummary = {
  chosen: Totals; // suma de las opciones elegidas
  minKcal: number; // día con la opción más ligera de cada comida
  maxKcal: number; // día con la opción más calórica de cada comida
  slotsWithOptions: number;
};

// Totales del "día tipo": opciones elegidas + rango posible según las opciones disponibles.
export function summarizeDay(options: OptionLike[], selection: Selection): DaySummary {
  const slots = optionsBySlot(options);
  const chosen: Totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  let minKcal = 0, maxKcal = 0, slotsWithOptions = 0;
  for (const [slot, opts] of Object.entries(slots)) {
    if (!opts.length) continue;
    slotsWithOptions++;
    const kcals = opts.map(optionKcal);
    minKcal += Math.min(...kcals);
    maxKcal += Math.max(...kcals);
    const pick = opts.find((o) => o.id === selection[slot as Meal]);
    if (pick) {
      const t = mealTotals(pick.items);
      chosen.kcal += t.kcal;
      chosen.protein_g += t.protein_g;
      chosen.carbs_g += t.carbs_g;
      chosen.fat_g += t.fat_g;
    }
  }
  return { chosen, minKcal, maxKcal, slotsWithOptions };
}
