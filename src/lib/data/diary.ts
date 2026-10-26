import type { SupabaseClient } from "@supabase/supabase-js";
import type { Meal } from "@/lib/meals";

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
};

const COLS = "id, entry_date, meal, food_id, name, grams, serving_g, kcal, protein_g, carbs_g, fat_g";

// Entradas de un día, en orden de creación.
export async function loadDay(sb: SupabaseClient, date: string): Promise<Entry[]> {
  const { data, error } = await sb.from("diary_entries").select(COLS).eq("entry_date", date).order("created_at");
  if (error) throw error;
  return data as Entry[];
}

// Añade una entrada (el id lo genera el cliente) y marca el alimento como usado recientemente.
export async function addEntry(sb: SupabaseClient, userId: string, entry: Omit<Entry, "id">) {
  const { error } = await sb.from("diary_entries").insert({ id: crypto.randomUUID(), user_id: userId, ...entry });
  if (error) throw error;
  if (entry.food_id) {
    // El "reciente" es secundario: si falla no se bloquea el diario.
    await sb.from("food_usage").upsert({ user_id: userId, food_id: entry.food_id, last_used_at: new Date().toISOString() });
  }
}

export async function updateEntry(sb: SupabaseClient, id: string, patch: Partial<Omit<Entry, "id">>) {
  const { error } = await sb.from("diary_entries").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("diary_entries").delete().eq("id", id);
  if (error) throw error;
}

// Copia entradas a otro día; `meal` fuerza la comida destino (si no, conservan la suya).
export async function copyEntries(sb: SupabaseClient, userId: string, entries: Entry[], date: string, meal?: Meal) {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({ ...e, id: crypto.randomUUID(), user_id: userId, entry_date: date, meal: meal ?? e.meal }));
  const { error } = await sb.from("diary_entries").insert(rows);
  if (error) throw error;
}
