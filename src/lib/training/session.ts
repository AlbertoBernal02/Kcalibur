import type { DayData, ExerciseData, LogRow, ProgramData } from "../data/training.ts";
import { fmtNum } from "./log.ts";
import type { PlanSet } from "./types.ts";

// Fecha local "YYYY-MM-DD" (no UTC: a las 00:30 en España sigue siendo "hoy").
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 1 = lunes … 7 = domingo.
export const isoWeekday = (d = new Date()) => ((d.getDay() + 6) % 7) + 1;

export const logOf = (ex: ExerciseData, week: number, setIndex: number): LogRow | undefined =>
  ex.logs.find((l) => l.week === week && l.setIndex === setIndex);

// Referencia para la serie: lo que hiciste en la misma serie la semana más reciente anterior que la tenga.
export function previousLog(ex: ExerciseData, week: number, setIndex: number): LogRow | null {
  const prior = ex.logs.filter((l) => l.setIndex === setIndex && l.week < week && (l.reps !== null || l.weight !== null));
  return prior.sort((a, b) => b.week - a.week)[0] ?? null;
}

// Series hechas / series planificadas de un día en una semana.
export function dayProgress(day: DayData, week: number): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const ex of day.exercises) {
    const n = ex.plan[week]?.length ?? 0;
    total += n;
    done += ex.logs.filter((l) => l.week === week && l.setIndex < n).length;
  }
  return { done, total };
}

// Copia del programa con una serie marcada (log) o desmarcada (log = null). Para actualizar la pantalla sin recargar.
export function withLog(p: ProgramData, exerciseId: string, week: number, setIndex: number, log: LogRow | null): ProgramData {
  return {
    ...p,
    days: p.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        const rest = e.logs.filter((l) => !(l.week === week && l.setIndex === setIndex));
        return { ...e, logs: log ? [...rest, log] : rest };
      }),
    })),
  };
}

// Volumen de un día en una semana: suma de peso × reps de las series hechas (kg).
export function dayVolume(day: DayData, week: number): number {
  return day.exercises.reduce((sum, e) => sum + e.logs.filter((l) => l.week === week).reduce((s, l) => s + (l.weight ?? 0) * (l.reps ?? 0), 0), 0);
}

// Día que toca hoy: el que tiene ese día de la semana; si no hay ninguno, null (descanso).
export const dayFor = (p: ProgramData, weekday: number): DayData | null => p.days.find((d) => d.weekday === weekday) ?? null;

// "20 × 19" (o el texto original si no se pudo leer ningún número).
export function summarizeLog(l: Pick<LogRow, "weight" | "reps" | "note">): string {
  if (l.reps === null && l.weight === null) return l.note;
  if (l.weight === null) return `${fmtNum(l.reps!)} reps`;
  return l.reps === null ? `${fmtNum(l.weight)} kg` : `${fmtNum(l.weight)} × ${fmtNum(l.reps)}`;
}

// Primer número de un objetivo de reps ("15 - 20" → 15, "8 + 12" → 8, "7 RIR 2 | RM 80%" → 7).
export function firstNumber(text: string): number | null {
  const m = /\d+/.exec(text);
  return m ? Number(m[0]) : null;
}

// "15 - 20 reps · RIR 1" para mostrar el objetivo de una serie.
export function targetText(s: PlanSet): string {
  const reps = s.reps === "-" ? "máx." : /^\d+$/.test(s.reps) ? `${s.reps} reps` : s.reps;
  return s.rir.trim() === "" ? reps : `${reps} · RIR ${s.rir}`;
}
