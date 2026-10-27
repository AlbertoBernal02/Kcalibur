import type { SupabaseClient } from "@supabase/supabase-js";
import { MEAL_SELECT, fromRow, type Row, type SavedMeal } from "@/lib/data/saved-meals";
import type { Meal } from "@/lib/meals";

export type PlanRow = { date: string; meal: Meal; option: SavedMeal };

// Plan de un rango de fechas (ambas incluidas), con la opción y sus elementos de cada comida.
export async function loadPlan(sb: SupabaseClient, from: string, to: string): Promise<PlanRow[]> {
  const { data, error } = await sb
    .from("meal_plan")
    .select(`plan_date, meal, saved_meals(${MEAL_SELECT})`)
    .gte("plan_date", from)
    .lte("plan_date", to);
  if (error) throw error;
  return (data as unknown as { plan_date: string; meal: Meal; saved_meals: Row | null }[]).flatMap((r) =>
    r.saved_meals ? [{ date: r.plan_date, meal: r.meal, option: fromRow(r.saved_meals) }] : [],
  );
}

// Pone (o cambia) la opción de una comida de un día; con `optionId` null la quita.
export async function setPlanned(sb: SupabaseClient, userId: string, date: string, meal: Meal, optionId: string | null) {
  const { error } = optionId
    ? await sb.from("meal_plan").upsert({ user_id: userId, plan_date: date, meal, option_id: optionId }, { onConflict: "user_id,plan_date,meal" })
    : await sb.from("meal_plan").delete().eq("plan_date", date).eq("meal", meal);
  if (error) throw error;
}

// Rellena huecos sin tocar lo que ya está planificado.
export async function fillPlan(sb: SupabaseClient, userId: string, slots: { date: string; meal: Meal; optionId: string }[]) {
  if (slots.length === 0) return;
  const { error } = await sb
    .from("meal_plan")
    .upsert(slots.map((s) => ({ user_id: userId, plan_date: s.date, meal: s.meal, option_id: s.optionId })), { onConflict: "user_id,plan_date,meal", ignoreDuplicates: true });
  if (error) throw error;
}
