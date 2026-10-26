"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deleteWeight, loadWeights, saveWeight, type WeightPoint } from "@/lib/data/tracking";
import { addDays } from "@/lib/meals";
import { weightChange } from "@/lib/stats";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { LineChart, shortDate } from "@/components/charts";
import { Button, inputCls } from "@/components/ui";

const nf = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

// "27 sept" a partir de una fecha ISO.
const fromLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
};

// Registro de peso: formulario, gráfica del periodo y últimos registros (con borrado).
export function WeightCard({ today, days }: { today: string; days: number }) {
  const [points, setPoints] = useState<WeightPoint[] | null>(null);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => setPoints(await loadWeights(createClient(), addDays(today, -(days - 1)))), [today, days]);

  // Carga inicial / al cambiar de periodo; `stale` descarta respuestas de un periodo anterior.
  useEffect(() => {
    let stale = false;
    loadWeights(createClient(), addDays(today, -(days - 1)))
      .then((p) => !stale && setPoints(p))
      .catch(() => !stale && setError("No se pudo cargar el peso."));
    return () => {
      stale = true;
    };
  }, [today, days]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(kg.replace(",", "."));
    if (!(value >= 30 && value <= 300)) return setError("El peso debe estar entre 30 y 300 kg.");
    setBusy(true);
    setError(null);
    try {
      await saveWeight(createClient(), await currentUserId(), date, Math.round(value * 10) / 10);
      setKg("");
      await reload();
    } catch {
      setError("No se pudo guardar el peso.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: string) {
    if (!confirm("¿Borrar este registro de peso?")) return;
    setError(null);
    try {
      await deleteWeight(createClient(), d);
      await reload();
    } catch {
      setError("No se pudo borrar el registro.");
    }
  }

  const change = points ? weightChange(points) : null;
  const last = points?.[points.length - 1];

  return (
    <section aria-label="Peso" className="mb-5 rounded-3xl bg-card p-5">
      <h2 className="font-semibold">Peso</h2>
      {points && last && (
        <p className="mt-1">
          <span className="text-3xl font-bold">{nf(last.value)}</span> <span className="text-subtle">kg</span>
          {change !== null && (
            <span className="ml-2 text-sm text-subtle">
              {change > 0 ? "+" : change < 0 ? "−" : ""}{nf(Math.abs(change))} kg desde el {fromLabel(points![0].date)}
            </span>
          )}
        </p>
      )}

      <form onSubmit={onSubmit} className="my-4 grid grid-cols-[1fr_1fr] gap-2">
        <input className={inputCls} inputMode="decimal" placeholder={last ? `${nf(last.value)} kg` : "Peso (kg)"} aria-label="Peso (kg)" value={kg} onChange={(e) => setKg(e.target.value)} />
        <input type="date" className={inputCls} aria-label="Fecha del peso" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button type="submit" disabled={busy || kg.trim() === ""} className="col-span-2">{busy ? "Guardando…" : "Registrar peso"}</Button>
      </form>

      {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {!points ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-label="Cargando peso" />
      ) : points.length === 0 ? (
        <p className="text-sm text-subtle">Registra tu peso para ver la evolución de los últimos {days} días.</p>
      ) : (
        <>
          <LineChart points={points} unit="kg" label={`Peso de los últimos ${days} días`} />
          <ul className="mt-2 flex flex-col">
            {[...points].reverse().slice(0, 5).map((p) => (
              <li key={p.date} className="flex items-center border-t border-border py-1 text-sm">
                <span className="flex-1 text-subtle">{shortDate(p.date)}</span>
                <span className="font-medium">{nf(p.value)} kg</span>
                <button onClick={() => remove(p.date)} aria-label={`Borrar peso del ${shortDate(p.date)}`} className="flex h-11 w-11 items-center justify-center text-subtle">
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
