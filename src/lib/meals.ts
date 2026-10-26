export type Meal = "breakfast" | "lunch" | "snack" | "dinner" | "extras";

export const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "Desayuno" },
  { id: "lunch", label: "Almuerzo" },
  { id: "snack", label: "Merienda" },
  { id: "dinner", label: "Cena" },
  { id: "extras", label: "Snacks" },
];

// Fecha local como "YYYY-MM-DD" (toISOString usaría UTC y desfasaría el día).
export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Suma días a una fecha "YYYY-MM-DD" (mediodía evita saltos por cambio horario).
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + days, 12));
}

// "Hoy", "Ayer", "Mañana" o "lunes, 26 de octubre".
export function dayLabel(iso: string, today = toISO(new Date())): string {
  if (iso === today) return "Hoy";
  if (iso === addDays(today, -1)) return "Ayer";
  if (iso === addDays(today, 1)) return "Mañana";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, d));
}
