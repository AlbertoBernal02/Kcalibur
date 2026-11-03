import type { DayData, ExerciseData, ProgramData } from "../data/training.ts";
import { est1RM } from "./log.ts";

export type WeekBest = { week: number; weight: number; reps: number; e1rm: number };

// Mejor serie de cada semana (por 1RM estimado) de un ejercicio, de la semana 1 en adelante.
export function weeklyBest(ex: ExerciseData): WeekBest[] {
  const best = new Map<number, WeekBest>();
  for (const l of ex.logs) {
    if (!l.weight || !l.reps) continue;
    const e1rm = est1RM(l.weight, l.reps);
    if (e1rm > (best.get(l.week)?.e1rm ?? 0)) best.set(l.week, { week: l.week, weight: l.weight, reps: l.reps, e1rm });
  }
  return [...best.values()].sort((a, b) => a.week - b.week);
}

export type ExerciseProgress = { name: string; weeks: WeekBest[]; change: number | null; pr: WeekBest | null };

// Progreso por ejercicio (agrupa por nombre: el mismo ejercicio en dos días suma sus registros).
// `change` = % de variación del 1RM estimado entre la primera y la última semana con datos.
export function programProgress(days: DayData[]): ExerciseProgress[] {
  const byName = new Map<string, ExerciseData[]>();
  for (const e of days.flatMap((d) => d.exercises)) byName.set(e.name, [...(byName.get(e.name) ?? []), e]);
  return [...byName.entries()]
    .map(([name, list]) => {
      const merged = weeklyBest({ ...list[0], logs: list.flatMap((e) => e.logs) });
      const first = merged[0];
      const last = merged.at(-1);
      return {
        name,
        weeks: merged,
        change: first && last && last.week !== first.week ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : null,
        pr: merged.reduce<WeekBest | null>((m, w) => (!m || w.e1rm > m.e1rm ? w : m), null),
      };
    })
    .filter((p) => p.weeks.length > 0);
}

// Volumen total (kg) por semana, de todo el programa.
export function weeklyVolume(p: ProgramData): { week: number; kg: number }[] {
  return Array.from({ length: p.weeks }, (_, i) => i + 1).map((week) => ({
    week,
    kg: Math.round(p.days.flatMap((d) => d.exercises).flatMap((e) => e.logs).filter((l) => l.week === week).reduce((s, l) => s + (l.weight ?? 0) * (l.reps ?? 0), 0)),
  }));
}
