import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEstimate } from "./estimate.ts";

const ok = '{"items":[{"name":"Tacos ×6","kcal":900,"protein_g":40,"carbs_g":90,"fat_g":40},{"name":"Cerveza","kcal":"86","protein_g":0.5,"carbs_g":"7,2","fat_g":0}],"kcal_min":850,"kcal_max":1200}';

test("parseEstimate lee JSON limpio", () => {
  const e = parseEstimate(ok)!;
  assert.equal(e.items.length, 2);
  assert.equal(e.items[1].kcal, 86); // acepta números como texto
  assert.equal(e.items[1].carbs_g, 7.2); // y con coma
  assert.equal(e.kcal_min, 850);
  assert.equal(e.kcal_max, 1200);
});

test("parseEstimate tolera ```json y texto alrededor", () => {
  assert.equal(parseEstimate("Claro:\n```json\n" + ok + "\n```\nSuerte")!.items.length, 2);
});

test("parseEstimate descarta elementos inválidos y limita el tamaño", () => {
  const e = parseEstimate('{"items":[{"name":"","kcal":100},{"name":"Malo","kcal":-5},{"name":"Enorme","kcal":99999},{"name":"Bien","kcal":300}],"kcal_min":1,"kcal_max":2}')!;
  assert.deepEqual(e.items.map((i) => i.name), ["Bien"]);
  assert.equal(e.kcal_min, 1);
  assert.equal(e.kcal_max, 300); // el rango siempre contiene la suma
});

test("parseEstimate: rango por defecto y respuestas inservibles", () => {
  const e = parseEstimate('{"items":[{"name":"A","kcal":1000}]}')!;
  assert.equal(e.kcal_min, 850);
  assert.equal(e.kcal_max, 1150);
  assert.deepEqual(parseEstimate('{"items":[]}')!.items, []);
  assert.equal(parseEstimate("no es json"), null);
  assert.equal(parseEstimate('{"foo":1}'), null);
  assert.equal(parseEstimate("{roto"), null);
});

test("parseEstimate corta a 10 elementos", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ name: `P${i}`, kcal: 10 }));
  assert.equal(parseEstimate(JSON.stringify({ items: many }))!.items.length, 10);
});
