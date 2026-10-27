import assert from "node:assert/strict";
import { test } from "node:test";
import { AOVE_PUFFS, aoveItem, needsAove, servingNamesFor } from "./serving.ts";

const aove = { id: "a", name: "AOVE en spray", kcal_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100, serving_g: 0.25 };

test("servingNamesFor: puffs para el spray, unidades para comida fuera, nada para el resto", () => {
  assert.deepEqual(servingNamesFor({ name: "AOVE en spray", category: "grasas" }), { one: "Puff", many: "Puffs", defaultCount: 10 });
  assert.deepEqual(servingNamesFor({ name: "Nigiri de salmón (pieza)", category: "comida_fuera" }), { one: "Unidad", many: "Unidades" });
  assert.equal(servingNamesFor({ name: "Aceite de oliva virgen extra", category: "grasas" }), undefined);
  assert.equal(servingNamesFor({ name: "Pechuga de pollo", category: "carne" }), undefined);
});

test("needsAove: carne y pescado sí; fruta, lácteos y otros no", () => {
  assert.equal(needsAove({ category: "carne" }), true);
  assert.equal(needsAove({ category: "pescado" }), true);
  for (const c of ["fruta", "lacteos", "cereales", "otros", "comida_fuera"]) assert.equal(needsAove({ category: c }), false, c);
});

test("aoveItem: 10 puffs = 2,5 g ≈ 22,1 kcal y 2,5 g de grasa", () => {
  const i = aoveItem(aove);
  assert.equal(AOVE_PUFFS, 10);
  assert.equal(i.grams, 2.5);
  assert.equal(i.serving_g, 0.25);
  assert.equal(i.kcal, 22.1);
  assert.equal(i.fat_g, 2.5);
  assert.equal(i.food_id, "a");
  assert.equal(aoveItem(aove, 20).grams, 5); // 20 puffs = 5 g (el dato del nutricionista)
  assert.equal(aoveItem({ ...aove, serving_g: null }).grams, 2.5); // sin ración guardada usa 0,25 g por puff
});
