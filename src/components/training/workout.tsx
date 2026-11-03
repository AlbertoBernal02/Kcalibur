"use client";

import { ArrowLeft, Check, ExternalLink, StickyNote, Timer, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteLog, saveLog, type ExerciseData, type LogRow, type SetValues } from "@/lib/data/training";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { fmtClock, fmtNum } from "@/lib/training/log";
import { isRecord } from "@/lib/training/progress";
import { dayProgress, dayVolume, firstNumber, logOf, previousLog, summarizeLog, targetText, todayISO, withLog } from "@/lib/training/session";
import { inputBase } from "@/components/ui";
import { Bar, ErrorNote } from "./bits";
import { primeAudio, RestTimer, type Rest } from "./rest-timer";
import { useProgram } from "./use-program";

const toNum = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};
const show = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

// Sesión de entreno de un día: series con objetivo, referencia de la semana anterior, registro y descanso.
export function Workout({ dayId, initialWeek }: { dayId: string; initialWeek: number | null }) {
  const { program, setProgram, error } = useProgram();
  const [week, setWeek] = useState<number | null>(initialWeek);
  const [rest, setRest] = useState<Rest | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const closeRest = useCallback(() => setRest(null), []);

  // Mantiene la pantalla encendida durante la sesión (el móvil está apoyado en el banco).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* no soportado o denegado */
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (program === undefined) return <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Cargando sesión" />;
  const day = program?.days.find((d) => d.id === dayId);
  if (!program || !day) return <ErrorNote>No encuentro este día en tu rutina.</ErrorNote>;

  const w = Math.min(week ?? program.currentWeek, program.weeks);
  const { done, total } = dayProgress(day, w);
  const volume = dayVolume(day, w);

  async function onSave(ex: ExerciseData, setIndex: number, v: SetValues) {
    setProblem(null);
    const date = todayISO();
    try {
      const record = isRecord(ex, w, setIndex, v);
      await saveLog(createClient(), await currentUserId(), ex.id, w, setIndex, v, date);
      if (record) {
        setBanner(`¡Récord en ${ex.name}! ${fmtNum(v.weight!)} kg × ${fmtNum(v.reps!)}`);
        setTimeout(() => setBanner(null), 6000);
      }
      const log: LogRow = { week: w, setIndex, weight: v.weight, reps: v.reps, rir: v.rir, note: v.note ?? "", loggedOn: date };
      setProgram((p) => (p ? withLog(p, ex.id, w, setIndex, log) : p));
      if (ex.restSeconds) setRest({ endsAt: Date.now() + ex.restSeconds * 1000, total: ex.restSeconds });
    } catch {
      setProblem("No se pudo guardar la serie. Revisa la conexión e inténtalo de nuevo.");
    }
  }

  async function onUndo(ex: ExerciseData, setIndex: number) {
    setProblem(null);
    try {
      await deleteLog(createClient(), ex.id, w, setIndex);
      setProgram((p) => (p ? withLog(p, ex.id, w, setIndex, null) : p));
    } catch {
      setProblem("No se pudo desmarcar la serie.");
    }
  }

  return (
    <>
      <Link href="/entreno" className="mb-3 inline-flex h-11 items-center gap-1 text-sm text-subtle">
        <ArrowLeft size={18} /> Entreno
      </Link>
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">{day.name}</h1>
        <p className="mt-1 text-subtle">
          Semana {w} · {done}/{total} series{volume > 0 ? ` · ${fmtNum(Math.round(volume))} kg movidos` : ""}
        </p>
        <div className="mt-3">
          <Bar value={done} max={total} />
        </div>
      </header>

      <nav aria-label="Semana" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {Array.from({ length: program.weeks }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => setWeek(n)}
            aria-current={n === w ? "true" : undefined}
            className={`h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${n === w ? "bg-primary text-primary-fg" : "bg-card text-subtle"}`}
          >
            S{n}
          </button>
        ))}
      </nav>

      {problem && <ErrorNote>{problem}</ErrorNote>}
      {banner && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-primary/15 px-4 py-3 text-sm font-semibold text-primary">
          <Trophy size={18} /> {banner}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {day.exercises.map((ex) => (
          <ExerciseCard key={ex.id} ex={ex} week={w} onSave={onSave} onUndo={onUndo} />
        ))}
      </div>

      {rest && <RestTimer rest={rest} onChange={setRest} onClose={closeRest} />}
    </>
  );
}

