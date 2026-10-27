// Normalización de productos de Open Food Facts (pura, sin red: se prueba con fixtures).

export type OffProduct = {
  code: string;
  name: string;
  brand: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  serving_g: number | null;
};

// Un producto es utilizable en el diario solo si tiene kcal y los tres macros.
export const isComplete = (p: OffProduct) => [p.kcal, p.protein, p.carbs, p.fat].every((v) => v !== null);

// Número válido (acepta strings numéricos, que OFF mezcla con números) o null.
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// Redondea a 1 decimal y descarta lo que no cabe en las restricciones de la BD (0..max).
function bounded(v: number | null, max: number): number | null {
  return v !== null && v >= 0 && v <= max ? Math.round(v * 10) / 10 : null;
}

// `brands` llega como array en el buscador y como "A, B" en el endpoint de producto.
function firstBrand(v: unknown): string | null {
  const first = Array.isArray(v) ? v[0] : typeof v === "string" ? v.split(",")[0] : null;
  return typeof first === "string" && first.trim() ? first.trim().slice(0, 80) : null;
}

const KJ_PER_KCAL = 4.184;

// Convierte un producto crudo de la API; devuelve null si no es aprovechable (sin código o sin nombre).
export function toOffProduct(raw: Record<string, unknown>): OffProduct | null {
  const code = String(raw.code ?? "");
  const name = String(raw.product_name_es || raw.product_name || "").trim().slice(0, 120);
  if (!/^\d{6,14}$/.test(code) || !name) return null;

  const n = (raw.nutriments ?? {}) as Record<string, unknown>;
  // Algunos productos solo traen kJ (energy_100g está en kJ): se convierte a kcal.
  const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
  const kcal = num(n["energy-kcal_100g"]) ?? (kj !== null ? kj / KJ_PER_KCAL : null);
  const serving = num(raw.serving_quantity);

  return {
    code,
    name,
    brand: firstBrand(raw.brands),
    kcal: bounded(kcal, 950),
    protein: bounded(num(n["proteins_100g"]), 100),
    carbs: bounded(num(n["carbohydrates_100g"]), 100),
    fat: bounded(num(n["fat_100g"]), 100),
    serving_g: serving !== null && serving > 0 && serving <= 2000 ? Math.round(serving * 10) / 10 : null,
  };
}

// Valores del formulario de alimento (texto) a partir de un producto de OFF; solo los campos que existen.
export function offPrefill(p: OffProduct): Record<string, string> {
  const out: Record<string, string> = { name: p.name, barcode: p.code };
  if (p.brand) out.brand = p.brand;
  if (p.kcal !== null) out.kcal = String(p.kcal);
  if (p.protein !== null) out.protein = String(p.protein);
  if (p.carbs !== null) out.carbs = String(p.carbs);
  if (p.fat !== null) out.fat = String(p.fat);
  if (p.serving_g !== null) out.serving = String(p.serving_g);
  return out;
}
