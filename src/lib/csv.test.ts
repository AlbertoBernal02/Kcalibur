import assert from "node:assert/strict";
import { test } from "node:test";
import { toCsv } from "./csv.ts";

const cols = [
  { header: "nombre", value: (r: { n: string; k: number | null }) => r.n },
  { header: "kcal", value: (r: { n: string; k: number | null }) => r.k },
];

test("separador ; y coma decimal", () => {
  assert.equal(toCsv(cols, [{ n: "Arroz", k: 130.5 }, { n: "Pan", k: 265 }]), "nombre;kcal\r\nArroz;130,5\r\nPan;265");
});

test("quoting de ; comillas y saltos de línea", () => {
  const csv = toCsv(cols, [{ n: 'Pan; "integral"\nrústico', k: 1 }]);
  assert.equal(csv, 'nombre;kcal\r\n"Pan; ""integral""\nrústico";1');
});

test("null y undefined salen vacíos", () => {
  assert.equal(toCsv(cols, [{ n: "X", k: null }]), "nombre;kcal\r\nX;");
});

test("inyección de fórmulas: se neutralizan textos peligrosos pero no los números negativos", () => {
  const csv = toCsv(cols, [{ n: '=HYPERLINK("http://malo")', k: -5 }, { n: "+cmd", k: 1 }, { n: "@SUM(1)", k: 1 }, { n: "-1+1", k: 1 }]);
  const lines = csv.split("\r\n").slice(1);
  assert.equal(lines[0], `"'=HYPERLINK(""http://malo"")";-5`);
  assert.equal(lines[1], "'+cmd;1");
  assert.equal(lines[2], "'@SUM(1);1");
  assert.equal(lines[3], "'-1+1;1");
});

test("sin filas solo cabecera", () => {
  assert.equal(toCsv(cols, []), "nombre;kcal");
});
