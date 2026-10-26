import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPending, type Op } from "./merge.ts";
import type { Entry } from "../data/diary.ts";

const e = (id: string, over: Partial<Entry> = {}): Entry => ({
  id, entry_date: "2026-10-26", meal: "lunch", food_id: null, name: id, grams: 100, serving_g: null,
  kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, ...over,
});

test("insert pendiente aparece solo en su día y no se duplica", () => {
  const ops: Op[] = [{ id: "1", kind: "insert", row: e("new") }, { id: "2", kind: "insert", row: e("otro", { entry_date: "2026-10-27" }) }];
  assert.deepEqual(applyPending([e("a")], ops, "2026-10-26").map((x) => x.id), ["a", "new"]);
  // Si el servidor ya lo tiene (sincronizado a medias) no se repite
  assert.deepEqual(applyPending([e("a"), e("new")], ops, "2026-10-26").map((x) => x.id), ["a", "new"]);
});

test("update y delete pendientes se aplican, incluso sobre un insert pendiente", () => {
  const ops: Op[] = [
    { id: "1", kind: "insert", row: e("new", { grams: 50 }) },
    { id: "2", kind: "update", entryId: "new", patch: { grams: 80 } },
    { id: "3", kind: "update", entryId: "a", patch: { kcal: 999 } },
    { id: "4", kind: "delete", entryId: "b" },
  ];
  const r = applyPending([e("a"), e("b")], ops, "2026-10-26");
  assert.deepEqual(r.map((x) => [x.id, x.grams, x.kcal]), [["a", 100, 999], ["new", 80, 100]]);
});

test("sin operaciones devuelve lo mismo", () => {
  assert.deepEqual(applyPending([e("a")], [], "2026-10-26"), [e("a")]);
});
