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

// "Hoy", "Ayer", "Mañana" o null si no es un día relativo.
export function relativeLabel(iso: string, today: string): string | null {
  if (iso === today) return "Hoy";
  if (iso === addDays(today, -1)) return "Ayer";
  if (iso === addDays(today, 1)) return "Mañana";
  return null;
}

// "lunes, 26 de octubre" (con año si se pide).
export function longDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", ...(withYear && { year: "numeric" }),
  }).format(new Date(y, m - 1, d));
}

// Título del día: relativo si procede, si no la fecha larga.
export const dayLabel = (iso: string, today: string) => relativeLabel(iso, today) ?? longDate(iso);
