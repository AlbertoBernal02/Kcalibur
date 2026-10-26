import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSelection, normalizeSelection, optionsBySlot, summarizeDay, type OptionLike } from "./diet.ts";

const opt = (id: string, dietMeal: OptionLike["dietMeal"], kcal: number, p = 0): OptionLike => ({
  id, dietMeal, items: [{ grams: 100, kcal, protein_g: p, carbs_g: 0, fat_g: 0 }],
});

const options = [
  opt("d1", "breakfast", 300, 10),
  opt("d2", "breakfast", 450, 20),
  opt("a1", "lunch", 700, 40),
  opt("c1", "dinner", 500, 30),
  opt("c2", "dinner", 350, 25),
];

test("agrupa por comida y deja vacías las que no tienen opciones", () => {
  const g = optionsBySlot(options);
  assert.deepEqual(g.breakfast.map((o) => o.id), ["d1", "d2"]);
  assert.deepEqual(g.snack, []);
});

test("selección por defecto = primera opción de cada comida", () => {
  assert.deepEqual(defaultSelection(options), { breakfast: "d1", lunch: "a1", dinner: "c1" });
});

test("día tipo: suma lo elegido y da el rango mín-máx", () => {
  const s = summarizeDay(options, { breakfast: "d2", lunch: "a1", dinner: "c2" });
  assert.equal(s.chosen.kcal, 450 + 700 + 350);
  assert.equal(s.chosen.protein_g, 20 + 40 + 25);
  assert.equal(s.minKcal, 300 + 700 + 350);
  assert.equal(s.maxKcal, 450 + 700 + 500);
  assert.equal(s.slotsWithOptions, 3);
});

test("una comida sin elegir no suma pero sí cuenta en el rango", () => {
  const s = summarizeDay(options, { breakfast: "d1" });
  assert.equal(s.chosen.kcal, 300);
  assert.equal(s.maxKcal, 450 + 700 + 500);
});

test("normalizeSelection descarta opciones borradas y completa las que faltan", () => {
  const sel = normalizeSelection(options, { breakfast: "borrada", dinner: "c2" });
  assert.deepEqual(sel, { breakfast: "d1", lunch: "a1", dinner: "c2" });
});

test("dieta vacía: todo a cero sin NaN", () => {
  const s = summarizeDay([], {});
  assert.deepEqual([s.chosen.kcal, s.minKcal, s.maxKcal, s.slotsWithOptions], [0, 0, 0, 0]);
});
