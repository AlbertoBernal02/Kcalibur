import { addDays } from "./meals.ts";

// Lunes de la semana a la que pertenece una fecha "YYYY-MM-DD".
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d, 12).getDay(); // 0 = domingo
  return addDays(iso, -((dow + 6) % 7));
}

// Los 7 días (lunes a domingo) de la semana que empieza en `monday`.
export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

// Nombre sin las alternativas del plan ni la cantidad que lleve escrita al final:
// "Pollo cocinado (o pavo, ternera…)" → "Pollo cocinado"; "Leche desnatada 250 ml" → "Leche desnatada".
export const baseName = (name: string): string =>
  name.split(/\s\(o\s/i)[0].replace(/\s+\d+([.,]\d+)?\s?(ml|g|kg|l)$/i, "").trim();

export type ShopItem = { food_id: string | null; name: string; grams: number };
export type ShopLine = { key: string; name: string; grams: number };

// Lista de la compra: suma los gramos por alimento (por id; si no tiene, por nombre) y ordena alfabéticamente.
// Los gramos son los de la dieta (normalmente en cocinado); la lista no convierte crudo/cocinado.
export function shoppingList(items: ShopItem[]): ShopLine[] {
  const lines = new Map<string, ShopLine>();
  for (const it of items) {
    const name = baseName(it.name);
    const key = it.food_id ?? `n:${name.toLowerCase()}`;
    const line = lines.get(key);
    if (line) line.grams += it.grams;
    else lines.set(key, { key, name, grams: it.grams });
  }
  return [...lines.values()]
    .map((l) => ({ ...l, grams: Math.round(l.grams * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
