// Opción elegida por comida en cada dieta: se recuerda en este dispositivo (no se guarda en la base de datos).
import type { Selection } from "./diet.ts";

export const selKey = (dietId: string) => `kcalibur-diet-sel-${dietId}`;

export function readSel(dietId: string): Selection | null {
  try {
    return JSON.parse(localStorage.getItem(selKey(dietId)) ?? "null");
  } catch {
    return null;
  }
}
