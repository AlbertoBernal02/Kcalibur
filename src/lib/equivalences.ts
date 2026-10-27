// Comparación y equivalencias entre alimentos (puro, sin red). Valores siempre por 100 g.

export type Metric = "kcal" | "protein_g" | "carbs_g" | "fat_g";
export type FoodLike = {
  name: string;
  state: "raw" | "cooked" | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

export const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "kcal", label: "calorías", unit: "kcal" },
  { id: "protein_g", label: "proteína", unit: "g" },
  { id: "carbs_g", label: "hidratos", unit: "g" },
  { id: "fat_g", label: "grasa", unit: "g" },
];

const value = (f: FoodLike, m: Metric): number =>
  m === "kcal" ? f.kcal_100g : m === "protein_g" ? f.protein_100g : m === "carbs_g" ? f.carbs_100g : f.fat_100g;

const round1 = (n: number) => Math.round(n * 10) / 10;

// Gramos de `b` que aportan lo mismo (en `metric`) que `grams` de `a`. null si `b` no aporta ese nutriente.
export function equivalentGrams(a: FoodLike, grams: number, b: FoodLike, metric: Metric): number | null {
  const per = value(b, metric);
  if (!(per > 0)) return null;
  return round1((grams * value(a, metric)) / per);
}

// Pareja crudo/cocinado del mismo alimento (mismo nombre, estado contrario), si existe en la lista.
export function findCounterpart<T extends FoodLike>(food: T, all: T[]): T | null {
  if (!food.state) return null;
  const other = food.state === "raw" ? "cooked" : "raw";
  return all.find((f) => f.name === food.name && f.state === other) ?? null;
}

// Gramos cocinados que resultan de 100 g crudos, conservando las kcal (la materia seca no cambia; cambia el agua).
// Ej.: arroz 360 kcal crudo / 130 cocido -> 277 g cocidos; pollo 110 / 165 -> 67 g (pierde agua al cocinar).
export function cookedPer100Raw(raw: FoodLike, cooked: FoodLike): number | null {
  return cooked.kcal_100g > 0 && raw.kcal_100g > 0 ? round1((100 * raw.kcal_100g) / cooked.kcal_100g) : null;
}

const stateLabel = { raw: "crudo", cooked: "cocinado" } as const;
export const labelOf = (f: Pick<FoodLike, "name" | "state">) => (f.state ? `${f.name} (${stateLabel[f.state]})` : f.name);

// Líneas de texto con equivalencias ya calculadas entre los alimentos dados (para dárselas al asistente de IA,
// que así no depende de hacer bien la aritmética): rendimiento crudo<->cocinado y equivalencias entre familias.
export function buildEquivalenceHints(foods: FoodLike[], maxPairs = 3): string[] {
  const lines: string[] = [];

  // Familias = nombre sin estado; para cada una con crudo y cocinado, el rendimiento.
  const families = new Map<string, FoodLike[]>();
  for (const f of foods) families.set(f.name, [...(families.get(f.name) ?? []), f]);
  for (const [name, fs] of families) {
    const raw = fs.find((f) => f.state === "raw"), cooked = fs.find((f) => f.state === "cooked");
    const y = raw && cooked ? cookedPer100Raw(raw, cooked) : null;
    if (y) lines.push(`${name}: 100 g crudo ≈ ${y} g cocinado (100 g cocinado ≈ ${round1(10000 / y)} g crudo), conservando las kcal.`);
  }

  // Entre familias distintas: se compara el mismo estado cuando se puede (cocinado antes que crudo).
  const rep = [...families.values()].map((fs) => fs.find((f) => f.state === "cooked") ?? fs[0]);
  let pairs = 0;
  for (let i = 0; i < rep.length && pairs < maxPairs; i++) {
    for (let j = i + 1; j < rep.length && pairs < maxPairs; j++) {
      const [a, b] = [rep[i], rep[j]];
      // Cada equivalencia en las dos direcciones y con los nombres completos: evita que el modelo las lea al revés.
      const eq = METRICS.flatMap((m) => {
        const ab = equivalentGrams(a, 100, b, m.id), ba = equivalentGrams(b, 100, a, m.id);
        return ab === null || ba === null ? [] : [`en ${m.label}: 100 g de ${labelOf(a)} = ${ab} g de ${labelOf(b)}; 100 g de ${labelOf(b)} = ${ba} g de ${labelOf(a)}`];
      });
      if (eq.length) {
        lines.push(`Equivalencias entre ${labelOf(a)} y ${labelOf(b)} (escala linealmente) — ${eq.join(" | ")}.`);
        pairs++;
      }
    }
  }
  return lines;
}
