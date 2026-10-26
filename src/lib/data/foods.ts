import type { SupabaseClient } from "@supabase/supabase-js";

export type Category =
  | "carne" | "pescado" | "huevos" | "cereales" | "tuberculos" | "legumbres"
  | "fruta" | "verdura" | "lacteos" | "grasas" | "frutos_secos" | "otros";
export type FoodState = "raw" | "cooked";

export type Food = {
  id: string;
  user_id: string | null; // null = genérico compartido
  name: string;
  brand: string | null;
  barcode: string | null;
  category: Category;
  state: FoodState | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  serving_g: number | null;
  source: "generic" | "custom" | "off";
};

// Campos editables al crear/editar un alimento.
export type FoodInput = Omit<Food, "id" | "user_id" | "source">;

export const CATEGORIES: Record<Category, string> = {
  carne: "Carnes",
  pescado: "Pescados y mariscos",
  huevos: "Huevos",
  cereales: "Cereales, pasta y pan",
  tuberculos: "Patata y boniato",
  legumbres: "Legumbres",
  fruta: "Frutas",
  verdura: "Verduras",
  lacteos: "Lácteos",
  grasas: "Aceites y grasas",
  frutos_secos: "Frutos secos",
  otros: "Otros",
};

export const STATE_LABEL: Record<FoodState, string> = { raw: "crudo", cooked: "cocinado" };

// Nombre mostrado: "Arroz blanco (cocinado)".
export const foodLabel = (f: Pick<Food, "name" | "state">) =>
  f.state ? `${f.name} (${STATE_LABEL[f.state]})` : f.name;

// Normaliza para buscar sin acentos ni mayúsculas.
export const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const COLS =
  "id, user_id, name, brand, barcode, category, state, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g, source";

// Todos los alimentos visibles + favoritos + último uso.
// ponytail: se cargan todos y se filtra en cliente (PostgREST corta en 1000 filas); paginar si el catálogo crece.
export async function listFoods(sb: SupabaseClient) {
  const [foods, favs, usage] = await Promise.all([
    sb.from("foods").select(COLS).order("name").limit(1000),
    sb.from("food_favorites").select("food_id"),
    sb.from("food_usage").select("food_id, last_used_at"),
  ]);
  if (foods.error) throw foods.error;
  if (favs.error) throw favs.error;
  if (usage.error) throw usage.error;
  return {
    foods: foods.data as Food[],
    favorites: new Set(favs.data.map((r) => r.food_id as string)),
    lastUsed: new Map(usage.data.map((r) => [r.food_id as string, r.last_used_at as string])),
  };
}

export async function getFood(sb: SupabaseClient, id: string): Promise<Food | null> {
  const { data, error } = await sb.from("foods").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Food | null;
}

// Crea (sin id) o actualiza un alimento propio; devuelve su id.
export async function saveFood(sb: SupabaseClient, userId: string, input: FoodInput, id?: string): Promise<string> {
  if (id) {
    const { error } = await sb.from("foods").update(input).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await sb.from("foods").insert({ ...input, user_id: userId, source: "custom" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteFood(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("foods").delete().eq("id", id);
  if (error) throw error;
}

export async function setFavorite(sb: SupabaseClient, userId: string, foodId: string, on: boolean) {
  const { error } = on
    ? await sb.from("food_favorites").upsert({ user_id: userId, food_id: foodId })
    : await sb.from("food_favorites").delete().eq("food_id", foodId);
  if (error) throw error;
}
