"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DayData } from "@/lib/data/training";
import { monthGrid, trainedDates } from "@/lib/training/progress";
import { todayISO } from "@/lib/training/session";

const MONTH = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

// Calendario mensual con los días en que entrenaste (según las series que registras en la app).
export function TrainingCalendar({ days }: { days: DayData[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);
  const trained = trainedDates(days);
  const today = todayISO();
  const grid = monthGrid(cursor.year, cursor.month);
  const inMonth = [...trained.keys()].filter((d) => d.startsWith(grid.find(Boolean)!.slice(0, 7))).length;
  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  };
  const label = MONTH.format(new Date(cursor.year, cursor.month, 1));
  const info = selected ? trained.get(selected) : null;

  return (
    <section aria-label="Calendario de entrenos" className="mb-5 rounded-3xl bg-card p-5">
      <div className="flex items-center">
        <button onClick={() => shift(-1)} aria-label="Mes anterior" className="flex h-11 w-11 items-center justify-center rounded-xl text-subtle">
          <ChevronLeft />
        </button>
        <h2 className="flex-1 text-center font-semibold">{label.charAt(0).toUpperCase() + label.slice(1)}</h2>
        <button onClick={() => shift(1)} aria-label="Mes siguiente" className="flex h-11 w-11 items-center justify-center rounded-xl text-subtle">
          <ChevronRight />
        </button>
      </div>
      <p className="mb-2 text-center text-xs text-subtle">{inMonth} {inMonth === 1 ? "día entrenado" : "días entrenados"} este mes</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-subtle" aria-hidden="true">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((iso, i) =>
          iso === null ? (
            <span key={`b${i}`} />
          ) : (
            <button
              key={iso}
              onClick={() => setSelected(iso === selected ? null : iso)}
              aria-label={`${Number(iso.slice(8))}${trained.has(iso) ? `, ${trained.get(iso)!.sets} series` : ""}`}
              aria-pressed={iso === selected}
              className={`flex h-11 items-center justify-center rounded-xl text-sm tabular-nums ${trained.has(iso) ? "bg-primary font-semibold text-primary-fg" : "text-foreground"} ${iso === today ? "ring-2 ring-primary" : ""} ${iso === selected ? "outline outline-2 outline-foreground" : ""}`}
            >
              {Number(iso.slice(8))}
            </button>
          ),
        )}
      </div>
      {selected && (
        <p className="mt-3 text-center text-sm text-subtle">{info ? `${info.sets} ${info.sets === 1 ? "serie" : "series"} · ${info.days.join(", ")}` : "Sin entreno registrado este día."}</p>
      )}
    </section>
  );
}
