import type { SupabaseClient } from "@supabase/supabase-js";
import type { Op } from "@/lib/offline/merge";
import { cacheGet, cacheSet, isNetworkError } from "@/lib/offline/store";

// Cola de cambios del diario y su sincronización con Supabase.
// Los cambios se guardan primero en el dispositivo (IndexedDB) y se envían en orden cuando hay red.

const KEY = "queue";

export type SyncState = { pending: number; syncing: boolean; failed: number; justSynced: boolean };
export const INITIAL_SYNC_STATE: SyncState = { pending: 0, syncing: false, failed: 0, justSynced: false };

let state: SyncState = INITIAL_SYNC_STATE;
const listeners = new Set<() => void>();
const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const getSyncState = () => state;
export function subscribeSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const dismissFailed = () => setState({ failed: 0 });

// Exclusión mutua para leer-modificar-escribir la cola sin pisarse entre llamadas.
let chain: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => {
  const p = chain.then(fn, fn);
  chain = p.catch(() => undefined);
  return p;
};

export const getQueue = async (): Promise<Op[]> => (await cacheGet<Op[]>(KEY)) ?? [];
const saveQueue = async (q: Op[]) => {
  await cacheSet(KEY, q);
  setState({ pending: q.length });
};

// Lee la cola guardada (al arrancar) para mostrar cuántos cambios hay pendientes.
export async function initSyncState() {
  setState({ pending: (await getQueue()).length });
}

export const enqueue = (ops: Op[]) => locked(async () => saveQueue([...(await getQueue()), ...ops]));

// Envía una operación; devuelve el error de Supabase (o null si fue bien).
async function send(sb: SupabaseClient, op: Op): Promise<{ code?: string; message?: string } | null> {
  try {
    const t = sb.from("diary_entries");
    const { error } =
      op.kind === "insert" ? await t.insert(op.row)
      : op.kind === "update" ? await t.update(op.patch).eq("id", op.entryId)
      : await t.delete().eq("id", op.entryId);
    // 23505 = el insert ya llegó en un intento anterior: se da por bueno.
    return error && error.code !== "23505" ? error : null;
  } catch (e) {
    return { code: "", message: String(e) };
  }
}

let running = false;
let again = false;

// Vacía la cola en orden. Si no hay red se detiene y conserva lo pendiente; si el servidor
// rechaza un cambio (error permanente) lo descarta y lo cuenta como fallido.
export async function flush(sb: SupabaseClient): Promise<void> {
  if (running) {
    again = true; // hay trabajo nuevo mientras se sincronizaba: repetir al acabar
    return;
  }
  running = true;
  setState({ syncing: true });
  let sentAny = false;
  try {
    do {
      again = false;
      for (let op = (await getQueue())[0]; op; op = (await getQueue())[0]) {
        const error = await send(sb, op);
        if (error && isNetworkError(error)) return;
        if (error) setState({ failed: state.failed + 1 });
        else sentAny = true;
        await locked(async () => saveQueue((await getQueue()).filter((o) => o.id !== op.id)));
      }
    } while (again);
  } finally {
    running = false;
    setState({ syncing: false });
    if (sentAny && state.pending === 0) {
      setState({ justSynced: true });
      setTimeout(() => setState({ justSynced: false }), 2500);
    }
  }
}
