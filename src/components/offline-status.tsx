"use client";

import { CloudOff, RefreshCw, Check } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { INITIAL_SYNC_STATE, dismissFailed, flush, getSyncState, initSyncState, subscribeSync } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";

// Pantallas que se guardan de antemano para poder abrirlas sin conexión.
const PRECACHE = ["/", "/alimentos", "/comidas", "/progreso", "/perfil", "/entreno", "/entreno/rutina", "/entreno/progreso"];

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

// Registra el service worker, sincroniza la cola al arrancar / reconectar / volver a la app,
// y muestra un aviso discreto del estado (sin conexión, sincronizando, sincronizado, fallos).
export function OfflineStatus() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const sync = useSyncExternalStore(subscribeSync, getSyncState, () => INITIAL_SYNC_STATE);

  useEffect(() => {
    const sb = createClient();
    const run = () => {
      if (navigator.onLine) void flush(sb);
    };

    // El service worker solo en producción (en desarrollo complicaría la recarga en caliente).
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => navigator.onLine && reg.active?.postMessage({ type: "precache", urls: PRECACHE }))
        .catch(() => undefined);
    }

    void initSyncState().then(run);
    const onVisible = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  let content: React.ReactNode = null;
  if (sync.failed > 0) {
    content = (
      <button onClick={dismissFailed} className="pointer-events-auto flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-lg">
        {sync.failed} {sync.failed === 1 ? "cambio no se pudo sincronizar" : "cambios no se pudieron sincronizar"} · Entendido
      </button>
    );
  } else if (!online) {
    content = (
      <span className="flex items-center gap-2 rounded-full bg-carbs px-4 py-2 text-sm font-medium text-black shadow-lg">
        <CloudOff size={16} /> Sin conexión{sync.pending > 0 ? ` · ${sync.pending} por sincronizar` : ""}
      </span>
    );
  } else if (sync.syncing && sync.pending > 0) {
    content = (
      <span className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-lg">
        <RefreshCw size={16} className="animate-spin" /> Sincronizando {sync.pending}…
      </span>
    );
  } else if (sync.justSynced) {
    content = (
      <span className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-lg">
        <Check size={16} /> Sincronizado
      </span>
    );
  }

  if (!content) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      {content}
    </div>
  );
}
