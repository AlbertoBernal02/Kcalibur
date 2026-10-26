import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDailyTotals, loadWeights } from "@/lib/data/tracking";
import { addDays } from "@/lib/meals";
import { ageFromBirth, type Activity, type Goal, type Goals, type Sex } from "@/lib/nutrition";
import { mealTotals } from "@/lib/recipes";
import type { AiData } from "@/lib/ai/context";

// Lee del servidor (con la sesión del usuario y RLS) lo que el asistente necesita saber.
// Un fallo en un bloque no tumba la consulta: ese bloque va vacío y el asistente lo tratará como "sin datos".
export async function loadAiData(sb: SupabaseClient, date: string): Promise<AiData> {
  const [y, m, d] = date.split("-").map(Number);
  const todayDate = new Date(y, m - 1, d);
  // Las consultas directas de supabase-js no lanzan: ante un error devuelven data null (se trata como "sin datos").
  // Solo las dos funciones auxiliares sí lanzan, y se envuelven para que un fallo no tumbe el chat.
  const [profile, goals, entries, days, weights, diets, options] = await Promise.all([
    sb.from("profiles").select("sex, birth_date, height_cm, weight_kg, activity, goal").maybeSingle(),
    sb.from("goals").select("kcal, protein_g, carbs_g, fat_g").maybeSingle(),
    sb.from("diary_entries").select("meal, name, grams, kcal, protein_g, carbs_g, fat_g").eq("entry_date", date).order("created_at"),
    loadDailyTotals(sb, addDays(date, -13), date).catch(() => []),
    loadWeights(sb, addDays(date, -30)).catch(() => []),
    sb.from("diets").select("id, name, notes").order("created_at"),
    sb.from("saved_meals").select("name, diet_id, diet_meal, saved_meal_items(name, grams, kcal, protein_g, carbs_g, fat_g)").not("diet_id", "is", null).order("created_at"),
  ]);

  type Item = { name: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  const p = profile.data as { sex: Sex | null; birth_date: string | null; height_cm: number | null; weight_kg: number | null; activity: Activity | null; goal: Goal | null } | null;
  const optionRows = (options.data ?? []) as unknown as { name: string; diet_id: string; diet_meal: string; saved_meal_items: Item[] }[];

  return {
    date,
    profile: p
      ? { sex: p.sex, age: p.birth_date ? ageFromBirth(p.birth_date, todayDate) : null, height_cm: p.height_cm, weight_kg: p.weight_kg, activity: p.activity, goal: p.goal }
      : null,
    goals: goals.data as Goals | null,
    today: (entries.data ?? []) as AiData["today"],
    days: days.filter((x) => x.kcal > 0),
    weights,
    diets: ((diets.data ?? []) as { id: string; name: string; notes: string | null }[]).map((dt) => ({
      name: dt.name,
      notes: dt.notes,
      options: optionRows
        .filter((o) => o.diet_id === dt.id)
        .map((o) => {
          const t = mealTotals(o.saved_meal_items.map((i) => ({ ...i, grams: Number(i.grams), kcal: Number(i.kcal), protein_g: Number(i.protein_g), carbs_g: Number(i.carbs_g), fat_g: Number(i.fat_g) })));
          return { meal: o.diet_meal, name: o.name, kcal: t.kcal, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g, items: o.saved_meal_items.map((i) => i.name) };
        }),
    })),
  };
}
