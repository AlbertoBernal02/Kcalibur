"use client";

import { useEffect, useState } from "react";
import { loadGoals } from "@/lib/data/profile";
import { toISO } from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";
import { StatsSection } from "@/components/stats-section";
import { WaterCard } from "@/components/water-card";
import { WeightCard } from "@/components/weight-card";

const RANGES = [
  { id: "week", label: "Semana", days: 7, weightDays: 30 },
  { id: "month", label: "Mes", days: 30, weightDays: 90 },
] as const;

// Pantalla de seguimiento: agua de hoy, estadísticas del periodo y peso.
// "Hoy" se calcula tras montar (ver Diary): el servidor no conoce la zona horaria del usuario.
export function ProgressView() {
  const [today, setToday] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("week");
  const [goalKcal, setGoalKcal] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(toISO(new Date()));
    loadGoals(createClient()).then((g) => setGoalKcal(g?.kcal ?? null)).catch(() => setGoalKcal(null));
  }, []);

  if (!today) return <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando progreso" />;
  const r = RANGES.find((x) => x.id === range)!;

  return (
    <>
      <WaterCard date={today} />

      <div className="mb-3 flex rounded-2xl bg-muted p-1" role="tablist" aria-label="Periodo">
        {RANGES.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={range === x.id}
            onClick={() => setRange(x.id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${range === x.id ? "bg-card text-foreground shadow-sm" : "text-subtle"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <StatsSection today={today} days={r.days} goalKcal={goalKcal} />
      <WeightCard today={today} days={r.weightDays} />
    </>
  );
}
