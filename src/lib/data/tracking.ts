import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayTotals } from "@/lib/stats";

export type WeightPoint = { date: string; value: number };

export const DEFAULT_WATER_GOAL = 2000;

// Pesos desde una fecha, de más antiguo a más reciente.
export async function loadWeights(sb: SupabaseClient, from: string): Promise<WeightPoint[]> {
  const { data, error } = await sb.from("weight_logs").select("log_date, weight_kg").gte("log_date", from).order("log_date");
  if (error) throw error;
  return data.map((r) => ({ date: r.log_date as string, value: Number(r.weight_kg) }));
}

// Un peso por día: registrar de nuevo el mismo día lo sobrescribe.
export async function saveWeight(sb: SupabaseClient, userId: string, date: string, kg: number) {
  const { error } = await sb.from("weight_logs").upsert({ user_id: userId, log_date: date, weight_kg: kg });
  if (error) throw error;
}

export async function deleteWeight(sb: SupabaseClient, date: string) {
  const { error } = await sb.from("weight_logs").delete().eq("log_date", date);
  if (error) throw error;
}

// ml bebidos en un día y objetivo diario.
export async function loadWater(sb: SupabaseClient, date: string): Promise<{ ml: number; goal: number }> {
  const [w, p] = await Promise.all([
    sb.from("water_logs").select("ml").eq("log_date", date).maybeSingle(),
    sb.from("profiles").select("water_goal_ml").maybeSingle(),
  ]);
  if (w.error) throw w.error;
  if (p.error) throw p.error;
  return { ml: w.data?.ml ?? 0, goal: p.data?.water_goal_ml ?? DEFAULT_WATER_GOAL };
}

// Fija el total del día (el cliente calcula el nuevo valor; nunca baja de 0).
export async function setWater(sb: SupabaseClient, userId: string, date: string, ml: number) {
  const { error } = await sb.from("water_logs").upsert({ user_id: userId, log_date: date, ml: Math.max(0, Math.round(ml)) });
  if (error) throw error;
}

// Totales por día de un rango (función SQL daily_totals, con RLS).
export async function loadDailyTotals(sb: SupabaseClient, from: string, to: string): Promise<DayTotals[]> {
  const { data, error } = await sb.rpc("daily_totals", { from_date: from, to_date: to });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((r) => ({
    date: r.entry_date as string,
    kcal: Number(r.kcal),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
  }));
}
