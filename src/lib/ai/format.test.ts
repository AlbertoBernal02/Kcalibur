import assert from "node:assert/strict";
import { test } from "node:test";
import { plainMath } from "./format.ts";

test("quita el LaTeX de las cuentas", () => {
  assert.equal(plainMath("Para 150 g: $150 \\times 1.3 = 195$ kcal."), "Para 150 g: 150 × 1.3 = 195 kcal.");
  assert.equal(plainMath("Diferencia: $258 \\text{ kcal (patata)} - 195 \\text{ kcal (arroz)} = 63 \\text{ kcal}$"), "Diferencia: 258  kcal (patata) - 195  kcal (arroz) = 63  kcal");
});

test("no toca el texto normal, ni un euro suelto ni un porcentaje", () => {
  assert.equal(plainMath("Cuesta 5 € y es un 20% menos."), "Cuesta 5 € y es un 20% menos.");
  assert.equal(plainMath("Solo un $ aislado"), "Solo un $ aislado");
});
