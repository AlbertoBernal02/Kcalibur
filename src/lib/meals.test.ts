import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, dayLabel } from "./meals.ts";

test("addDays cruza fin de mes y de año", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("dayLabel: hoy / ayer / mañana", () => {
  assert.equal(dayLabel("2026-10-26", "2026-10-26"), "Hoy");
  assert.equal(dayLabel("2026-10-25", "2026-10-26"), "Ayer");
  assert.equal(dayLabel("2026-10-27", "2026-10-26"), "Mañana");
});