function ExerciseCard({ ex, week, onSave, onUndo }: { ex: ExerciseData; week: number; onSave: (ex: ExerciseData, i: number, v: SetValues) => Promise<void>; onUndo: (ex: ExerciseData, i: number) => Promise<void> }) {
  const sets = ex.plan[week] ?? [];
  return (
    <section aria-label={ex.name} className="rounded-3xl bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h2 className="text-lg font-bold leading-tight">{ex.name}</h2>
          {ex.notes && <p className="mt-0.5 text-xs text-subtle">{ex.notes}</p>}
          {ex.restSeconds ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-subtle">
              <Timer size={14} /> Descanso {fmtClock(ex.restSeconds)}
            </p>
          ) : null}
        </div>
        {ex.videoUrl && (
          <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Vídeo de ${ex.name}`} className="flex h-11 w-11 items-center justify-center text-subtle">
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      {sets.length === 0 ? (
        <p className="mt-3 text-sm text-subtle">Este ejercicio no tiene series en la semana {week}.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {sets.map((target, i) => (
            <SetRow key={`${ex.id}-${week}-${i}`} ex={ex} week={week} index={i} target={target} onSave={onSave} onUndo={onUndo} />
          ))}
        </ol>
      )}
    </section>
  );
}

function SetRow({ ex, week, index, target, onSave, onUndo }: { ex: ExerciseData; week: number; index: number; target: ExerciseData["plan"][number][number]; onSave: (ex: ExerciseData, i: number, v: SetValues) => Promise<void>; onUndo: (ex: ExerciseData, i: number) => Promise<void> }) {
  const existing = logOf(ex, week, index);
  const prev = previousLog(ex, week, index);
  const start = existing ?? prev;
  const [weight, setWeight] = useState(show(start?.weight));
  const [reps, setReps] = useState(show(start?.reps));
  const [rir, setRir] = useState(existing ? show(existing.rir) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const done = !!existing;
  const repsHint = firstNumber(target.reps);

  const values = (): SetValues => ({ weight: toNum(weight), reps: toNum(reps) ?? repsHint, rir: toNum(rir), note: note.trim() });

  async function toggle() {
    primeAudio();
    setBusy(true);
    if (done) await onUndo(ex, index);
    else await onSave(ex, index, values());
    setBusy(false);
  }

  // Si la serie ya estaba hecha y se corrige un valor, se vuelve a guardar al salir del campo (sin reiniciar el descanso).
  async function resave() {
    if (!done) return;
    const v = values();
    if (v.weight === existing.weight && v.reps === existing.reps && v.rir === existing.rir && v.note === existing.note) return;
    await onSave({ ...ex, restSeconds: null }, index, v);
  }

  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-subtle">
        <span>
          <span className="font-semibold text-foreground">Serie {index + 1}</span> · {targetText(target)}
        </span>
        {prev && !done && <span className="shrink-0">Antes: {summarizeLog(prev)}</span>}
        <button onClick={() => setShowNote((x) => !x)} aria-label={`Nota de la serie ${index + 1} de ${ex.name}`} aria-expanded={showNote} className={`-my-3 flex h-11 w-11 shrink-0 items-center justify-center ${note ? "text-primary" : "text-subtle"}`}>
          <StickyNote size={16} />
        </button>
      </div>
      {showNote && (
        <input className={`${inputBase} mb-2 h-11 w-full text-sm`} aria-label={`Texto de la nota de la serie ${index + 1}`} placeholder="Nota (sensaciones, ajustes…)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={resave} />
      )}
      <div className="grid grid-cols-[1fr_1fr_4rem_3rem] gap-2">
        <input className={`${inputBase} h-12 text-center ${done ? "bg-primary/10" : ""}`} inputMode="decimal" aria-label={`Peso serie ${index + 1} de ${ex.name} (kg)`} placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={resave} />
        <input className={`${inputBase} h-12 text-center ${done ? "bg-primary/10" : ""}`} inputMode="decimal" aria-label={`Repeticiones serie ${index + 1} de ${ex.name}`} placeholder={repsHint ? String(repsHint) : "reps"} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={resave} />
        <input className={`${inputBase} h-12 px-1 text-center ${done ? "bg-primary/10" : ""}`} inputMode="decimal" aria-label={`RIR serie ${index + 1} de ${ex.name}`} placeholder="RIR" value={rir} onChange={(e) => setRir(e.target.value)} onBlur={resave} />
        <button
          onClick={toggle}
          disabled={busy}
          aria-pressed={done}
          aria-label={done ? `Desmarcar serie ${index + 1} de ${ex.name}` : `Marcar serie ${index + 1} de ${ex.name} como hecha`}
          className={`flex h-12 items-center justify-center rounded-2xl border transition active:scale-95 ${done ? "border-primary bg-primary text-primary-fg" : "border-border bg-card text-subtle"}`}
        >
          <Check size={22} strokeWidth={done ? 3 : 2} />
        </button>
      </div>
    </li>
  );
}
