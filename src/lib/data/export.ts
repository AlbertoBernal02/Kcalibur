import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv } from "@/lib/csv";
import { MEALS } from "@/lib/meals";
import { CATEGORIES, STATE_LABEL, type Category, type FoodState } from "@/lib/data/foods";

const PAGE = 1000; // límite de filas por petición de la API

// Descarga todas las filas paginando (la API corta en 1000). `ownOnly` excluye las filas compartidas (user_id nulo).
async function fetchAll<T>(sb: SupabaseClient, table: string, cols: string, order: string[], ownOnly = false): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols);
    if (ownOnly) q = q.not("user_id", "is", null);
    for (const o of order) q = q.order(o);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE) return rows;
  }
}

export type ExportResult = { csv: string; rows: number };

const mealLabel = (id: string) => MEALS.find((m) => m.id === id)?.label ?? id;

type DiaryRow = { entry_date: string; meal: string; name: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export async function exportDiary(sb: SupabaseClient): Promise<ExportResult> {
  const rows = await fetchAll<DiaryRow>(sb, "diary_entries", "entry_date, meal, name, grams, kcal, protein_g, carbs_g, fat_g", ["entry_date", "created_at", "id"]);
  const csv = toCsv<DiaryRow>(
    [
      { header: "fecha", value: (r) => r.entry_date },
      { header: "comida", value: (r) => mealLabel(r.meal) },
      { header: "alimento", value: (r) => r.name },
      { header: "gramos", value: (r) => Number(r.grams) },
      { header: "kcal", value: (r) => Number(r.kcal) },
      { header: "proteina_g", value: (r) => Number(r.protein_g) },
      { header: "hidratos_g", value: (r) => Number(r.carbs_g) },
      { header: "grasa_g", value: (r) => Number(r.fat_g) },
    ],
    rows,
  );
  return { csv, rows: rows.length };
}

// Peso y agua unidos por fecha (una fila por día con algún registro).
export async function exportBody(sb: SupabaseClient): Promise<ExportResult> {
  const [w, h] = await Promise.all([
    fetchAll<{ log_date: string; weight_kg: number }>(sb, "weight_logs", "log_date, weight_kg", ["log_date"]),
    fetchAll<{ log_date: string; ml: number }>(sb, "water_logs", "log_date, ml", ["log_date"]),
  ]);
  const byDate = new Map<string, { date: string; kg: number | null; ml: number | null }>();
  const row = (date: string) => byDate.get(date) ?? byDate.set(date, { date, kg: null, ml: null }).get(date)!;
  w.forEach((r) => (row(r.log_date).kg = Number(r.weight_kg)));
  h.forEach((r) => (row(r.log_date).ml = Number(r.ml)));
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const csv = toCsv(
    [
      { header: "fecha", value: (r: (typeof rows)[number]) => r.date },
      { header: "peso_kg", value: (r) => r.kg },
      { header: "agua_ml", value: (r) => r.ml },
    ],
    rows,
  );
  return { csv, rows: rows.length };
}

type FoodRow = {
  name: string; brand: string | null; barcode: string | null; category: Category; state: FoodState | null; source: string;
  kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number; serving_g: number | null;
};

// Solo los alimentos propios o importados (los genéricos son comunes a todos).
export async function exportFoods(sb: SupabaseClient): Promise<ExportResult> {
  const rows = await fetchAll<FoodRow>(
    sb, "foods", "name, brand, barcode, category, state, source, kcal_100g, protein_100g, carbs_100g, fat_100g, serving_g", ["name", "id"],
    true,
  );
  const csv = toCsv<FoodRow>(
    [
      { header: "nombre", value: (r) => r.name },
      { header: "marca", value: (r) => r.brand },
      { header: "codigo_barras", value: (r) => r.barcode },
      { header: "categoria", value: (r) => CATEGORIES[r.category] },
      { header: "estado", value: (r) => (r.state ? STATE_LABEL[r.state] : "") },
      { header: "origen", value: (r) => (r.source === "off" ? "Open Food Facts" : "Propio") },
      { header: "kcal_100g", value: (r) => Number(r.kcal_100g) },
      { header: "proteina_100g", value: (r) => Number(r.protein_100g) },
      { header: "hidratos_100g", value: (r) => Number(r.carbs_100g) },
      { header: "grasa_100g", value: (r) => Number(r.fat_100g) },
      { header: "racion_g", value: (r) => (r.serving_g === null ? null : Number(r.serving_g)) },
    ],
    rows,
  );
  return { csv, rows: rows.length };
}
