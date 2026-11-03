import type { PlanSet } from "./types.ts";

// Pone las series de `week` (y, si `following`, también las de las semanas siguientes hasta `weeks`).
export function applySets(plan: Record<number, PlanSet[]>, week: number, sets: PlanSet[], weeks: number, following: boolean): Record<number, PlanSet[]> {
  const out = { ...plan };
  for (let w = week; w <= (following ? weeks : week); w++) out[w] = sets.map((s) => ({ ...s }));
  return out;
}

// Plan de un ejercicio nuevo: las mismas series en todas las semanas.
export function uniformPlan(sets: PlanSet[], weeks: number): Record<number, PlanSet[]> {
  return applySets({}, 1, sets, weeks, true);
}

// "1:30" / "90" / "2" (minutos si es ≤ 10 sin dos puntos) → segundos; vacío o inválido → null.
export function parseRestInput(text: string): number | null {
  const t = text.trim();
  const m = /^(\d+):([0-5]?\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= 10 ? n * 60 : n;
}
