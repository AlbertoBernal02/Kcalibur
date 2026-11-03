"use client";

import { useEffect, useState } from "react";
import { activateProgram, deleteProgram, loadArchived, type ArchivedProgram } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/client";
import { ErrorNote } from "./bits";

// Rutinas que se archivaron al importar otra: se pueden volver a poner como activa (con todos sus registros).
export function ArchivedPrograms({ onSwitched }: { onSwitched: () => Promise<void> }) {
  const [items, setItems] = useState<ArchivedProgram[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    loadArchived(createClient())
      .then((p) => !stale && setItems(p))
      .catch(() => {}); // sin red simplemente no se muestran
    return () => {
      stale = true;
    };
  }, []);

  async function use(id: string) {
    setError(null);
    try {
      await activateProgram(createClient(), id);
      await onSwitched();
    } catch {
      setError("No se pudo activar esa rutina.");
    }
  }

  async function remove(p: ArchivedProgram) {
    if (!confirm(`¿Borrar la rutina archivada «${p.name}» con todos sus registros? No se puede deshacer.`)) return;
    setError(null);
    try {
      await deleteProgram(createClient(), p.id);
      setItems((all) => all.filter((x) => x.id !== p.id));
    } catch {
      setError("No se pudo borrar esa rutina.");
    }
  }

  if (items.length === 0) return null;
  return (
    <section aria-label="Rutinas archivadas" className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-subtle">Rutinas archivadas</h2>
      {error && <ErrorNote>{error}</ErrorNote>}
      <ul className="flex flex-col gap-2">
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-subtle">{p.weeks} semanas</p>
            </div>
            <button onClick={() => remove(p)} aria-label={`Borrar ${p.name}`} className="h-11 shrink-0 px-2 text-sm text-danger">
              Borrar
            </button>
            <button onClick={() => use(p.id)} className="h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-semibold text-primary">
              Usar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
