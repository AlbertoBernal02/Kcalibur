import assert from "node:assert/strict";
import { test } from "node:test";
import { perServing, recipePer100, savedItemRows, servingGrams } from "./recipes.ts";
import { scaleMacros } from "./nutrition.ts";

// Receta: 200 g arroz (260 kcal) + 300 g pollo (495 kcal) = 500 g, 755 kcal, 4 raciones.
const items = [
  { grams: 200, kcal: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6 },
  { grams: 300, kcal: 495, protein_g: 93, carbs_g: 0, fat_g: 10.8 },
];

test("peso y valores por ración", () => {
  assert.equal(servingGrams(items, 4), 125);
  assert.deepEqual(perServing(items, 4), { kcal: 188.8, protein_g: 24.6, carbs_g: 14, fat_g: 2.9 });
});

test("per100 reescala: 1 ración (125 g) = valores por ración", () => {
  const m = scaleMacros(recipePer100(items), servingGrams(items, 4));
  assert.equal(Math.round(m.kcal), 189);
  assert.equal(Math.round(m.protein_g), 25);
});

test("receta vacía o con 0 raciones no produce NaN", () => {
  assert.deepEqual(recipePer100([]), { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  assert.equal(servingGrams(items, 0), 0);
  assert.equal(perServing(items, 0).kcal, 755);
});

test("savedItemRows: todas las filas con las mismas claves (external siempre presente)", () => {
  const base = { food_id: null, name: "x", grams: 10, serving_g: null, kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 };
  // Caso del fallo real: un elemento que ya existía (external: false) y uno nuevo sin esa clave.
  const rows = savedItemRows("u", "m", [{ ...base, external: false }, base, { ...base, external: true }]);
  const keys = (r: object) => Object.keys(r).sort().join(",");
  assert.equal(new Set(rows.map(keys)).size, 1);
  assert.deepEqual(rows.map((r) => r.external), [false, false, true]);
  assert.deepEqual(rows.map((r) => r.position), [0, 1, 2]);
  assert.equal(rows[1].user_id, "u");
  assert.equal(rows[1].saved_meal_id, "m");
});
