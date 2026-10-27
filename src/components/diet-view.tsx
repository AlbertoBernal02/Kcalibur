"use client";

import { ChevronLeft, Circle, CircleCheck, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { deleteDiet, getDiet, updateDiet, type Diet } from "@/lib/data/diets";
import { loadGoals } from "@/lib/data/profile";
import { addMealToDiary, type SavedMeal } from "@/lib/data/saved-meals";
import { normalizeSelection, optionsBySlot, summarizeDay, type Selection } from "@/lib/diet";
import { readSel, selKey } from "@/lib/diet-selection";
import { MEALS, toISO, type Meal } from "@/lib/meals";
import { mealTotals } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/client";
import { DietBulkAddSheet } from "@/components/diet-bulk-add";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

const nf = (n: number) => Math.round(n).toLocaleString("es-ES");

// Dieta: una opción elegida por comida, con el total del "día tipo" calculado automáticamente.
export function DietView({ id }: { id: string }) {
  const router = useRouter();
  const [diet, setDiet] = useState<Diet | null>(null);
  const [goalKcal, setGoalKcal] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bulk, setBulk] = useState(false);

  useEffect(() => {
    getDiet(createClient(), id)
      .then((d) => {
        if (!d) return setError("Dieta no encontrada.");
        setDiet(d);
        setSelection(normalizeSelection(d.options, readSel(id)));
      })
      .catch(() => setError("No se pudo cargar la dieta."));
    loadGoals(createClient()).then((g) => setGoalKcal(g?.kcal ?? null)).catch(() => setGoalKcal(null));
  }, [id]);

  const slots = useMemo(() => (diet ? optionsBySlot(diet.options) : null), [diet]);
  const day = useMemo(() => (diet ? summarizeDay(diet.options, selection) : null), [diet, selection]);

  function choose(slot: Meal, optionId: string) {
    const next = { ...selection, [slot]: optionId };
    setSelection(next);
    try {
      localStorage.setItem(selKey(id), JSON.stringify(next));
    } catch {
      /* sin almacenamiento: la elección solo dura esta pantalla */
    }
  }

  // Añade una o varias opciones al diario de hoy (funciona sin conexión).
  async function addToToday(items: { option: SavedMeal; slot: Meal }[], okText: string) {
    setBusy(true);
    setError(null);
    try {
      const today = toISO(new Date());
      for (const { option, slot } of items) await addMealToDiary(createClient(), option.items, today, slot);
      setNotice(okText);
      setTimeout(() => setNotice(null), 3500);
    } catch {
      setError("No se pudo añadir al diario.");
    } finally {
      setBusy(false);
    }
  }

  function addFullDay() {
    if (!slots) return;
    const items = MEALS.flatMap((m) => {
      const option = slots[m.id].find((o) => o.id === selection[m.id]);
      return option ? [{ option, slot: m.id }] : [];
    });
    addToToday(items, "Día completo añadido a hoy ✓");
  }

  async function remove() {
    if (!diet || !confirm(`¿Borrar la dieta "${diet.name}" y todas sus opciones?`)) return;
    setBusy(true);
    try {
      await deleteDiet(createClient(), id);
      router.replace("/comidas?tab=dietas");
    } catch {
      setError("No se pudo borrar la dieta.");
      setBusy(false);
    }
  }

  if (!diet && error) return <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-danger">{error}</p>;
  if (!diet || !slots || !day) return <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando dieta" />;

  const diff = goalKcal ? day.chosen.kcal - goalKcal : null;

  return (
    <>
      <Link href="/comidas?tab=dietas" className="mb-2 -ml-2 inline-flex h-12 items-center gap-1 px-2 text-primary">
        <ChevronLeft size={22} /> Dietas
      </Link>
      <header className="mb-5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{diet.name}</h1>
          {diet.notes && <p className="mt-1 whitespace-pre-line text-sm text-subtle">{diet.notes}</p>}
        </div>
        <button onClick={() => setEditing(true)} aria-label="Editar nombre y notas" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-subtle active:bg-muted">
          <Pencil size={20} />
        </button>
      </header>

      {notice && <p role="status" className="mb-4 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Total del día tipo, calculado con las opciones elegidas */}
      <section aria-label="Total del día tipo" className="mb-5 rounded-3xl bg-card p-5">
        <p className="text-sm text-subtle">Día tipo con las opciones elegidas</p>
        <p className="text-4xl font-bold">{nf(day.chosen.kcal)} <span className="text-lg font-medium text-subtle">kcal</span></p>
        <p className="mt-1 text-sm">
          <span className="text-protein font-semibold">P {nf(day.chosen.protein_g)} g</span> ·{" "}
          <span className="text-carbs font-semibold">H {nf(day.chosen.carbs_g)} g</span> ·{" "}
          <span className="text-fat font-semibold">G {nf(day.chosen.fat_g)} g</span>
        </p>
        {day.minKcal !== day.maxKcal && (
          <p className="mt-2 text-sm text-subtle">Según las opciones, un día puede sumar entre {nf(day.minKcal)} y {nf(day.maxKcal)} kcal.</p>
        )}
        {diff !== null && day.chosen.kcal > 0 && (
          <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm">
            Tu objetivo es {nf(goalKcal!)} kcal:{" "}
            <span className="font-semibold">
              {Math.abs(diff) < 1 ? "justo en el objetivo" : diff > 0 ? `${nf(diff)} kcal por encima` : `${nf(-diff)} kcal por debajo`}
            </span>
          </p>
        )}
        {day.chosen.kcal > 0 && (
          <Button variant="secondary" className="mt-4" onClick={addFullDay} disabled={busy}>Añadir el día completo a hoy</Button>
        )}
      </section>

      {MEALS.map((m) => {
        const opts = slots[m.id];
        return (
          <section key={m.id} aria-label={m.label} className="mb-4">
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-subtle">
              {m.label}
              <span className="font-normal">{opts.length} {opts.length === 1 ? "opción" : "opciones"}</span>
            </h2>
            <div className="flex flex-col gap-2">
              {opts.map((o) => {
                const t = mealTotals(o.items);
                const selected = selection[m.id] === o.id;
                return (
                  <div key={o.id} className={`flex items-center rounded-2xl bg-card ${selected ? "ring-2 ring-primary" : ""}`}>
                    <button
                      onClick={() => choose(m.id, o.id)}
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Elegir ${o.name} para ${m.label}`}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                    >
                      {selected ? <CircleCheck size={22} className="shrink-0 text-primary" /> : <Circle size={22} className="shrink-0 text-subtle" />}
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium">{o.name}</span>
                        <span className="line-clamp-3 break-words text-sm text-subtle">
                          {o.items.map((i) => `${i.name} (${i.grams} g)`).join(" · ") || "Sin alimentos"}
                        </span>
                        <span className="block text-sm text-subtle">
                          {nf(t.kcal)} kcal · P {nf(t.protein_g)} · H {nf(t.carbs_g)} · G {nf(t.fat_g)}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => addToToday([{ option: o, slot: m.id }], `«${o.name}» añadida a hoy ✓`)}
                      disabled={busy}
                      aria-label={`Añadir ${o.name} a hoy`}
                      className="flex h-12 w-12 shrink-0 items-center justify-center text-primary disabled:opacity-50"
                    >
                      <Plus size={22} />
                    </button>
                    <Link href={`/dietas/${id}/opcion/${o.id}`} aria-label={`Editar ${o.name}`} className="flex h-12 w-12 shrink-0 items-center justify-center text-subtle">
                      <Pencil size={18} />
                    </Link>
                  </div>
                );
              })}
              <Link
                href={`/dietas/${id}/opcion/nueva?meal=${m.id}`}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-primary"
              >
                <Plus size={18} /> Añadir opción a {m.label}
              </Link>
            </div>
          </section>
        );
      })}

      <Button variant="secondary" className="mt-4" onClick={() => setBulk(true)} disabled={busy}>Añadir un alimento a varias opciones</Button>
      <Button variant="secondary" className="mt-3 text-danger" onClick={remove} disabled={busy}>Borrar dieta</Button>

      {bulk && (
        <DietBulkAddSheet
          options={diet.options}
          onClose={() => setBulk(false)}
          onDone={async (count) => {
            setBulk(false);
            // Recarga la dieta para ver el elemento nuevo y el total recalculado.
            try {
              setDiet(await getDiet(createClient(), id));
            } catch {
              setError("Añadido, pero no se pudo refrescar la dieta: recarga la página.");
            }
            setNotice(`Alimento añadido a ${count} ${count === 1 ? "opción" : "opciones"} ✓`);
            setTimeout(() => setNotice(null), 3500);
          }}
        />
      )}

      {editing && (
        <EditDietSheet
          diet={diet}
          onClose={() => setEditing(false)}
          onSaved={(name, notes) => {
            setDiet({ ...diet, name, notes });
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

// Cambiar el nombre y las notas de la dieta (p. ej. indicaciones del nutricionista).
function EditDietSheet({ diet, onClose, onSaved }: { diet: Diet; onClose: () => void; onSaved: (name: string, notes: string | null) => void }) {
  const [name, setName] = useState(diet.name);
  const [notes, setNotes] = useState(diet.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Ponle un nombre a la dieta.");
    setBusy(true);
    setError(null);
    try {
      await updateDiet(createClient(), diet.id, name.trim(), notes.trim() || null);
      onSaved(name.trim(), notes.trim() || null);
    } catch {
      setError("No se pudo guardar.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Editar dieta" onClose={onClose} error={error}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Nombre">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Notas (indicaciones, suplementos…)">
          <textarea className={`${inputCls} h-32 py-3`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
      </form>
    </Sheet>
  );
}
