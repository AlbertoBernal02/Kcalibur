import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyAuthError } from "./auth-errors.ts";

test("registro cerrado se explica en español", () => {
  assert.equal(friendlyAuthError("Signups not allowed for this instance"), "El registro está cerrado: esta app es privada.");
  assert.equal(friendlyAuthError("Email signups are disabled"), "El registro está cerrado: esta app es privada.");
});

test("el resto de errores conocidos siguen traduciéndose", () => {
  assert.equal(friendlyAuthError("Invalid login credentials"), "Email o contraseña incorrectos.");
  assert.equal(friendlyAuthError("User already registered"), "Ese email ya tiene cuenta. Inicia sesión.");
  assert.equal(friendlyAuthError("algo raro"), "algo raro");
});
