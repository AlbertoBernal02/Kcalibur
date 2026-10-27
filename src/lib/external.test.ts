import assert from "node:assert/strict";
import { test } from "node:test";
import { outsideEntry, parseAmount, scaleDish } from "./external.ts";

test("parseAmount acepta coma y punto y rechaza lo no válido", () => {
  assert.equal(parseAmount("12,5", 100), 12.5);
  assert.equal(parseAmount(" 7.25 ", 100), 7.25);
  assert.equal(parseAmount("", 100), null);
  assert.equal(parseAmount("", 100, true), 0);
  assert.equal(parseAmount("-1", 100), null);
  assert.equal(parseAmount("abc", 100), null);
  assert.equal(parseAmount("101", 100), null);
});

test("outsideEntry guarda totales, 1 ración y marca fuera", () => {
  const e = outsideEntry({ name: "  Pizza Domino's ", kcal: 1203.46, protein_g: 40, carbs_g: 150.04, fat_g: 44 }, "2026-10-27", "dinner");
  assert.equal(e.name, "Pizza Domino's");
  assert.equal(e.kcal, 1203.5);
  assert.equal(e.grams, 1);
  assert.equal(e.food_id, null);
  assert.equal(e.external, true);
  assert.equal(e.carbs_g, 150);
});

test("scaleDish escala kcal y macros", () => {
  const d = scaleDish({ name: "x", kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5 }, 1.5);
  assert.deepEqual(d, { name: "x", kcal: 150, protein_g: 15, carbs_g: 30, fat_g: 7.5 });
});
