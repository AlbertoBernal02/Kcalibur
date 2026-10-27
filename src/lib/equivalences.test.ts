import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEquivalenceHints, cookedPer100Raw, equivalentGrams, findCounterpart, type FoodLike } from "./equivalences.ts";

const f = (name: string, state: FoodLike["state"], kcal: number, p: number, c: number, g: number): FoodLike => ({
  name, state, kcal_100g: kcal, protein_100g: p, carbs_100g: c, fat_100g: g,
});

const arrozCrudo = f("Arroz blanco", "raw", 360, 7, 79, 0.6);
const arrozCocido = f("Arroz blanco", "cooked", 130, 2.7, 28, 0.3);
const polloCrudo = f("Pechuga de pollo", "raw", 110, 23, 0, 1.2);
const polloCocido = f("Pechuga de pollo", "cooked", 165, 31, 0, 3.6);
const lomoCocido = f("Lomo de cerdo", "cooked", 200, 29, 0, 9);
const aceite = f("Aceite", null, 884, 0, 0, 100);

test("crudo -> cocinado conserva las kcal", () => {
  assert.equal(cookedPer100Raw(arrozCrudo, arrozCocido), 276.9); // el arroz absorbe agua
  assert.equal(cookedPer100Raw(polloCrudo, polloCocido), 66.7); // el pollo pierde agua
});

test("equivalencia por proteína entre pollo y lomo", () => {
  // 150 g de pollo cocinado = 46,5 g de proteína -> 160,3 g de lomo cocinado (29 g P por 100 g)
  assert.equal(equivalentGrams(polloCocido, 150, lomoCocido, "protein_g"), 160.3);
  assert.equal(equivalentGrams(polloCocido, 150, lomoCocido, "kcal"), 123.8);
});

test("si el otro alimento no aporta el nutriente, no hay equivalencia", () => {
  assert.equal(equivalentGrams(polloCocido, 100, aceite, "protein_g"), null);
  assert.equal(equivalentGrams(arrozCrudo, 100, polloCocido, "carbs_g"), null);
});

test("pareja crudo/cocinado", () => {
  const all = [arrozCrudo, arrozCocido, polloCocido];
  assert.equal(findCounterpart(arrozCocido, all), arrozCrudo);
  assert.equal(findCounterpart(arrozCrudo, all), arrozCocido);
  assert.equal(findCounterpart(polloCocido, all), null); // sin versión cruda en la lista
  assert.equal(findCounterpart(aceite, all), null);
});

test("pistas para la IA: rendimiento y equivalencias entre familias", () => {
  const hints = buildEquivalenceHints([arrozCrudo, arrozCocido, polloCocido, lomoCocido]);
  assert.ok(hints.some((h) => /Arroz blanco: 100 g crudo ≈ 276\.9 g cocinado/.test(h)));
  const pl = hints.find((h) => h.startsWith("Equivalencias entre Pechuga de pollo (cocinado) y Lomo de cerdo (cocinado)"));
  assert.ok(pl, "falta la línea pollo-lomo");
  // 100 g de pollo = 31 g P = 106,9 g de lomo (29 g P por 100 g), y a la inversa 93,5 g de pollo
  assert.match(pl, /100 g de Pechuga de pollo \(cocinado\) = 106\.9 g de Lomo de cerdo \(cocinado\)/);
  assert.match(pl, /100 g de Lomo de cerdo \(cocinado\) = 93\.5 g de Pechuga de pollo \(cocinado\)/);
});
