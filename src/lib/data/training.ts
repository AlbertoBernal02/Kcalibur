import type { SupabaseClient } from "@supabase/supabase-js";
import { startWeek } from "@/lib/training/import-grid";
import type { Exercise, ParsedProgram, PlanSet } from "@/lib/training/types";

// Una serie registrada (que exista = hecha).
export type LogRow = { week: number; setIndex: number; weight: number | null; reps: number | null; rir: number | null; note: string; loggedOn: string };
export type ExerciseData = Exercise & { id: string; logs: LogRow[] };
export type DayData = { id: string; name: string; weekday: number | null; exercises: ExerciseData[] };
export type ProgramData = { id: string; name: string; weeks: number; currentWeek: number; days: DayData[] };

type LogDb = { week: number; set_index: number; weight: number | null; reps: number | null; rir: number | null; note: string; logged_on: string };
type ExerciseDb = { id: string; name: string; notes: string; rest_seconds: number | null; video_url: string | null; plan: Record<string, PlanSet[]>; position: number; set_logs: LogDb[] };
type DayDb = { id: string; name: string; weekday: number | null; position: number; workout_exercises: ExerciseDb[] };
type ProgramDb = { id: string; name: string; weeks: number; current_week: number; workout_days: DayDb[] };

const SELECT =
  "id, name, weeks, current_week, workout_days(id, name, weekday, position, workout_exercises(id, name, notes, rest_seconds, video_url, plan, position, set_logs(week, set_index, weight, reps, rir, note, logged_on)))";

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

// Programa activo con todos sus días, ejercicios y registros (una sola consulta). null si aún no hay rutina.
export async function loadProgram(sb: SupabaseClient): Promise<ProgramData | null> {
  const { data, error } = await sb.from("workout_programs").select(SELECT).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = data as unknown as ProgramDb;
  return {
    id: p.id,
    name: p.name,
    weeks: p.weeks,
    currentWeek: Math.min(p.current_week, p.weeks),
    days: [...p.workout_days].sort(byPosition).map((d) => ({
      id: d.id,
      name: d.name,
      weekday: d.weekday,
      exercises: [...d.workout_exercises].sort(byPosition).map((e) => ({
        id: e.id,
        name: e.name,
        notes: e.notes,
        restSeconds: e.rest_seconds,
        videoUrl: e.video_url,
        plan: Object.fromEntries(Object.entries(e.plan).map(([w, sets]) => [Number(w), sets])),
        logs: e.set_logs.map((l) => ({ week: l.week, setIndex: l.set_index, weight: l.weight, reps: l.reps, rir: l.rir, note: l.note, loggedOn: l.logged_on })),
      })),
    })),
  };
}

// Guarda la rutina importada como programa activo (el anterior queda archivado, no se borra).
// Los ids se generan aquí para insertar por lotes; si algo falla se deshace todo y se reactiva el anterior.
export async function importProgram(sb: SupabaseClient, userId: string, name: string, parsed: ParsedProgram): Promise<string> {
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  const { data: prev } = await sb.from("workout_programs").select("id").eq("active", true).maybeSingle();
  if (prev) check((await sb.from("workout_programs").update({ active: false }).eq("id", prev.id)).error);

  const programId = crypto.randomUUID();
  try {
    check((await sb.from("workout_programs").insert({ id: programId, user_id: userId, name, weeks: parsed.weeks, current_week: startWeek(parsed) })).error);

    const days = parsed.days.map((d, i) => ({ id: crypto.randomUUID(), user_id: userId, program_id: programId, position: i, name: d.name, weekday: d.weekday }));
    check((await sb.from("workout_days").insert(days)).error);

    const exercises = parsed.days.flatMap((d, i) =>
      d.exercises.map((e, j) => ({ id: crypto.randomUUID(), e, row: { user_id: userId, day_id: days[i].id, position: j, name: e.name, notes: e.notes, rest_seconds: e.restSeconds, video_url: e.videoUrl, plan: e.plan } })),
    );
    check((await sb.from("workout_exercises").insert(exercises.map((x) => ({ id: x.id, ...x.row })))).error);

    const logs = exercises.flatMap((x) =>
      x.e.history.map((h) => ({ user_id: userId, exercise_id: x.id, week: h.week, set_index: h.setIndex, weight: h.weight, reps: h.reps, rir: h.rir, note: h.note })),
    );
    if (logs.length) check((await sb.from("set_logs").insert(logs)).error);
    return programId;
  } catch (e) {
    await sb.from("workout_programs").delete().eq("id", programId); // en cascada
    if (prev) await sb.from("workout_programs").update({ active: true }).eq("id", prev.id);
    throw e;
  }
}

