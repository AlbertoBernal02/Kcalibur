"use client";

import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";
import { setCurrentWeek, type DayData, type ProgramData } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/client";
import { dayFor, dayProgress, isoWeekday } from "@/lib/training/session";
import { Bar, ErrorNote, LinkButton, WEEKDAYS } from "./bits";
import { ImportProgram } from "./import-program";
import { useProgram } from "./use-program";

// Pantalla "Hoy" del modo Entreno: semana actual, el día que toca y el resto de la semana.
export function TrainingToday() {
  const { program, setProgram, error, reload } = useProgram();

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (program === undefined) return <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Cargando rutina" />;
  if (program === null) return <EmptyState onImported={reload} />;

  const week = program.currentWeek;
  const goToWeek = (w: number) => {
    if (w < 1 || w > program.weeks) return;
    setProgram({ ...program, currentWeek: w }); // optimista
    setCurrentWeek(createClient(), program.id, w).catch(() => {});
  };

  const today = dayFor(program, isoWeekday());
  const core = program.days.find((d) => d.weekday === null) ?? null;
  const planned = program.days.filter((d) => d.weekday !== null);
  const weekDone =
    planned.length > 0 &&
    planned.every((d) => {
      const p = dayProgress(d, week);
      return p.total > 0 && p.done >= p.total;
    });

  return (
    <>
      <WeekPicker program={program} onChange={goToWeek} />

      <section aria-label="Hoy" className="mb-5 rounded-3xl bg-card p-5">
        <p className="text-sm font-semibold text-subtle">Hoy · {WEEKDAYS[isoWeekday() - 1]}</p>
        {today ? (
          <DayHero day={today} week={week} />
        ) : (
          <>
            <h2 className="mt-1 text-2xl font-bold">Hoy descansas</h2>
            <p className="mt-1 text-sm text-subtle">No tienes ningún día de fuerza asignado a hoy.</p>
            {core && (
              <div className="mt-4">
                <LinkButton href={`/entreno/sesion/${core.id}?semana=${week}`}>Hacer {core.name.toLowerCase()}</LinkButton>
              </div>
            )}
          </>
        )}
      </section>

      {weekDone && week < program.weeks && (
        <section className="mb-5 rounded-3xl bg-primary/10 p-5">
          <h2 className="font-semibold">¡Semana {week} completada! 🎉</h2>
          <button onClick={() => goToWeek(week + 1)} className="mt-3 h-12 w-full rounded-2xl bg-primary font-semibold text-primary-fg active:scale-[0.98]">
            Pasar a la semana {week + 1}
          </button>
        </section>
      )}

      <section aria-label="Esta semana" className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-subtle">Semana {week}</h2>
        <ul className="flex flex-col gap-2">
          {program.days.map((d) => {
            const { done, total } = dayProgress(d, week);
            return (
              <li key={d.id}>
                <Link href={`/entreno/sesion/${d.id}?semana=${week}`} className="block rounded-2xl bg-card p-4 transition active:scale-[0.99]">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{d.name}</p>
                    <p className="shrink-0 text-xs text-subtle">{d.weekday ? WEEKDAYS[d.weekday - 1] : "Descanso activo"}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <Bar value={done} max={total} />
                    </div>
                    <span className="text-xs tabular-nums text-subtle">
                      {done}/{total}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function EmptyState({ onImported }: { onImported: () => Promise<void> }) {
  return (
    <section className="rounded-3xl bg-card p-5">
      <Dumbbell size={32} className="text-primary" />
      <h2 className="mt-3 text-xl font-bold">Crea tu diario de entreno</h2>
      <p className="mt-1 mb-5 text-sm text-subtle">Importa el Excel de tu rutina y se genera solo: días, ejercicios, semanas y todo lo que ya tenías anotado.</p>
      <ImportProgram onImported={onImported} />
    </section>
  );
}

function WeekPicker({ program, onChange }: { program: ProgramData; onChange: (w: number) => void }) {
  const w = program.currentWeek;
  return (
    <div className="mb-5 flex items-center gap-2">
      <button onClick={() => onChange(w - 1)} disabled={w <= 1} aria-label="Semana anterior" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card disabled:opacity-40">
        <ChevronLeft />
      </button>
      <div className="flex-1 text-center">
        <p className="text-lg font-bold">
          Semana {w} <span className="font-normal text-subtle">de {program.weeks}</span>
        </p>
        <p className="text-xs text-subtle">{program.name}</p>
      </div>
      <button onClick={() => onChange(w + 1)} disabled={w >= program.weeks} aria-label="Semana siguiente" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card disabled:opacity-40">
        <ChevronRight />
      </button>
    </div>
  );
}

function DayHero({ day, week }: { day: DayData; week: number }) {
  const { done, total } = dayProgress(day, week);
  const finished = total > 0 && done >= total;
  return (
    <>
      <h2 className="mt-1 text-2xl font-bold">{day.name}</h2>
      <p className="mt-1 text-sm text-subtle">
        {day.exercises.length} ejercicios · {done}/{total} series
      </p>
      <div className="mt-3 mb-4">
        <Bar value={done} max={total} />
      </div>
      <LinkButton href={`/entreno/sesion/${day.id}?semana=${week}`}>{finished ? "Revisar sesión" : done > 0 ? "Continuar entreno" : "Empezar entreno"}</LinkButton>
    </>
  );
}
