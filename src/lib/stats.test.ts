import assert from "node:assert/strict";
import { test } from "node:test";
import { dateRange, summarize, weightChange } from "./stats.ts";

const day = (date: string, kcal: number, p = 0, c = 0, f = 0) => ({ date, kcal, protein_g: p, carbs_g: c, fat_g: f });

test("dateRange: 7 días terminando en el último, cruzando mes", () => {
  assert.deepEqual(dateRange("2026-03-02", 4), ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
});

test("summarize: media solo de días registrados y adherencia ±10 %", () => {
  const s = summarize([day("a", 2000, 100), day("b", 2100, 120), day("c", 3000, 80)], 7, 2000);
  assert.equal(s.loggedDays, 3);
  assert.equal(s.totalDays, 7);
  assert.equal(Math.round(s.avg!.kcal), 2367);
  assert.equal(s.avg!.protein_g, 100);
  assert.deepEqual(s.adherence, { onTarget: 2, pct: (2 / 3) * 100 }); // 2000 y 2100 sí; 3000 no
});

test("summarize: sin datos o sin objetivo no inventa nada", () => {
  const empty = summarize([], 7, 2000);
  assert.equal(empty.avg, null);
  assert.equal(empty.adherence, null);
  assert.equal(summarize([day("a", 1800)], 7, null).adherence, null);
});

test("un día con 0 kcal no cuenta como registrado", () => {
  assert.equal(summarize([day("a", 0)], 7, 2000).loggedDays, 0);
});

test("weightChange", () => {
  assert.equal(weightChange([{ value: 82 }, { value: 81.2 }, { value: 80.4 }]), -1.6);
  assert.equal(weightChange([{ value: 80 }]), null);
});
