import assert from "node:assert/strict";
import { test } from "node:test";
import { daysBetween, fitWithin, nearestWeight, nextPhotoInfo } from "./photos.ts";

test("daysBetween cruza mes y año", () => {
  assert.equal(daysBetween("2026-01-30", "2026-02-02"), 3);
  assert.equal(daysBetween("2025-12-25", "2026-01-08"), 14);
  assert.equal(daysBetween("2026-05-05", "2026-05-01"), -4);
});

test("nearestWeight elige el más cercano dentro del margen", () => {
  const w = [{ date: "2026-10-01", value: 82 }, { date: "2026-10-04", value: 81.5 }, { date: "2026-10-20", value: 80 }];
  assert.equal(nearestWeight(w, "2026-10-03"), 81.5); // 1 día de 10-04 vs 2 de 10-01
  assert.equal(nearestWeight(w, "2026-10-10"), null); // nada a ±3 días
  assert.equal(nearestWeight([], "2026-10-10"), null);
});

test("recordatorio quincenal", () => {
  assert.deepEqual(nextPhotoInfo(null, "2026-10-26"), { due: true, days: 0, dueOn: null });
  assert.deepEqual(nextPhotoInfo("2026-10-12", "2026-10-26"), { due: true, days: 14, dueOn: "2026-10-26" });
  assert.deepEqual(nextPhotoInfo("2026-10-20", "2026-10-26"), { due: false, days: 8, dueOn: "2026-11-03" });
});

test("fitWithin reduce sin ampliar y conserva proporción", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1280), { width: 1280, height: 960 });
  assert.deepEqual(fitWithin(3000, 4000, 1280), { width: 960, height: 1280 });
  assert.deepEqual(fitWithin(800, 600, 1280), { width: 800, height: 600 });
});
