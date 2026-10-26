import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Goal, Goals, Sex } from "@/lib/nutrition";

export type Profile = {
  display_name: string | null;
  sex: Sex | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity: Activity | null;
  goal: Goal | null;
  water_goal_ml: number;
};

const PROFILE_COLS = "display_name, sex, birth_date, height_cm, weight_kg, activity, goal, water_goal_ml";

// Perfil y objetivos del usuario actual (RLS limita a su propia fila).
export async function loadProfile(sb: SupabaseClient): Promise<{ profile: Profile | null; goals: Goals | null }> {
  const [p, g] = await Promise.all([
    sb.from("profiles").select(PROFILE_COLS).maybeSingle(),
    sb.from("goals").select("kcal, protein_g, carbs_g, fat_g").maybeSingle(),
  ]);
  if (p.error) throw p.error;
  if (g.error) throw g.error;
  return { profile: p.data as Profile | null, goals: g.data as Goals | null };
}

// Solo los objetivos diarios (null si el usuario aún no los ha definido).
export async function loadGoals(sb: SupabaseClient): Promise<Goals | null> {
  const { data, error } = await sb.from("goals").select("kcal, protein_g, carbs_g, fat_g").maybeSingle();
  if (error) throw error;
  return data as Goals | null;
}

// Guarda perfil (update: la fila la crea el trigger) y, si se indican, los objetivos (upsert).
export async function saveProfile(sb: SupabaseClient, userId: string, profile: Profile, goals: Goals | null) {
  const p = await sb.from("profiles").update(profile).eq("id", userId);
  if (p.error) throw p.error;
  if (!goals) return;
  const g = await sb.from("goals").upsert({ user_id: userId, ...goals });
  if (g.error) throw g.error;
}
