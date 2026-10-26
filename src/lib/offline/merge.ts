import type { Entry } from "../data/diary.ts";

// Cambios del diario pendientes de enviar al servidor (cola offline).
export type Op =
  | { id: string; kind: "insert"; row: Entry }
  | { id: string; kind: "update"; entryId: string; patch: Partial<Omit<Entry, "id">> }
  | { id: string; kind: "delete"; entryId: string };

// Aplica los cambios pendientes sobre las entradas de un día tal y como están en el servidor/caché,
// para que el usuario vea sus cambios al instante aunque aún no se hayan sincronizado. Es idempotente:
// si un insert ya está en el servidor (id repetido) no se duplica.
export function applyPending(base: Entry[], ops: Op[], date: string): Entry[] {
  let list = [...base];
  for (const op of ops) {
    if (op.kind === "insert") {
      if (op.row.entry_date === date && !list.some((e) => e.id === op.row.id)) list.push(op.row);
    } else if (op.kind === "update") {
      list = list.map((e) => (e.id === op.entryId ? { ...e, ...op.patch } : e));
    } else {
      list = list.filter((e) => e.id !== op.entryId);
    }
  }
  return list;
}
