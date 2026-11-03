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

// ¿Esta serie supera el mejor 1RM estimado de ese ejercicio? Solo cuenta si ya había registros con peso
// (si no, todo sería "récord"); se ignora lo que hubiera en esa misma serie.
export function isRecord(ex: ExerciseData, week: number, setIndex: number, v: { weight: number | null; reps: number | null }): boolean {
  if (!v.weight || !v.reps) return false;
  const others = ex.logs.filter((l) => l.weight && l.reps && !(l.week === week && l.setIndex === setIndex));
  if (others.length === 0) return false;
  return est1RM(v.weight, v.reps) > Math.max(...others.map((l) => est1RM(l.weight!, l.reps!)));
}

export type SessionSummary = { sets: number; volume: number; prevVolume: number | null; records: { name: string; weight: number; reps: number }[] };

const volumeOf = (d: DayData, week: number) =>
  d.exercises.reduce((sum, e) => sum + e.logs.filter((l) => l.week === week).reduce((s, l) => s + (l.weight ?? 0) * (l.reps ?? 0), 0), 0);

// Resumen de un día en una semana: series, volumen (y el de la semana anterior si hubo) y ejercicios donde
// la mejor serie de esta semana supera el mejor 1RM estimado de las semanas anteriores.
export function sessionSummary(day: DayData, week: number): SessionSummary {
  const records: SessionSummary["records"] = [];
  for (const e of day.exercises) {
    const prior = weeklyBest({ ...e, logs: e.logs.filter((l) => l.week < week) });
    const now = weeklyBest({ ...e, logs: e.logs.filter((l) => l.week === week) })[0];
    if (now && prior.length && now.e1rm > Math.max(...prior.map((p) => p.e1rm))) records.push({ name: e.name, weight: now.weight, reps: now.reps });
  }
  const prev = volumeOf(day, week - 1);
  return { sets: day.exercises.reduce((n, e) => n + e.logs.filter((l) => l.week === week).length, 0), volume: volumeOf(day, week), prevVolume: prev > 0 ? prev : null, records };
}

export type TrainedDay = { sets: number; days: string[] };

// Fechas en las que registraste series (las importadas del Excel no tienen fecha) → nº de series y días de rutina.
export function trainedDates(days: DayData[]): Map<string, TrainedDay> {
  const out = new Map<string, TrainedDay>();
  for (const d of days) {
    for (const l of d.exercises.flatMap((e) => e.logs)) {
      if (!l.loggedOn) continue;
      const cur = out.get(l.loggedOn) ?? { sets: 0, days: [] };
      cur.sets++;
      if (!cur.days.includes(d.name)) cur.days.push(d.name);
      out.set(l.loggedOn, cur);
    }
  }
  return out;
}

// Casillas de un mes (empezando en lunes): null para los huecos y "YYYY-MM-DD" para cada día. `month` es 0-11.
export function monthGrid(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [...Array<null>(offset).fill(null), ...Array.from({ length: count }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)];
}
