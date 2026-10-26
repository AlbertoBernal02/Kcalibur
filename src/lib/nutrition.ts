export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "high" | "extreme";
export type Goal = "lose" | "maintain" | "gain";

export type Goals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

// Factor sobre el metabolismo basal según el nivel de actividad.
export const ACTIVITY: Record<Activity, { label: string; hint: string; factor: number }> = {
  sedentary: { label: "Sedentario", hint: "Poco o ningún ejercicio", factor: 1.2 },
  light: { label: "Ligero", hint: "1-3 días de ejercicio/semana", factor: 1.375 },
  moderate: { label: "Moderado", hint: "3-5 días/semana", factor: 1.55 },
  high: { label: "Alto", hint: "6-7 días/semana", factor: 1.725 },
  extreme: { label: "Muy alto", hint: "Trabajo físico + entreno diario", factor: 1.9 },
};

// Ajuste calórico según objetivo: déficit 20 %, mantenimiento, superávit 10 %.
export const GOAL: Record<Goal, { label: string; factor: number; proteinPerKg: number }> = {
  lose: { label: "Perder grasa", factor: 0.8, proteinPerKg: 2 },
  maintain: { label: "Mantener", factor: 1, proteinPerKg: 1.8 },
  gain: { label: "Ganar músculo", factor: 1.1, proteinPerKg: 1.8 },
};

// Edad en años cumplidos a partir de "YYYY-MM-DD".
export function ageFromBirth(birth: string, today = new Date()): number {
  const [y, m, d] = birth.split("-").map(Number);
  const had = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  return today.getFullYear() - y - (had ? 0 : 1);
}

// Metabolismo basal (Mifflin-St Jeor).
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

// Gasto energético diario total.
export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: Activity): number {
  return Math.round(bmr(sex, weightKg, heightCm, age) * ACTIVITY[activity].factor);
}

// Objetivos sugeridos: proteína por kg, grasa 25 % de las kcal, resto hidratos.
export function suggestGoals(tdeeKcal: number, weightKg: number, goal: Goal): Goals {
  const kcal = Math.round(tdeeKcal * GOAL[goal].factor);
  const protein_g = Math.round(weightKg * GOAL[goal].proteinPerKg);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  return { kcal, protein_g, carbs_g, fat_g };
}

// Calorías que aportan unos macros (4/4/9 kcal por gramo).
export const kcalFromMacros = (g: Goals) => g.protein_g * 4 + g.carbs_g * 4 + g.fat_g * 9;
