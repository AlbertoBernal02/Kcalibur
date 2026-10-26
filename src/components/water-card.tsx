"use client";

import { Droplets } from "lucide-react";
import { useEffect, useState } from "react";
import { loadWater, setWater } from "@/lib/data/tracking";
import { createClient, currentUserId } from "@/lib/supabase/client";

const STEPS = [-250, 250, 500];

// Agua de hoy: total, progreso hacia el objetivo y botones rápidos.
export function WaterCard({ date }: { date: string }) {
  const [water, setWaterState] = useState<{ ml: number; goal: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWater(createClient(), date).then(setWaterState).catch(() => setError("No se pudo cargar el agua."));
  }, [date]);

  // Actualiza al instante y revierte si falla el guardado.
  async function add(delta: number) {
    if (!water) return;
    const prev = water;
    const next = { ...water, ml: Math.max(0, water.ml + delta) };
    setWaterState(next);
    setError(null);
    try {
      await setWater(createClient(), await currentUserId(), date, next.ml);
    } catch {
      setWaterState(prev);
      setError("No se pudo guardar el agua.");
    }
  }

  const pct = water ? Math.min((water.ml / water.goal) * 100, 100) : 0;

  return (
    <section aria-label="Agua" className="mb-5 rounded-3xl bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Droplets size={20} className="text-protein" />
        <h2 className="font-semibold">Agua de hoy</h2>
      </div>
      {!water && !error ? (
        <div className="h-20 animate-pulse rounded-2xl bg-muted" aria-label="Cargando agua" />
      ) : water ? (
        <>
          <p className="text-3xl font-bold">
            {(water.ml / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} <span className="text-base font-medium text-subtle">/ {(water.goal / 1000).toLocaleString("es-ES")} L</span>
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Agua" aria-valuemin={0} aria-valuemax={water.goal} aria-valuenow={water.ml}>
            <div className="h-full rounded-full bg-protein transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-subtle">
            {water.ml >= water.goal ? "¡Objetivo cumplido!" : `Faltan ${(water.goal - water.ml).toLocaleString("es-ES")} ml`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {STEPS.map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                disabled={s < 0 && water.ml === 0}
                className="h-12 rounded-2xl border border-border font-semibold transition active:scale-95 disabled:opacity-40"
              >
                {s > 0 ? `+${s}` : s} ml
              </button>
            ))}
          </div>
        </>
      ) : null}
      {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
