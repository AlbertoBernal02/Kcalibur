"use client";

import { useEffect, useMemo, useState } from "react";
import { loadDailyTotals } from "@/lib/data/tracking";
import { dateRange, summarize, type DayTotals } from "@/lib/stats";
import { createClient } from "@/lib/supabase/client";
import { BarChart } from "@/components/charts";

const nf = (n: number) => Math.round(n).toLocaleString("es-ES");

// Medias, adherencia y kcal por día del periodo (7 o 30 días terminando hoy).
export function StatsSection({ today, days, goalKcal }: { today: string; days: number; goalKcal: number | null }) {
  const [totals, setTotals] = useState<DayTotals[] | null>(null);
  const [error, setError] = useState(false);
  const range = useMemo(() => dateRange(today, days), [today, days]);

  useEffect(() => {
    let stale = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTotals(null);
    setError(false);
    loadDailyTotals(createClient(), range[0], range[range.length - 1])
      .then((r) => !stale && setTotals(r))
      .catch(() => !stale && setError(true));
    return () => {
      stale = true;
    };
  }, [range]);

  if (error) return <p role="alert" className="mb-5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">No se pudieron cargar las estadísticas.</p>;
  if (!totals) return <div className="mb-5 h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando estadísticas" />;

  const s = summarize(totals, days, goalKcal);
  const byDate = new Map(totals.map((t) => [t.date, t]));

  return (
    <section aria-label="Estadísticas" className="mb-5 rounded-3xl bg-card p-5">
      <h2 className="font-semibold">Calorías por día</h2>
      <p className="mb-3 text-sm text-subtle">{s.loggedDays} de {s.totalDays} días registrados</p>

      {s.avg ? (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2 text-center">
            <Stat label="kcal/día" value={nf(s.avg.kcal)} color="text-foreground" />
            <Stat label="Prot. (g)" value={nf(s.avg.protein_g)} color="text-protein" />
            <Stat label="Hidr. (g)" value={nf(s.avg.carbs_g)} color="text-carbs" />
            <Stat label="Grasa (g)" value={nf(s.avg.fat_g)} color="text-fat" />
          </div>
          <p className="mb-4 text-sm text-subtle">Medias de los días con registro.</p>
          {s.adherence ? (
            <p className="mb-4 rounded-2xl bg-muted px-4 py-3 text-sm">
              <span className="font-semibold">Adherencia: {nf(s.adherence.pct)} %</span> · {s.adherence.onTarget} de {s.loggedDays} días dentro de ±10 % de tu objetivo
            </p>
          ) : (
            !goalKcal && <p className="mb-4 rounded-2xl bg-muted px-4 py-3 text-sm text-subtle">Define tus objetivos en Perfil para ver la adherencia.</p>
          )}
        </>
      ) : (
        <p className="mb-4 text-sm text-subtle">Aún no hay comidas registradas en este periodo.</p>
      )}

      {/* Sin ningún día registrado no se dibuja la gráfica (solo tendría ejes vacíos) */}
      {s.loggedDays > 0 && (
        <BarChart
          days={range.map((date) => ({ date, value: byDate.get(date)?.kcal || null }))}
          goal={goalKcal}
          unit="kcal"
          label={`Calorías de los últimos ${days} días`}
          detail={(date) => {
            const t = byDate.get(date)!;
            return `P ${nf(t.protein_g)} · H ${nf(t.carbs_g)} · G ${nf(t.fat_g)}`;
          }}
        />
      )}
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}
