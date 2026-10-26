import type { SupabaseClient } from "@supabase/supabase-js";
import { addEntries, type Entry } from "@/lib/data/diary";
import type { Meal } from "@/lib/meals";
import { cachedRead } from "@/lib/offline/store";

export type Kind = "meal" | "recipe";

// Elemento de una comida guardada (copia de los valores calculados).
export type SavedItem = {
  food_id: string | null;
  name: string;
  grams: number;
  serving_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type SavedMeal = { id: string; name: string; kind: Kind; servings: number; items: SavedItem[] };

const ITEM_COLS = "food_id, name, grams, serving_g, kcal, protein_g, carbs_g, fat_g";

type Row = Omit<SavedMeal, "items"> & { saved_meal_items: (SavedItem & { position: number })[] };

// Solo los campos de SavedItem: `position` no debe filtrarse (se reutilizan los elementos en inserts al diario).
const toItem = (r: SavedItem): SavedItem => ({
  food_id: r.food_id, name: r.name, grams: r.grams, serving_g: r.serving_g,
  kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g,
});

const fromRow = (r: Row): SavedMeal => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  servings: Number(r.servings),
  items: [...r.saved_meal_items].sort((a, b) => a.position - b.position).map(toItem),
});

// Todas las comidas guardadas del usuario con sus elementos (con copia local para usarlas sin conexión).
export const listSavedMeals = (sb: SupabaseClient): Promise<SavedMeal[]> =>
  cachedRead("saved-meals", async () => {
    const { data, error } = await sb
      .from("saved_meals")
      .select(`id, name, kind, servings, saved_meal_items(${ITEM_COLS}, position)`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as Row[]).map(fromRow);
  });

export async function getSavedMeal(sb: SupabaseClient, id: string): Promise<SavedMeal | null> {
  const { data, error } = await sb
    .from("saved_meals")
    .select(`id, name, kind, servings, saved_meal_items(${ITEM_COLS}, position)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as Row) : null;
}

const itemRows = (userId: string, mealId: string, items: SavedItem[]) =>
  items.map((it, position) => ({ ...it, user_id: userId, saved_meal_id: mealId, position }));

// Crea una comida con sus elementos. Si fallan los elementos se borra la comida para no dejarla vacía.
export async function createSavedMeal(
  sb: SupabaseClient, userId: string, meal: Omit<SavedMeal, "id">,
): Promise<string> {
  const id = crypto.randomUUID();
  const m = await sb.from("saved_meals").insert({ id, user_id: userId, name: meal.name, kind: meal.kind, servings: meal.servings });
  if (m.error) throw m.error;
  const i = await sb.from("saved_meal_items").insert(itemRows(userId, id, meal.items));
  if (i.error) {
    await sb.from("saved_meals").delete().eq("id", id);
    throw i.error;
  }
  return id;
}

// Actualiza la comida y reemplaza sus elementos.
// ponytail: borrar+insertar no es atómico (PostgREST no tiene transacciones); si el insert falla se pierden los elementos. RPC si importa.
export async function updateSavedMeal(sb: SupabaseClient, userId: string, id: string, meal: Omit<SavedMeal, "id">) {
  const m = await sb.from("saved_meals").update({ name: meal.name, kind: meal.kind, servings: meal.servings }).eq("id", id);
  if (m.error) throw m.error;
  const d = await sb.from("saved_meal_items").delete().eq("saved_meal_id", id);
  if (d.error) throw d.error;
  const i = await sb.from("saved_meal_items").insert(itemRows(userId, id, meal.items));
  if (i.error) throw i.error;
}

export async function deleteSavedMeal(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("saved_meals").delete().eq("id", id);
  if (error) throw error;
}

// Convierte entradas del diario en elementos de una comida guardada.
export const entriesToItems = (entries: Entry[]): SavedItem[] =>
  entries.map(({ food_id, name, grams, serving_g, kcal, protein_g, carbs_g, fat_g }) => ({
    food_id, name, grams, serving_g, kcal, protein_g, carbs_g, fat_g,
  }));

// Añade todos los elementos de una comida guardada al diario (una entrada por elemento; funciona offline).
export const addMealToDiary = (sb: SupabaseClient, items: SavedItem[], date: string, meal: Meal) =>
  addEntries(sb, items.map((it) => ({ ...it, entry_date: date, meal })));