export type SetValues = { weight: number | null; reps: number | null; rir: number | null; note?: string };

// Marca una serie como hecha (o corrige sus valores).
export async function saveLog(sb: SupabaseClient, userId: string, exerciseId: string, week: number, setIndex: number, v: SetValues, date: string) {
  const { error } = await sb.from("set_logs").upsert(
    { user_id: userId, exercise_id: exerciseId, week, set_index: setIndex, weight: v.weight, reps: v.reps, rir: v.rir, note: v.note ?? "", logged_on: date, updated_at: new Date().toISOString() },
    { onConflict: "exercise_id,week,set_index" },
  );
  if (error) throw error;
}

// Desmarca una serie.
export async function deleteLog(sb: SupabaseClient, exerciseId: string, week: number, setIndex: number) {
  const { error } = await sb.from("set_logs").delete().eq("exercise_id", exerciseId).eq("week", week).eq("set_index", setIndex);
  if (error) throw error;
}

export async function setCurrentWeek(sb: SupabaseClient, programId: string, week: number) {
  const { error } = await sb.from("workout_programs").update({ current_week: week }).eq("id", programId);
  if (error) throw error;
}

export async function deleteProgram(sb: SupabaseClient, programId: string) {
  const { error } = await sb.from("workout_programs").delete().eq("id", programId);
  if (error) throw error;
}

export type ExercisePatch = { name: string; notes: string; restSeconds: number | null; videoUrl: string | null; plan: Exercise["plan"] };

const toRow = (p: ExercisePatch) => ({ name: p.name, notes: p.notes, rest_seconds: p.restSeconds, video_url: p.videoUrl, plan: p.plan });

export async function updateExercise(sb: SupabaseClient, id: string, p: ExercisePatch) {
  const { error } = await sb.from("workout_exercises").update(toRow(p)).eq("id", id);
  if (error) throw error;
}

export async function addExercise(sb: SupabaseClient, userId: string, dayId: string, position: number, p: ExercisePatch) {
  const { error } = await sb.from("workout_exercises").insert({ user_id: userId, day_id: dayId, position, ...toRow(p) });
  if (error) throw error;
}

// Borra el ejercicio y, en cascada, todos sus registros.
export async function deleteExercise(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("workout_exercises").delete().eq("id", id);
  if (error) throw error;
}

export async function renameDay(sb: SupabaseClient, id: string, name: string) {
  const { error } = await sb.from("workout_days").update({ name }).eq("id", id);
  if (error) throw error;
}

export type ArchivedProgram = { id: string; name: string; weeks: number };

// Programas archivados (los que dejaron de ser el activo al importar otro), del más reciente al más antiguo.
export async function loadArchived(sb: SupabaseClient): Promise<ArchivedProgram[]> {
  const { data, error } = await sb.from("workout_programs").select("id, name, weeks").eq("active", false).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ArchivedProgram[];
}

// Pone un programa archivado como activo (el que lo era pasa a archivado).
export async function activateProgram(sb: SupabaseClient, id: string) {
  const off = await sb.from("workout_programs").update({ active: false }).eq("active", true);
  if (off.error) throw off.error;
  const on = await sb.from("workout_programs").update({ active: true }).eq("id", id);
  if (on.error) throw on.error;
}
