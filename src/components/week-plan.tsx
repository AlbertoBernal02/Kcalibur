"use client";

import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listDiets, type Diet } from "@/lib/data/diets";
import { fillPlan, loadPlan, setPlanned, type PlanRow } from "@/lib/data/plan";
import { addMealToDiary, listSavedMeals, type SavedMeal } from "@/lib/data/saved-meals";
import { normalizeSelection } from "@/lib/diet";
import { readSel } from "@/lib/diet-selection";
import { MEALS, addDays, longDate, toISO, type Meal } from "@/lib/meals";
import { mondayOf, shoppingList, weekDays } from "@/lib/plan";
import { mealTotals } from "@/lib/recipes";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";

const nf = (n: number) => Math.round(n).toLocaleString("es-ES");
const slotKey = (date: string, meal: Meal) => `${date}|${meal}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shortDate = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);

// "Hoy" se calcula tras montar (la página se prerrenderiza sin conocer la fecha ni la zona horaria del usuario).
export function WeekPlan() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(toISO(new Date()));
  }, []);
  if (!today) return <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando semana" />;
  return <Week today={today} />;
}

type Pool = { diets: Diet[]; saved: SavedMeal[] };

// Plan de la semana: una opción por comida y día, lista de la compra y atajo para pasar un día al diario.
function Week({ today }: { today: string }) {
  const [monday, setMonday] = useState(mondayOf(today));
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<{ date: string; meal: Meal } | null>(null);
  const [shopping, setShopping] = useState(false);

  const days = useMemo(() => weekDays(monday), [monday]);

  // Opciones de dieta y comidas guardadas disponibles para planificar (se cargan una vez).
  useEffect(() => {
    Promise.all([listDiets(createClient()), listSavedMeals(createClient())])
      .then(([diets, saved]) => setPool({ diets, saved }))
      .catch(() => setError("No se pudieron cargar tus dietas y comidas."));
  }, []);

  // Plan de la semana mostrada; `stale` evita pisar el resultado si se cambia de semana rápido.
  useEffect(() => {
    let stale = false;
    loadPlan(createClient(), days[0], days[6])
      .then((r) => !stale && setRows(r))
      .catch(() => !stale && setError("No se pudo cargar el plan de la semana."));
    return () => {
      stale = true;
    };
  }, [days]);

  const reload = useCallback(async () => setRows(await loadPlan(createClient(), days[0], days[6])), [days]);

  const bySlot = useMemo(() => new Map((rows ?? []).map((r) => [slotKey(r.date, r.meal), r.option])), [rows]);
  const dayKcal = (date: string) => MEALS.reduce((a, m) => a + (bySlot.has(slotKey(date, m.id)) ? mealTotals(bySlot.get(slotKey(date, m.id))!.items).kcal : 0), 0);

  // Ejecuta una escritura, recarga la semana y avisa; muestra el error si falla.
  async function run(action: () => Promise<void>, failText: string, okText?: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      if (okText) {
        setNotice(okText);
        setTimeout(() => setNotice(null), 3500);
      }
    } catch {
      setError(failText);
    } finally {
      setBusy(false);
    }
  }

  // Rellena los huecos vacíos con las opciones que tienes elegidas en tu dieta más reciente.
  function fillWithDiet() {
    const diet = pool?.diets.find((d) => d.options.length > 0);
    if (!diet) return setError("Todavía no tienes ninguna dieta con opciones.");
    const sel = normalizeSelection(diet.options, readSel(diet.id));
    const slots = days.flatMap((date) =>
      MEALS.flatMap((m) => (sel[m.id] && !bySlot.has(slotKey(date, m.id)) ? [{ date, meal: m.id, optionId: sel[m.id]! }] : [])),
    );
    if (slots.length === 0) return setNotice("No hay huecos que rellenar.");
    run(async () => fillPlan(createClient(), await currentUserId(), slots), "No se pudo rellenar la semana.", `Rellenados ${slots.length} huecos con «${diet.name}» ✓`);
  }

  // Pasa al diario del día todas sus comidas planificadas.
  function addDayToDiary(date: string) {
    const items = MEALS.flatMap((m) => (bySlot.has(slotKey(date, m.id)) ? [{ meal: m.id, option: bySlot.get(slotKey(date, m.id))! }] : []));
    run(async () => {
      for (const { meal, option } of items) await addMealToDiary(createClient(), option.items, date, meal);
    }, "No se pudo añadir el día al diario.", `Día añadido al diario (${shortDate(date)}) ✓`);
  }

  const lines = useMemo(() => shoppingList((rows ?? []).flatMap((r) => r.option.items.map((i) => ({ food_id: i.food_id, name: i.name, grams: i.grams })))), [rows]);

  return (
    <>
      <div className="mb-3 flex items-center gap-1">
        <button onClick={() => setMonday(addDays(monday, -7))} aria-label="Semana anterior" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-semibold">{monday === mondayOf(today) ? "Esta semana" : `Semana del ${shortDate(days[0])}`}</p>
          <p className="text-xs text-subtle">{shortDate(days[0])} – {shortDate(days[6])}</p>
        </div>
        <button onClick={() => setMonday(addDays(monday, 7))} aria-label="Semana siguiente" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={fillWithDiet} disabled={busy || !pool || !rows}>Rellenar con mi dieta</Button>
        <Button variant="secondary" onClick={() => setShopping(true)} disabled={!rows || lines.length === 0} className="flex items-center justify-center gap-2">
          <ShoppingCart size={18} /> Lista de la compra
        </Button>
      </div>

      {notice && <p role="status" className="mb-3 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</p>}
      {error && !picking && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {!rows ? (
        <div className="flex flex-col gap-3" aria-label="Cargando plan">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-muted" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((date) => {
            const kcal = dayKcal(date);
            return (
              <section key={date} aria-label={longDate(date)} className={`rounded-3xl bg-card p-3 ${date === today ? "ring-2 ring-primary" : ""}`}>
                <div className="mb-1 flex items-center gap-2 px-1">
                  <h3 className="flex-1 font-semibold">{cap(longDate(date))}{date === today && <span className="ml-2 text-xs font-medium normal-case text-primary">hoy</span>}</h3>
                  {kcal > 0 && <span className="text-sm text-subtle">{nf(kcal)} kcal</span>}
                </div>
                <ul>
                  {MEALS.map((m) => {
                    const option = bySlot.get(slotKey(date, m.id));
                    return (
                      <li key={m.id}>
                        <button onClick={() => { setError(null); setPicking({ date, meal: m.id }); }} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-muted">
                          <span className="w-20 shrink-0 text-xs font-medium text-subtle">{m.label}</span>
                          {option ? (
                            <>
                              <span className="min-w-0 flex-1 break-words text-sm font-medium">{option.name}</span>
                              <span className="shrink-0 text-xs text-subtle">{nf(mealTotals(option.items).kcal)}</span>
                            </>
                          ) : (
                            <span className="flex-1 text-sm text-subtle">+ Elegir</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {kcal > 0 && (
                  <button onClick={() => addDayToDiary(date)} disabled={busy} className="mt-1 h-10 w-full rounded-xl text-sm font-semibold text-primary active:bg-muted disabled:opacity-50">
                    Añadir este día al diario
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {picking && pool && (
        <PickSheet
          meal={picking.meal}
          date={picking.date}
          pool={pool}
          current={bySlot.get(slotKey(picking.date, picking.meal))?.id ?? null}
          busy={busy}
          error={error}
          onClose={() => { setPicking(null); setError(null); }}
          onPick={(optionId) =>
            run(async () => {
              await setPlanned(createClient(), await currentUserId(), picking.date, picking.meal, optionId);
              setPicking(null);
            }, "No se pudo guardar el plan.")
          }
        />
      )}

      {shopping && <ShoppingSheet lines={lines} range={`${shortDate(days[0])} – ${shortDate(days[6])}`} onClose={() => setShopping(false)} />}
    </>
  );
}

// Elegir qué toca en una comida: opciones de tus dietas y comidas guardadas.
function PickSheet({ meal, date, pool, current, busy, error, onClose, onPick }: {
  meal: Meal; date: string; pool: Pool; current: string | null; busy: boolean; error: string | null;
  onClose: () => void; onPick: (optionId: string | null) => void;
}) {
  const label = MEALS.find((m) => m.id === meal)!.label;
  const groups = [
    ...pool.diets.map((d) => ({ title: d.name, options: d.options.filter((o) => o.dietMeal === meal) })),
    { title: "Mis comidas", options: pool.saved.filter((s) => s.kind === "meal") },
  ].filter((g) => g.options.length > 0);

  return (
    <Sheet title={`${label} · ${shortDate(date)}`} onClose={onClose} error={error}>
      <div className="flex flex-col gap-4">
        {groups.length === 0 && <p className="py-6 text-center text-sm text-subtle">Aún no tienes opciones para esta comida. Crea una dieta o una comida guardada.</p>}
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <h3 className="px-1 text-sm font-semibold text-subtle">{g.title}</h3>
            {g.options.map((o) => (
              <button
                key={o.id}
                onClick={() => onPick(o.id)}
                disabled={busy}
                className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left transition active:scale-[0.99] ${o.id === current ? "ring-2 ring-primary" : ""}`}
              >
                <span className="min-w-0 flex-1 break-words font-medium">{o.name}</span>
                <span className="shrink-0 text-sm font-semibold">{nf(mealTotals(o.items).kcal)} kcal</span>
              </button>
            ))}
          </div>
        ))}
        {current && <Button variant="secondary" className="text-danger" onClick={() => onPick(null)} disabled={busy}>Quitar de este día</Button>}
      </div>
    </Sheet>
  );
}

