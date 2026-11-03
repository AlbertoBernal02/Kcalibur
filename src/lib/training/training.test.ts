import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parseGrids, parseRange, niceName, startWeek, type Grid } from "./import-grid.ts";
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
  assert.ok(startWeek(p) >= 4, "empieza por la semana en curso, no por la 1");
});

// --- sesión ---
import { dayProgress, firstNumber, isoWeekday, previousLog, summarizeLog, targetText, todayISO } from "./session.ts";
import type { ExerciseData } from "../data/training.ts";

const log = (week: number, setIndex: number, weight: number | null, reps: number | null) => ({ week, setIndex, weight, reps, rir: null, note: "", loggedOn: "2026-11-03" });
const ex = (logs: ExerciseData["logs"]): ExerciseData => ({
  id: "e", position: 0, name: "Hack", notes: "", restSeconds: 120, videoUrl: null, logs,
  plan: { 1: [{ reps: "8", rir: "1" }, { reps: "8", rir: "1" }], 2: [{ reps: "8", rir: "1" }, { reps: "8", rir: "1" }] },
});

test("previousLog devuelve la semana anterior más reciente de esa misma serie", () => {
  const e = ex([log(1, 0, 40, 8), log(2, 0, 45, 8), log(2, 1, 42.5, 8)]);
  assert.equal(previousLog(e, 3, 0)?.weight, 45); // semana 2 gana a la 1
  assert.equal(previousLog(e, 2, 1), null); // la serie 1 no existía en la semana 1
  assert.equal(previousLog(e, 1, 0), null); // nada antes de la semana 1
});

test("dayProgress cuenta series hechas sobre las planificadas de esa semana", () => {
  const day = { id: "d", name: "Lunes", weekday: 1, exercises: [ex([log(1, 0, 40, 8), log(2, 0, 45, 8)])] };
  assert.deepEqual(dayProgress(day, 1), { done: 1, total: 2 });
  assert.deepEqual(dayProgress(day, 3), { done: 0, total: 0 });
});

test("textos de sesión", () => {
  assert.equal(firstNumber("7 RIR 2 | RM 80%"), 7);
  assert.equal(firstNumber("FALLO"), null);
  assert.equal(targetText({ reps: "15", rir: "1" }), "15 reps · RIR 1");
  assert.equal(targetText({ reps: "8 + 12", rir: "" }), "8 + 12");
  assert.equal(targetText({ reps: "-", rir: "" }), "máx.");
  assert.equal(summarizeLog({ weight: 12.5, reps: 18, note: "" }), "12,5 × 18");
  assert.equal(summarizeLog({ weight: null, reps: null, note: "FALLO" }), "FALLO");
  assert.equal(todayISO(new Date(2026, 10, 3, 23, 59)), "2026-11-03");
  assert.equal(isoWeekday(new Date(2026, 10, 1)), 7); // domingo
  assert.equal(isoWeekday(new Date(2026, 10, 2)), 1); // lunes
});

// --- progreso ---
import { programProgress } from "./progress.ts";

test("programProgress toma la mejor serie por semana y calcula el cambio de 1RM", () => {
  const e = ex([log(1, 0, 40, 8), log(1, 1, 30, 8), log(3, 0, 50, 8), log(2, 0, null, 10)]); // sin peso no cuenta
  const [p] = programProgress([{ id: "d", name: "L", weekday: 1, exercises: [e] }]);
  assert.deepEqual(p.weeks.map((w) => [w.week, w.weight]), [[1, 40], [3, 50]]);
  assert.equal(Math.round(p.change!), 25); // 40 → 50 kg con las mismas reps
  assert.equal(p.pr?.week, 3);
});

// --- edición ---
import { applySets, parseRestInput } from "./edit.ts";

