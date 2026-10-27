import assert from "node:assert/strict";
import { test } from "node:test";
import { isComplete, offPrefill, toOffProduct } from "./off.ts";

test("producto completo (endpoint de producto: brands string, números como string)", () => {
  const p = toOffProduct({
    code: "3017620422003",
    product_name: "Nutella",
    brands: "Nutella, Ferrero",
    serving_quantity: "15",
    nutriments: { "energy-kcal_100g": 539, proteins_100g: "6.3", carbohydrates_100g: 57.5, fat_100g: 30.9 },
  })!;
  assert.deepEqual(p, {
    code: "3017620422003", name: "Nutella", brand: "Nutella", kcal: 539,
    protein: 6.3, carbs: 57.5, fat: 30.9, serving_g: 15,
  });
  assert.ok(isComplete(p));
});

test("hit del buscador: brands array y nombre en español", () => {
  const p = toOffProduct({
    code: "8480000105424", product_name: "Milk", product_name_es: "Leche semidesnatada Hacendado",
    brands: ["Hacendado"], nutriments: { "energy-kcal_100g": 46, proteins_100g: 3.1, carbohydrates_100g: 4.8, fat_100g: 1.6 },
  })!;
  assert.equal(p.name, "Leche semidesnatada Hacendado");
  assert.equal(p.brand, "Hacendado");
});

test("solo kJ: se convierte a kcal", () => {
  const p = toOffProduct({ code: "12345678", product_name: "X", nutriments: { "energy-kj_100g": 418.4 } })!;
  assert.equal(p.kcal, 100);
  assert.ok(!isComplete(p)); // faltan macros
});

test("sin nutrientes = incompleto, no inventa ceros", () => {
  const p = toOffProduct({ code: "12345678", product_name: "Sin datos" })!;
  assert.deepEqual([p.kcal, p.protein, p.carbs, p.fat], [null, null, null, null]);
  assert.ok(!isComplete(p));
});

test("valores fuera de rango se descartan (la BD los rechazaría)", () => {
  const p = toOffProduct({
    code: "12345678", product_name: "Mal",
    nutriments: { "energy-kcal_100g": 5000, proteins_100g: 120, carbohydrates_100g: -3, fat_100g: 10 },
  })!;
  assert.deepEqual([p.kcal, p.protein, p.carbs, p.fat], [null, null, null, 10]);
});

test("sin nombre o con código inválido se descarta", () => {
  assert.equal(toOffProduct({ code: "12345678", product_name: "  " }), null);
  assert.equal(toOffProduct({ code: "abc", product_name: "X" }), null);
});

test("offPrefill devuelve solo los campos que existen, como texto", () => {
  const full = offPrefill({ code: "8480000123456", name: "Espagueti", brand: "Hacendado", kcal: 358, protein: 12.5, carbs: 71, fat: 1.5, serving_g: 80 });
  assert.deepEqual(full, { name: "Espagueti", barcode: "8480000123456", brand: "Hacendado", kcal: "358", protein: "12.5", carbs: "71", fat: "1.5", serving: "80" });
  const partial = offPrefill({ code: "8480000123456", name: "Raro", brand: null, kcal: null, protein: null, carbs: null, fat: null, serving_g: null });
  assert.deepEqual(partial, { name: "Raro", barcode: "8480000123456" });
});
