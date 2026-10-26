"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Food } from "@/lib/data/foods";
import { importOffProduct, prefillHref, resolveBarcode, searchOff } from "@/lib/data/off-foods";
import { isComplete, type OffProduct } from "@/lib/off";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

type State =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "error"; msg: string }
  | { s: "empty" }
  | { s: "results"; products: OffProduct[] };

// Búsqueda en Open Food Facts por nombre o por código de barras (si el texto son 8-14 dígitos).
// Es explícita (botón) para respetar los límites de la API. Montar con key={query} para reiniciar.
export function OffSearch({ query, onFood }: { query: string; onFood: (food: Food) => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ s: "idle" });
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const q = query.trim();
  const code = /^\d{8,14}$/.test(q) ? q : null;

  // Importa el producto elegido (o abre el editor si faltan datos) y avisa al padre.
  async function pick(p: OffProduct) {
    if (!isComplete(p)) return router.push(prefillHref(p));
    setBusyCode(p.code);
    try {
      onFood(await importOffProduct(createClient(), await currentUserId(), p));
    } catch {
      setState({ s: "error", msg: "No se pudo guardar el producto. Inténtalo de nuevo." });
      setBusyCode(null);
    }
  }

  async function run() {
    setState({ s: "loading" });
    try {
      if (code) {
        const r = await resolveBarcode(createClient(), await currentUserId(), code);
        if (r.kind === "food") return onFood(r.food);
        if (r.kind === "incomplete") return router.push(prefillHref(r.product));
        return setState({ s: "empty" });
      }
      const products = await searchOff(q);
      setState(products.length ? { s: "results", products } : { s: "empty" });
    } catch {
      setState({ s: "error", msg: "Open Food Facts no responde ahora. Prueba de nuevo en un momento." });
    }
  }

  if (q.length < 2) return null;

  return (
    <section aria-label="Open Food Facts" className="mt-4 flex flex-col gap-3">
      {state.s === "idle" || state.s === "loading" || state.s === "error" || state.s === "empty" ? (
        <Button type="button" variant="secondary" onClick={run} disabled={state.s === "loading"} className="flex items-center justify-center gap-2">
          <Globe size={20} />
          {state.s === "loading" ? "Buscando…" : code ? `Buscar código ${code} en Open Food Facts` : `Buscar «${q}» en Open Food Facts`}
        </Button>
      ) : null}

      {state.s === "error" && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{state.msg}</p>}
      {state.s === "empty" && (
        <p className="text-center text-sm text-subtle">
          {code ? "Ese código no está en Open Food Facts." : "Open Food Facts no tiene resultados."} Puedes crear el alimento a mano.
        </p>
      )}

      {state.s === "results" && (
        <>
          <h3 className="text-sm font-semibold text-subtle">Resultados de Open Food Facts</h3>
          <ul className="flex flex-col gap-2">
            {state.products.map((p) => (
              <li key={p.code}>
                <button
                  onClick={() => pick(p)}
                  disabled={busyCode !== null}
                  className="w-full rounded-2xl bg-card px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
                >
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-sm text-subtle">
                    {p.brand ? `${p.brand} · ` : ""}
                    {isComplete(p)
                      ? `${Math.round(p.kcal!)} kcal · P ${p.protein} · H ${p.carbs} · G ${p.fat} /100 g`
                      : "Datos incompletos: toca para completarlos"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-center text-xs text-subtle">Datos de Open Food Facts (ODbL). Pueden contener errores: revísalos.</p>
        </>
      )}
    </section>
  );
}