test("applySets cambia solo la semana indicada o también las siguientes", () => {
  const plan = { 1: [{ reps: "8", rir: "1" }], 2: [{ reps: "8", rir: "1" }], 3: [{ reps: "8", rir: "1" }] };
  const one = applySets(plan, 2, [{ reps: "10", rir: "0" }, { reps: "10", rir: "0" }], 3, false);
  assert.deepEqual([one[1].length, one[2].length, one[3].length], [1, 2, 1]);
  const all = applySets(plan, 2, [{ reps: "10", rir: "0" }], 3, true);
  assert.deepEqual([all[1][0].reps, all[2][0].reps, all[3][0].reps], ["8", "10", "10"]);
});

test("parseRestInput acepta mm:ss, minutos y segundos", () => {
  assert.equal(parseRestInput("1:30"), 90);
  assert.equal(parseRestInput("2"), 120);
  assert.equal(parseRestInput("45"), 45);
  assert.equal(parseRestInput(""), null);
  assert.equal(parseRestInput("abc"), null);
});

import { isRecord } from "./progress.ts";

test("isRecord solo avisa si supera el mejor 1RM previo", () => {
  const e = ex([log(1, 0, 40, 8), log(1, 1, 30, 8)]);
  assert.equal(isRecord(e, 2, 0, { weight: 45, reps: 8 }), true);
  assert.equal(isRecord(e, 2, 0, { weight: 40, reps: 8 }), false); // igualar no es récord
  assert.equal(isRecord(e, 1, 0, { weight: 41, reps: 8 }), true); // corrigiendo la propia serie
  assert.equal(isRecord(ex([]), 1, 0, { weight: 40, reps: 8 }), false); // primera vez
  assert.equal(isRecord(e, 2, 0, { weight: null, reps: 10 }), false);
});

import { applyQueue, enqueueOp } from "./queue.ts";

test("la cola conserva solo la última operación por serie y se aplica al programa", () => {
  const save = (reps: number) => ({ kind: "save" as const, exerciseId: "e", week: 2, setIndex: 0, values: { weight: 50, reps, rir: null }, date: "2026-11-03" });
  let q = enqueueOp([], save(8));
  q = enqueueOp(q, save(9));
  assert.equal(q.length, 1);
  const p = { id: "p", name: "P", weeks: 3, currentWeek: 2, days: [{ id: "d", name: "L", weekday: 1, exercises: [ex([])] }] };
  assert.equal(applyQueue(p, q).days[0].exercises[0].logs[0].reps, 9);
  q = enqueueOp(q, { kind: "undo", exerciseId: "e", week: 2, setIndex: 0 });
  assert.equal(applyQueue(p, q).days[0].exercises[0].logs.length, 0);
});

import { sessionSummary } from "./progress.ts";

test("sessionSummary compara con la semana anterior y detecta récords", () => {
  const e = ex([log(1, 0, 40, 8), log(2, 0, 45, 8), log(2, 1, 30, 8)]);
  const s = sessionSummary({ id: "d", name: "L", weekday: 1, exercises: [e] }, 2);
  assert.equal(s.sets, 2);
  assert.equal(s.volume, 45 * 8 + 30 * 8);
  assert.equal(s.prevVolume, 40 * 8);
  assert.deepEqual(s.records.map((r) => r.weight), [45]);
  assert.equal(sessionSummary({ id: "d", name: "L", weekday: 1, exercises: [e] }, 1).prevVolume, null);
});

import { monthGrid, trainedDates } from "./progress.ts";

test("trainedDates ignora series sin fecha y monthGrid empieza en lunes", () => {
  const dated = { ...log(1, 0, 40, 8), loggedOn: "2026-11-03" };
  const imported = { ...log(1, 1, 40, 8), loggedOn: null };
  const t = trainedDates([{ id: "d", name: "Lunes", weekday: 1, exercises: [ex([dated, imported, { ...dated, setIndex: 2 }])] }]);
  assert.deepEqual([...t.keys()], ["2026-11-03"]);
  assert.deepEqual(t.get("2026-11-03"), { sets: 2, days: ["Lunes"] });
  const g = monthGrid(2026, 10); // noviembre 2026: el día 1 es domingo → 6 huecos
  assert.equal(g.filter((x) => x === null).length, 6);
  assert.equal(g[6], "2026-11-01");
  assert.equal(g.at(-1), "2026-11-30");
});
