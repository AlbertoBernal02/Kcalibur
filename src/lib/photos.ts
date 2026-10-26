import { addDays } from "./meals.ts";

// Días entre dos fechas "YYYY-MM-DD" (b - a).
export function daysBetween(a: string, b: string): number {
  const d = (s: string) => {
    const [y, m, day] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, day) / 86_400_000;
  };
  return Math.round(d(b) - d(a));
}

// Peso registrado más cercano a una fecha (hasta `maxDays` de distancia); null si no hay ninguno cerca.
export function nearestWeight(weights: { date: string; value: number }[], date: string, maxDays = 3): number | null {
  let best: { dist: number; value: number } | null = null;
  for (const w of weights) {
    const dist = Math.abs(daysBetween(w.date, date));
    if (dist <= maxDays && (!best || dist < best.dist)) best = { dist, value: w.value };
  }
  return best ? best.value : null;
}

export type NextPhoto = { due: boolean; days: number; dueOn: string | null };

// Recordatorio quincenal: ¿toca ya una foto nueva? `days` = días desde la última (o hasta la próxima si no toca).
export function nextPhotoInfo(lastDate: string | null, today: string, interval = 14): NextPhoto {
  if (!lastDate) return { due: true, days: 0, dueOn: null };
  const since = daysBetween(lastDate, today);
  const dueOn = addDays(lastDate, interval);
  return since >= interval ? { due: true, days: since, dueOn } : { due: false, days: interval - since, dueOn };
}

// Tamaño que cabe en `max` px por el lado mayor, sin ampliar y conservando la proporción.
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
