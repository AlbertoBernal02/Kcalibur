import { addDays } from "./meals.ts";
import type { Totals } from "./summary.ts";

export type DayTotals = Totals & { date: string };

// Tolerancia de adherencia: un día "cumple" si sus kcal están a ±10 % del objetivo.
export const ADHERENCE_TOLERANCE = 0.1;

// Lista de `days` fechas consecutivas terminando en `end` (incluida), de más antigua a más reciente.
export function dateRange(end: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(end, i - (days - 1)));
}

export type Summary = {
  loggedDays: number;
  totalDays: number;
  avg: Totals | null; // media de los días con registro (null si no hay ninguno)
  adherence: { onTarget: number; pct: number } | null; // null sin objetivo o sin días registrados
};

// Medias y adherencia sobre un rango. Los días sin ninguna entrada no cuentan (no son "0 kcal").
export function summarize(days: DayTotals[], totalDays: number, goalKcal: number | null): Summary {
  const logged = days.filter((d) => d.kcal > 0);
  const n = logged.length;
  const avg = n
    ? {
        kcal: logged.reduce((a, d) => a + d.kcal, 0) / n,
        protein_g: logged.reduce((a, d) => a + d.protein_g, 0) / n,
        carbs_g: logged.reduce((a, d) => a + d.carbs_g, 0) / n,
        fat_g: logged.reduce((a, d) => a + d.fat_g, 0) / n,
      }
    : null;
  const onTarget = goalKcal ? logged.filter((d) => Math.abs(d.kcal - goalKcal) <= goalKcal * ADHERENCE_TOLERANCE).length : 0;
  return {
    loggedDays: n,
    totalDays,
    avg,
    adherence: goalKcal && n ? { onTarget, pct: (onTarget / n) * 100 } : null,
  };
}

// Cambio de peso entre el primer y el último registro del periodo (null con menos de 2 registros).
export function weightChange(points: { value: number }[]): number | null {
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].value - points[0].value) * 10) / 10;
}
