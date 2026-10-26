import assert from "node:assert/strict";
import { test } from "node:test";
import { mealBreakdown, totals } from "./summary.ts";

const e = (meal: "breakfast" | "lunch", kcal: number, p = 0, c = 0, f = 0) => ({
  meal, kcal, protein_g: p, carbs_g: c, fat_g: f,
});

test("totals suma kcal y macros", () => {
  assert.deepEqual(totals([e("breakfast", 200, 10, 20, 5), e("lunch", 300, 20, 30, 10)]), {
    kcal: 500, protein_g: 30, carbs_g: 50, fat_g: 15,
  });
});

test("mealBreakdown reparte porcentajes y suma 100", () => {
  const b = mealBreakdown([e("breakfast", 200), e("lunch", 600)]);
  assert.equal(b.find((m) => m.meal === "breakfast")!.pct, 25);
  assert.equal(b.find((m) => m.meal === "lunch")!.pct, 75);
  assert.equal(b.reduce((a, m) => a + m.pct, 0), 100);
});

test("mealBreakdown con día vacío no produce NaN", () => {
  for (const m of mealBreakdown([])) assert.equal(m.pct, 0);
});
