// Modelo de la rutina de entreno (lo mismo que se guarda en la base de datos).

// Objetivo de una serie en una semana concreta (texto libre: "15 - 20", "8 + 12", "AMRAP"...).
export type PlanSet = { reps: string; rir: string };

// Lo registrado en una serie: números para calcular + texto original por si el Excel traía algo raro.
export type SetLog = {
  week: number;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  note: string;
};

export type Exercise = {
  name: string;
  notes: string;
  restSeconds: number | null;
  videoUrl: string | null;
  // semana (1..n) → objetivos de sus series
  plan: Record<number, PlanSet[]>;
};

export type Day = {
  name: string;
  weekday: number | null; // 1 = lunes … 7 = domingo; null = sin día fijo (descanso/core)
  exercises: Exercise[];
};

// Resultado de leer un Excel: la rutina + el histórico que ya traía rellenado.
export type ParsedExercise = Exercise & { history: SetLog[] };
export type ParsedProgram = {
  weeks: number;
  days: (Omit<Day, "exercises"> & { exercises: ParsedExercise[] })[];
};
