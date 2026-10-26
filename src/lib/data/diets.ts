import type { SupabaseClient } from "@supabase/supabase-js";
import { MEAL_SELECT, fromRow, type Row, type SavedMeal } from "@/lib/data/saved-meals";
import type { Meal } from "@/lib/meals";
import { cachedRead } from "@/lib/offline/store";

export type Diet = { id: string; name: string; notes: string | null; options: SavedMeal[] };

type DietRow = { id: string; name: string; notes: string | null };

// Todas las dietas con sus opciones (con copia local: se pueden consultar sin conexión).
export const listDiets = (sb: SupabaseClient): Promise<Diet[]> =>
  cachedRead("diets", async () => {
    const [d, o] = await Promise.all([
      sb.from("diets").select("id, name, notes").order("created_at", { ascending: false }),
      sb.from("saved_meals").select(MEAL_SELECT).not("diet_id", "is", null).order("created_at"),
    ]);
    if (d.error) throw d.error;
    if (o.error) throw o.error;
    const options = (o.data as unknown as Row[]).map(fromRow);
    return (d.data as DietRow[]).map((r) => ({ ...r, options: options.filter((x) => x.dietId === r.id) }));
  });

export async function getDiet(sb: SupabaseClient, id: string): Promise<Diet | null> {
  const [d, o] = await Promise.all([
    sb.from("diets").select("id, name, notes").eq("id", id).maybeSingle(),
    sb.from("saved_meals").select(MEAL_SELECT).eq("diet_id", id).order("created_at"),
  ]);
  if (d.error) throw d.error;
  if (o.error) throw o.error;
  return d.data ? { ...(d.data as DietRow), options: (o.data as unknown as Row[]).map(fromRow) } : null;
}

export async function createDiet(sb: SupabaseClient, userId: string, name: string, notes: string | null): Promise<string> {
  const { data, error } = await sb.from("diets").insert({ user_id: userId, name, notes }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateDiet(sb: SupabaseClient, id: string, name: string, notes: string | null) {
  const { error } = await sb.from("diets").update({ name, notes }).eq("id", id);
  if (error) throw error;
}

// Borra la dieta; sus opciones se borran en cascada.
export async function deleteDiet(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("diets").delete().eq("id", id);
  if (error) throw error;
}

// Opciones de todas las dietas para una comida concreta (para el selector del diario).
export async function listOptionsForMeal(sb: SupabaseClient, meal: Meal): Promise<{ diet: string; option: SavedMeal }[]> {
  const diets = await listDiets(sb);
  return diets.flatMap((d) => d.options.filter((o) => o.dietMeal === meal).map((option) => ({ diet: d.name, option })));
}