// Lista de la compra de la semana: cantidades sumadas, con casillas para ir marcando y copiar como texto.
function ShoppingSheet({ lines, range, onClose }: { lines: { key: string; name: string; grams: number }[]; range: string; onClose: () => void }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const toggle = (key: string) =>
    setDone((cur) => {
      const next = new Set(cur);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  async function copy() {
    const text = `Lista de la compra (${range})\n` + lines.map((l) => `- ${l.name}: ${nf(l.grams)} g`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sin permiso de portapapeles: la lista sigue visible para copiarla a mano */
    }
  }

  return (
    <Sheet title="Lista de la compra" onClose={onClose}>
      <p className="mb-3 text-sm text-subtle">Semana {range}. Cantidades en el peso que indica la dieta (normalmente cocinado: no se convierte a crudo).</p>
      <ul className="flex flex-col gap-1.5">
        {lines.map((l) => (
          <li key={l.key}>
            <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
              <input type="checkbox" checked={done.has(l.key)} onChange={() => toggle(l.key)} className="h-5 w-5 shrink-0 accent-primary" />
              <span className={`min-w-0 flex-1 break-words ${done.has(l.key) ? "text-subtle line-through" : "font-medium"}`}>{l.name}</span>
              <span className="shrink-0 font-semibold">{nf(l.grams)} g</span>
            </label>
          </li>
        ))}
      </ul>
      <Button className="mt-4" onClick={copy}>{copied ? "Copiada ✓" : "Copiar lista"}</Button>
    </Sheet>
  );
}
