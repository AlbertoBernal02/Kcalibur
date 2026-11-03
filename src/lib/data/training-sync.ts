import { deleteLog, saveLog } from "@/lib/data/training";
import { cacheGet, cacheSet, isNetworkError } from "@/lib/offline/store";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { enqueueOp, type QueuedOp } from "@/lib/training/queue";

const KEY = "training-queue";

export const readQueue = async (): Promise<QueuedOp[]> => (await cacheGet<QueuedOp[]>(KEY)) ?? [];

export async function enqueue(op: QueuedOp): Promise<void> {
  await cacheSet(KEY, enqueueOp(await readQueue(), op));
}

// Sube la cola en orden. Se detiene si sigue sin haber red; una operación rechazada por otro motivo
// (p. ej. el ejercicio ya no existe) se descarta para no bloquear las demás.
export async function flushQueue(): Promise<void> {
  let queue = await readQueue();
  if (queue.length === 0) return;
  const sb = createClient();
  const userId = await currentUserId();
  while (queue.length) {
    const op = queue[0];
    try {
      if (op.kind === "save") await saveLog(sb, userId, op.exerciseId, op.week, op.setIndex, op.values, op.date);
      else await deleteLog(sb, op.exerciseId, op.week, op.setIndex);
    } catch (e) {
      if (isNetworkError(e)) break;
    }
    queue = queue.slice(1);
    await cacheSet(KEY, queue);
  }
}
