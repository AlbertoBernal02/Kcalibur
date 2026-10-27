import type { SupabaseClient } from "@supabase/supabase-js";
import type { Meal } from "@/lib/meals";
import { applyPending, type Op } from "@/lib/offline/merge";
import { cacheGet, cacheSet, isNetworkError } from "@/lib/offline/store";
import { enqueue, flush, getQueue } from "@/lib/offline/sync";
import { currentUserId } from "@/lib/supabase/client";

export type Entry = {
  id: string;
  entry_date: string;
  meal: Meal;
  food_id: string | null;
  name: string;
  grams: number;
  serving_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  external?: boolean; // comida de fuera de casa (estimada): kcal/macros directos, grams = 1 (un plato)
};

const COLS = "id, entry_date, meal, food_id, name, grams, serving_g, kcal, protein_g, carbs_g, fat_g, external";

// Entradas de un día: servidor (o, sin conexión, la última copia guardada) + cambios aún sin sincronizar.
export async function loadDay(sb: SupabaseClient, date: string): Promise<Entry[]> {
  let base: Entry[] | undefined;
  const { data, error } = await sb.from("diary_entries").select(COLS).eq("entry_date", date).order("created_at");
  if (!error) {
    base = data as Entry[];
    void cacheSet(`day:${date}`, base);
  } else if (isNetworkError(error)) {
    base = await cacheGet<Entry[]>(`day:${date}`);
  }
  if (!base) throw error;
  return applyPending(base, await getQueue(), date);
}

// Guarda los cambios en la cola local y los envía enseguida si hay red (si no, quedan pendientes).
const submit = async (sb: SupabaseClient, ops: Op[]) => {
  await enqueue(ops);
  await flush(sb);
};

// Omit que se aplica a cada miembro de la unión (Omit<Op, "id"> normal la aplastaría).
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
const newOp = (op: WithoutId<Op>): Op => ({ ...op, id: crypto.randomUUID() }) as Op;

// Añade varias entradas (el id lo genera el cliente: así funciona sin conexión).
export async function addEntries(sb: SupabaseClient, rows: Omit<Entry, "id">[]) {
  await submit(sb, rows.map((r) => newOp({ kind: "insert", row: { ...r, id: crypto.randomUUID() } })));
}

// Añade una entrada y marca el alimento como usado recientemente.
export async function addEntry(sb: SupabaseClient, entry: Omit<Entry, "id">) {
  await addEntries(sb, [entry]);
  if (entry.food_id) {
    // "Reciente" es secundario: sin red o si falla, no se bloquea el diario.
    try {
      await sb.from("food_usage").upsert({ user_id: await currentUserId(), food_id: entry.food_id, last_used_at: new Date().toISOString() });
    } catch {
      /* ignorado a propósito */
    }
  }
}

export const updateEntry = (sb: SupabaseClient, id: string, patch: Partial<Omit<Entry, "id">>) =>
  submit(sb, [newOp({ kind: "update", entryId: id, patch })]);

export const deleteEntry = (sb: SupabaseClient, id: string) => submit(sb, [newOp({ kind: "delete", entryId: id })]);

// Copia entradas a otro día; `meal` fuerza la comida destino (si no, conservan la suya).
export async function copyEntries(sb: SupabaseClient, entries: Entry[], date: string, meal?: Meal) {
  await addEntries(
    sb,
    entries.map((e) => ({
      entry_date: date, meal: meal ?? e.meal, food_id: e.food_id, name: e.name, grams: e.grams,
      serving_g: e.serving_g, kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g, external: e.external,
    })),
  );
}
