"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createDiet, listDiets, type Diet } from "@/lib/data/diets";
import { defaultSelection, summarizeDay } from "@/lib/diet";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

// Listado de dietas con un resumen del día tipo de cada una.
export function DietsList() {
  const router = useRouter();
  const [diets, setDiets] = useState<Diet[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listDiets(createClient()).then(setDiets).catch(() => setError(true));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setFormError("Ponle un nombre a la dieta.");
    setBusy(true);
    setFormError(null);
    try {
      const id = await createDiet(createClient(), await currentUserId(), name.trim(), null);
      router.push(`/dietas/${id}`);
    } catch {
      setFormError("No se pudo crear la dieta.");
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">No se pudieron cargar tus dietas.</p>}

      {!diets && !error ? (
        <div className="flex flex-col gap-2" aria-label="Cargando dietas">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : diets && diets.length === 0 ? (
        <div className="mt-10 text-center text-subtle">
          <p>Aún no tienes ninguna dieta.</p>
          <p className="mt-1 text-sm">Crea una con el botón + y añade varias opciones a cada comida; la app calcula las kcal sola.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-20">
          {diets?.map((d) => {
            const s = summarizeDay(d.options, defaultSelection(d.options));
            return (
              <li key={d.id}>
                <Link href={`/dietas/${d.id}`} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-sm text-subtle">
                      {d.options.length === 0 ? "Sin opciones todavía" : `${d.options.length} ${d.options.length === 1 ? "opción" : "opciones"} · ${s.slotsWithOptions} comidas`}
                    </span>
                  </span>
                  {d.options.length > 0 && (
                    <span className="text-right">
                      <span className="block font-semibold">≈ {Math.round(s.chosen.kcal)} kcal</span>
                      <span className="block text-xs text-subtle">día tipo</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setCreating(true)}
        aria-label="Crear dieta"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition active:scale-95"
      >
        <Plus size={28} />
      </button>

      {creating && (
        <Sheet title="Nueva dieta" onClose={() => setCreating(false)} error={formError}>
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label="Nombre">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej. Dieta definición" autoFocus />
            </Field>
            <Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear dieta"}</Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
