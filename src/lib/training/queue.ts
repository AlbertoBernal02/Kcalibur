import type { ProgramData, SetValues } from "../data/training.ts";
import { withLog } from "./session.ts";

// Operación pendiente de subir (se hizo sin conexión).
export type QueuedOp =
  | { kind: "save"; exerciseId: string; week: number; setIndex: number; values: SetValues; date: string }
  | { kind: "undo"; exerciseId: string; week: number; setIndex: number };

const same = (a: QueuedOp, b: QueuedOp) => a.exerciseId === b.exerciseId && a.week === b.week && a.setIndex === b.setIndex;

// Añade una operación; solo importa la última sobre cada serie (la cola no crece sin límite).
export function enqueueOp(queue: QueuedOp[], op: QueuedOp): QueuedOp[] {
  return [...queue.filter((q) => !same(q, op)), op];
}

// Programa tal como quedará cuando se suba la cola (para mostrar lo hecho sin conexión).
export function applyQueue(p: ProgramData, queue: QueuedOp[]): ProgramData {
  return queue.reduce(
    (acc, op) =>
      withLog(acc, op.exerciseId, op.week, op.setIndex, op.kind === "undo" ? null : { week: op.week, setIndex: op.setIndex, ...op.values, note: op.values.note ?? "", loggedOn: op.date }),
    p,
  );
}
