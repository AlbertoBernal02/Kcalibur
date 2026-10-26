// Ejecutar: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ageFromBirth, bmr, kcalFromMacros, suggestGoals, tdee } from "./nutrition.ts";

test("BMR Mifflin-St Jeor (hombre 30a, 80kg, 180cm)", () => {
  assert.equal(bmr("male", 80, 180, 30), 1780);
  assert.equal(bmr("female", 60, 165, 30), 1320.25);
});

test("TDEE aplica el factor de actividad", () => {
  assert.equal(tdee("male", 80, 180, 30, "moderate"), Math.round(1780 * 1.55));
});

test("edad respeta si ya cumplió años", () => {
  const hoy = new Date(2026, 5, 15); // 15-jun-2026
  assert.equal(ageFromBirth("1996-06-15", hoy), 30);
  assert.equal(ageFromBirth("1996-06-16", hoy), 29);
});

test("objetivos sugeridos: macros cuadran con las kcal", () => {
  const g = suggestGoals(2759, 80, "lose");
  assert.equal(g.kcal, 2207);
  assert.equal(g.protein_g, 160);
  assert.ok(Math.abs(kcalFromMacros(g) - g.kcal) <= 10);
});
