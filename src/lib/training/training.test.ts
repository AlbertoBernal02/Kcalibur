import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parseGrids, parseRange, niceName, type Grid } from "./import-grid.ts";
import { est1RM, parseLog, splitRest } from "./log.ts";
import { readWorkbook } from "./xlsx-read.ts";

test("parseLog entiende los formatos del Excel", () => {
  assert.deepEqual(parseLog("20 x 19"), { weight: 20, reps: 19, rir: null });
  assert.deepEqual(parseLog("12,5 xlado x 18 "), { weight: 12.5, reps: 18, rir: null });
  assert.deepEqual(parseLog("65 x 15 rir 2"), { weight: 65, reps: 15, rir: 2 });
  assert.deepEqual(parseLog("70 x 15 fallo"), { weight: 70, reps: 15, rir: 0 });
  assert.deepEqual(parseLog("100 x (60 x 10 rir 1-2)"), { weight: 60, reps: 10, rir: 1 }); // peso real entre paréntesis
  assert.deepEqual(parseLog("80 x 7 + 32,5 x 10 + 20 x 13"), { weight: 80, reps: 7, rir: null }); // solo la primera
  assert.deepEqual(parseLog("24"), { weight: null, reps: 24, rir: null }); // número suelto = reps
  assert.deepEqual(parseLog("15 x "), { weight: null, reps: null, rir: null }); // plantilla sin rellenar
  assert.deepEqual(parseLog(""), { weight: null, reps: null, rir: null });
});

test("splitRest lee minutos y segundos y devuelve el resto del texto", () => {
  assert.deepEqual(splitRest("DESCANSO 2'"), { seconds: 120, rest: "" });
  assert.deepEqual(splitRest('DESCANSO 1\'30"'), { seconds: 90, rest: "" });
  assert.deepEqual(splitRest('DESCANSO 45"'), { seconds: 45, rest: "" });
  assert.deepEqual(splitRest("TECHNOGYM AMARILLA | DESCANSO 2'"), { seconds: 120, rest: "TECHNOGYM AMARILLA |" });
  assert.deepEqual(splitRest("BANCO A 30º"), { seconds: null, rest: "BANCO A 30º" });
});

test("est1RM (Epley) y niceName", () => {
  assert.equal(est1RM(100, 1), 100);
  assert.equal(Math.round(est1RM(100, 10)), 133);
  assert.equal(niceName("PRENSA INCLINADA UNILATERAL"), "Prensa inclinada unilateral");
  assert.equal(niceName("RDL MÁQUINA"), "RDL máquina");
  assert.equal(niceName("CURL FEMORAL SENTADO BANCO 3 PIES AL 5"), "Curl femoral sentado banco 3 pies al 5");
  assert.equal(niceName("CUADS-ADUCTORES"), "Cuads-aductores");
});

// Hoja sintética con las rarezas del Excel real: nombre en A:B, nota ancha A:D, filas "-" y registros vacíos.
function sheet(name: string, cells: Record<string, string>, merges: string[]): Grid {
  const grid: string[][] = Array.from({ length: 30 }, () => []);
  for (const [ref, v] of Object.entries(cells)) {
    const [r, c] = parseRange(ref);
    grid[r][c] = v;
  }
  return { name, cells: grid, merges: merges.map(parseRange) };
}

const monday = sheet(
  "CUADS-ADUCTORES LUNES",
  {
    E1: "SEMANA 1", J1: "SEMANA 2", AI1: "VÍDEO DE EJERCICIOS", A4: "EJERCICIO",
    A6: "GEMELOS", C6: "DESCANSO 2'", A8: '1" ARRIBA',
    E6: "1", F6: "15 - 20", G6: "0", H6: "20 x 19", J6: "1", K6: "15", L6: "0", M6: "20 x 20 rir 3",
    E7: "1", F7: "15 - 20", G7: "0", H7: "20 x 18", J7: "1", K7: "15", L7: "0", M7: "15 x ", // semana 2 sin rellenar
    E8: "1", F8: "15 - 20", G8: "0",
    E9: "1", F9: "15 - 20", G9: "0",
    A10: "ADUCTORES", C10: "DESCANSO 1'30\"", A12: "DESCANSO 2'30\"", AI10: "https://youtu.be/abc",
    E10: "1", F10: "15", G10: "1", H10: "80 x 9",
    E11: "1", F11: "15", G11: "0", H11: "65 x 11",
    E12: "-", F12: "-", G12: "-", H12: "DESCANSO 2'", // fila de descanso: no es una serie
  },
  ["A6:B7", "C6:D7", "A8:D9", "A10:B11", "C10:D11", "A12:D12", "AI10:AM12"],
);

test("parseGrids separa ejercicios, notas, descansos y series", () => {
  const p = parseGrids([monday, sheet("sin cabecera", { A1: "hola" }, [])])!;
  assert.equal(p.weeks, 2);
  assert.equal(p.days.length, 1); // la hoja sin estructura se ignora
  assert.deepEqual([p.days[0].name, p.days[0].weekday], ["Cuads-aductores", 1]);

  const [gem, adu] = p.days[0].exercises;
  assert.equal(gem.name, "Gemelos");
  assert.equal(gem.restSeconds, 120);
  assert.equal(gem.notes, '1" ARRIBA'); // la nota ancha pasa a notas del ejercicio anterior
  assert.equal(gem.plan[1].length, 4);
  assert.deepEqual(gem.plan[1][0], { reps: "15 - 20", rir: "0" });

  assert.equal(adu.restSeconds, 90);
  assert.equal(adu.videoUrl, "https://youtu.be/abc");
  assert.equal(adu.plan[1].length, 2); // la fila "-" no cuenta
});

test("el histórico solo incluye series realmente registradas", () => {
  const [gem, adu] = parseGrids([monday])!.days[0].exercises;
  const sorted = [...gem.history].sort((a, b) => a.week - b.week || a.setIndex - b.setIndex);
  assert.deepEqual(sorted.map((h) => [h.week, h.setIndex, h.weight, h.reps]), [
    [1, 0, 20, 19],
    [1, 1, 20, 18],
    [2, 0, 20, 20],
  ]); // "15 x " de la semana 2 no cuenta
  assert.equal(sorted[2].rir, 3);
  assert.deepEqual(adu.history.map((h) => [h.weight, h.reps]), [[80, 9], [65, 11]]);
});

// Prueba de integración con tu Excel real (se omite si el fichero no está en la raíz).
const REAL = "1º RUTINA - B - TEAMTOCHO SEMANA B.xlsx";
test("importa el Excel real", { skip: !existsSync(REAL) }, async () => {
  const p = parseGrids(await readWorkbook(readFileSync(REAL)))!;
  assert.equal(p.days.length, 5);
  assert.equal(p.weeks, 6);
  assert.deepEqual(p.days.map((d) => d.weekday), [1, 2, 4, 5, null]);
  const gem = p.days[0].exercises[0];
  assert.equal(gem.name, "Gemelos");
  assert.equal(gem.plan[1].length, 4);
  assert.deepEqual([gem.history[0].weight, gem.history[0].reps], [20, 19]);
  for (const d of p.days) assert.ok(d.exercises.length >= 4, `${d.name}: ejercicios`);
});
