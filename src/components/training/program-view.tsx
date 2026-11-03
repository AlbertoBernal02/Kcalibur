"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteProgram } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/client";
import { fmtClock } from "@/lib/training/log";
import { Button } from "@/components/ui";
import { ErrorNote, WEEKDAYS } from "./bits";
import { ImportProgram } from "./import-program";
import { useProgram } from "./use-program";

// Pantalla "Rutina": todo el programa (días y ejercicios con sus objetivos) + importar otra / borrar.
export function ProgramView() {
  const { program, error, reload } = useProgram();
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (program === undefined) return <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Cargando rutina" />;
  if (program === null) return <ImportProgram onImported={reload} />;

  async function remove() {
    if (!program || !confirm(`¿Borrar la rutina «${program.name}» con todo su histórico? No se puede deshacer.`)) return;
    try {
      await deleteProgram(createClient(), program.id);
      await reload();
    } catch {
      setMsg("No se pudo borrar la rutina.");
    }
  }

  return (
    <>
      <p className="mb-4 text-sm text-subtle">
        {program.name} · {program.weeks} semanas
      </p>
      {msg && <ErrorNote>{msg}</ErrorNote>}
      {program.days.map((d) => (
        <section key={d.id} className="mb-4 rounded-3xl bg-card p-5">
          <p className="text-xs font-semibold text-subtle">{d.weekday ? WEEKDAYS[d.weekday - 1] : "Descanso activo"}</p>
          <h2 className="text-lg font-bold">{d.name}</h2>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {d.exercises.map((e) => {
              const sets = e.plan[program.currentWeek] ?? [];
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-subtle">
                      {sets.length} series{sets[0] ? ` · ${sets[0].reps}` : ""}
                      {e.restSeconds ? ` · descanso ${fmtClock(e.restSeconds)}` : ""}
                    </p>
                  </div>
                  {e.videoUrl && (
                    <a href={e.videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Vídeo de ${e.name}`} className="flex h-11 w-11 items-center justify-center text-subtle">
                      <ExternalLink size={18} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="mt-6 flex flex-col gap-3">
        <ImportProgram replacing onImported={reload} />
        <Button variant="secondary" onClick={remove} className="flex items-center justify-center gap-2 text-danger">
          <Trash2 size={18} /> Borrar esta rutina
        </Button>
      </div>
    </>
  );
}
