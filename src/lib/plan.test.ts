import assert from "node:assert/strict";
import { test } from "node:test";
import { baseName, mondayOf, shoppingList, weekDays } from "./plan.ts";

test("mondayOf devuelve el lunes de cualquier día de la semana", () => {
  assert.equal(mondayOf("2026-10-26"), "2026-10-26"); // lunes
  assert.equal(mondayOf("2026-10-27"), "2026-10-26"); // martes
  assert.equal(mondayOf("2026-11-01"), "2026-10-26"); // domingo
  assert.equal(mondayOf("2026-11-02"), "2026-11-02"); // siguiente lunes (cruza de mes)
  assert.equal(mondayOf("2027-01-01"), "2026-12-28"); // cruza de año
});

test("weekDays: 7 días de lunes a domingo", () => {
  const w = weekDays("2026-10-26");
  assert.equal(w.length, 7);
  assert.deepEqual([w[0], w[6]], ["2026-10-26", "2026-11-01"]);
});

test("baseName quita las alternativas entre paréntesis", () => {
  assert.equal(baseName("Pollo cocinado (o pavo, ternera o tortilla de 3 huevos)"), "Pollo cocinado");
  assert.equal(baseName("Arroz cocido (o 300 g de patata hervida)"), "Arroz cocido");
  assert.equal(baseName("Una pieza de fruta (o yogur proteico)"), "Una pieza de fruta");
  assert.equal(baseName("Leche desnatada 250 ml (o 500 g de queso fresco batido)"), "Leche desnatada");
  assert.equal(baseName("Merluza"), "Merluza");
  assert.equal(baseName("Plátano mediano (120 g)"), "Plátano mediano (120 g)"); // paréntesis que no son alternativas
});

test("shoppingList suma por alimento, agrupa por id y ordena", () => {
  const list = shoppingList([
    { food_id: "pollo", name: "Pollo cocinado (o pavo)", grams: 150 },
    { food_id: "arroz", name: "Arroz cocido (o patata)", grams: 150 },
    { food_id: "pollo", name: "Pechuga de pollo o pavo", grams: 150 }, // mismo alimento con otro nombre
    { food_id: null, name: "Bagel", grams: 90 },
    { food_id: null, name: "bagel", grams: 90 }, // sin id: se agrupa por nombre sin mayúsculas
    { food_id: "arroz", name: "Arroz cocido (o patata)", grams: 0.25 },
  ]);
  assert.deepEqual(list.map((l) => [l.name, l.grams]), [["Arroz cocido", 150.3], ["Bagel", 180], ["Pollo cocinado", 300]]);
  assert.deepEqual(shoppingList([]), []);
});
