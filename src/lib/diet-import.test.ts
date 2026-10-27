import assert from "node:assert/strict";
import { test } from "node:test";
import { looksDegenerate, parseDietImport } from "./ai/diet-import.ts";
import { buildOptions, matchFood, type CatalogFood } from "./diet-import.ts";

const f = (id: string, name: string, state: CatalogFood["state"], kcal: number): CatalogFood => ({ id, name, state, kcal_100g: kcal, protein_100g: 1, carbs_100g: 2, fat_100g: 3 });
const foods = [
  f("pasta-raw", "Pasta", "raw", 355), f("pasta-cooked", "Pasta", "cooked", 158), f("pasta-int", "Pasta integral", "cooked", 150),
  f("arroz-cooked", "Arroz blanco", "cooked", 130), f("arroz-raw", "Arroz blanco", "raw", 360),
  f("pechuga", "Pechuga de pollo", "cooked", 165), f("merluza", "Merluza", "cooked", 100), f("leche", "Leche desnatada", null, 35),
  f("queso", "Queso fresco batido 0%", null, 46), f("aove", "Aceite de oliva virgen extra", null, 884),
];

test("matchFood: nombre exacto, estado y alternativas entre paréntesis", () => {
  assert.equal(matchFood("Pasta cocida (o 120 g de ñoquis o 150 g de arroz)", foods)?.id, "pasta-cooked");
  assert.equal(matchFood("Pasta", foods)?.id, "pasta-raw"); // sin estado: a igualdad gana el de estado vacío o el primero más corto
  assert.equal(matchFood("Arroz cocido (o 300 g de patata hervida)", foods)?.id, "arroz-cooked"); // "arroz" ⊂ "Arroz blanco", y cocinado
  assert.equal(matchFood("Merluza (o 150 g de pollo/pavo)", foods)?.id, "merluza");
  assert.equal(matchFood("Leche desnatada 250 ml (o 500 g de queso fresco batido)", foods)?.id, "leche");
  assert.equal(matchFood("Queso fresco batido 0% (o yogur proteico 0%)", foods)?.id, "queso");
});

test("matchFood: una palabra suelta puede estar contenida; lo dudoso no se asocia", () => {
  assert.equal(matchFood("Pollo cocinado (o pavo)", foods)?.id, "pechuga");
  assert.equal(matchFood("Una pieza de fruta (o yogur proteico)", foods), null);
  assert.equal(matchFood("Ab", foods), null);
});

test("buildOptions: usa los valores del catálogo si hay coincidencia y los de la IA si no", () => {
  const parsed = parseDietImport(JSON.stringify({
    name: "Plan", notes: "",
    options: [{ meal: "lunch", name: "Comida 2", items: [
      { name: "Pasta cocida", grams: 150, kcal_100g: 300, protein_100g: 9, carbs_100g: 9, fat_100g: 9 },
      { name: "Bagel", grams: 90, kcal_100g: 270, protein_100g: 10, carbs_100g: 50, fat_100g: 2 },
    ] }],
  }))!;
  const [opt] = buildOptions(parsed, foods);
  assert.deepEqual(opt.items.map((i) => [i.food_id, i.estimated, i.kcal]), [["pasta-cooked", false, 237], [null, true, 243]]);
});

test("parseDietImport: lee JSON con ```, descarta lo inválido y normaliza", () => {
  const raw = "Aquí va:\n```json\n" + JSON.stringify({
    name: "  Plan   octubre ", notes: 5,
    options: [
      { meal: "breakfast", name: "Opción 1", items: [
        { name: "Pollo", grams: "150", kcal_100g: "165", protein_100g: 31, carbs_100g: 0, fat_100g: 3.6 },
        { name: "", grams: 10, kcal_100g: 1, protein_100g: 1, carbs_100g: 1, fat_100g: 1 }, // sin nombre
        { name: "Absurdo", grams: 10, kcal_100g: 5000, protein_100g: 1, carbs_100g: 1, fat_100g: 1 }, // kcal imposibles
      ] },
      { meal: "brunch", name: "Rara", items: [{ name: "x", grams: 1, kcal_100g: 1, protein_100g: 1, carbs_100g: 1, fat_100g: 1 }] }, // comida inválida
      { meal: "dinner", name: "Vacía", items: [] },
    ],
  }) + "\n```";
  const d = parseDietImport(raw)!;
  assert.equal(d.name, "Plan octubre");
  assert.equal(d.notes, "");
  assert.equal(d.options.length, 1);
  assert.deepEqual(d.options[0].items.map((i) => [i.name, i.grams, i.kcal_100g]), [["Pollo", 150, 165]]);
  assert.equal(parseDietImport("no es json"), null);
  assert.equal(parseDietImport('{"name":"x"}'), null);
  assert.deepEqual(parseDietImport('{"options":[]}')!.options, []);
});

test("looksDegenerate: más de la mitad de alimentos a cero = respuesta degradada", () => {
  const item = (k: number) => ({ name: "x", grams: 100, kcal_100g: k, protein_100g: k ? 1 : 0, carbs_100g: 0, fat_100g: 0 });
  const dieta = (...ks: number[]) => ({ name: "d", notes: "", options: [{ meal: "lunch" as const, name: "o", items: ks.map(item) }] });
  assert.equal(looksDegenerate(dieta(0, 0, 0, 120)), true);
  assert.equal(looksDegenerate(dieta(0, 100, 120, 80)), false); // un cero suelto (agua, etc.) es normal
  assert.equal(looksDegenerate(dieta(0, 0, 100, 120)), false); // justo la mitad: aún válido
  assert.equal(looksDegenerate({ name: "d", notes: "", options: [] }), false);
});
