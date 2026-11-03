"use client";

import { useCallback, useEffect, useState } from "react";
import { loadProgram, type ProgramData } from "@/lib/data/training";
import { flushQueue, readQueue } from "@/lib/data/training-sync";
import { cachedRead } from "@/lib/offline/store";
import { createClient } from "@/lib/supabase/client";
import { applyQueue } from "@/lib/training/queue";

// Sube lo pendiente, lee el programa (con copia local si no hay red) y le aplica lo que aún no se ha subido.
async function fetchProgram(): Promise<ProgramData | null> {
  await flushQueue().catch(() => {});
  const p = await cachedRead("training-program", () => loadProgram(createClient()));
  const queue = await readQueue();
  if (p && navigator.serviceWorker) {
    // Guarda las pantallas de sesión para poder abrirlas sin conexión.
    const urls = ["/entreno", "/entreno/rutina", "/entreno/progreso", ...p.days.map((d) => `/entreno/sesion/${d.id}`)];
    void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "precache", urls })).catch(() => {});
  }
  return p && queue.length ? applyQueue(p, queue) : p;
}

// Carga el programa activo. `program`: undefined = cargando, null = aún no hay rutina.
export function useProgram() {
  const [program, setProgram] = useState<ProgramData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setProgram(await fetchProgram());
      setError(null);
    } catch {
      setError("No se pudo cargar tu rutina.");
    }
  }, []);

  useEffect(() => {
    let stale = false;
    fetchProgram()
      .then((p) => !stale && setProgram(p))
      .catch(() => !stale && setError("No se pudo cargar tu rutina."));
    const onOnline = () => void reload(); // al volver la red: sube la cola y recarga
    window.addEventListener("online", onOnline);
    return () => {
      stale = true;
      window.removeEventListener("online", onOnline);
    };
  }, [reload]);

  return { program, setProgram, error, reload };
}
