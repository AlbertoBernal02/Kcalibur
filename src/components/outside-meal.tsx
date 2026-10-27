"use client";

import { Pencil, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Estimate } from "@/lib/ai/estimate";
import { requestEstimate } from "@/lib/ai/estimate-client";
import { addEntries, type Entry } from "@/lib/data/diary";
import type { Food } from "@/lib/data/foods";
import { createSavedMeal, entriesToItems } from "@/lib/data/saved-meals";
import { MAX_DISH_KCAL, outsideEntry, parseAmount, scaleDish, type OutsideDish } from "@/lib/external";
import { MEALS, mealByHour, toISO, type Meal } from "@/lib/meals";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { FoodPicker } from "@/components/food-picker";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputBase, inputCls } from "@/components/ui";

type Write = (action: () => Promise<void>, failText: string, okText?: string) => void;

const nf = (n: number) => Math.round(n).toLocaleString("es-ES");

// Añade platos de fuera al diario. Si se pide, antes los guarda como comida reutilizable (necesita conexión:
// si falla no se añade nada y el error es fiel a lo ocurrido).
async function addOutside(dishes: OutsideDish[], date: string, meal: Meal, saveName: string | null) {
  const sb = createClient();
  const entries = dishes.map((d) => outsideEntry(d, date, meal));
  if (saveName) {
    const items = entriesToItems(entries.map((e) => ({ ...e, id: "" }) as Entry));
    await createSavedMeal(sb, await currentUserId(), { name: saveName, kind: "meal", servings: 1, dietId: null, dietMeal: null, items });
  }
  await addEntries(sb, entries);
}

// Pestaña "Fuera" de la hoja de añadir: estimar con IA, calorías directas o contar por unidades.
export function OutsidePanel({ meal, date, label, busy, onWrite, onPickFood }: {
  meal: Meal; date: string; label: string; busy: boolean; onWrite: Write; onPickFood: (f: Food) => void;
}) {
  const [view, setView] = useState<"home" | "ai" | "direct">("home");

  if (view !== "home") {
    return (
      <>
        <button onClick={() => setView("home")} className="mb-3 h-10 text-sm font-medium text-primary">← Volver</button>
        {view === "ai" ? (
          <AiEstimate meal={meal} date={date} label={label} busy={busy} onWrite={onWrite} />
        ) : (
          <DishForm
            allowSave
            submitLabel={`Añadir a ${label}`}
            busy={busy}
            onSubmit={(dish, save) => onWrite(() => addOutside([dish], date, meal, save ? dish.name : null), "No se pudo añadir. Si guardas en Mis comidas necesitas conexión.")}
          />
        )}
      </>
    );
  }

  const cards = [
    { id: "ai", icon: <Sparkles size={22} />, title: "Estimar con IA", hint: "Cuéntalo con tus palabras" },
    { id: "direct", icon: <Pencil size={22} />, title: "Calorías directas", hint: "Si ya sabes los números" },
  ] as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <button key={c.id} onClick={() => setView(c.id)} className="flex flex-col items-start gap-1 rounded-2xl bg-card px-4 py-3 text-left text-primary transition active:scale-[0.99]">
            {c.icon}
            <span className="font-semibold text-foreground">{c.title}</span>
            <span className="text-xs text-subtle">{c.hint}</span>
          </button>
        ))}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-subtle">O cuenta por unidades</h3>
      <p className="-mt-2 text-xs text-subtle">Piezas de sushi, tacos, porciones de pizza… Elige y pon cuántas.</p>
      <FoodPicker category="comida_fuera" onPick={onPickFood} />
    </div>
  );
}

type DishInitial = { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number };

// Formulario de un plato con kcal y macros directos (crear o editar). Los macros son opcionales (vacío = 0).
export function DishForm({ initial, submitLabel, busy, allowSave, onSubmit, onDelete }: {
  initial?: DishInitial; submitLabel: string; busy?: boolean; allowSave?: boolean;
  onSubmit: (dish: OutsideDish, saveAsMeal: boolean) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : "");
  const [p, setP] = useState(initial ? String(initial.protein_g) : "");
  const [c, setC] = useState(initial ? String(initial.carbs_g) : "");
  const [f, setF] = useState(initial ? String(initial.fat_g) : "");
  const [save, setSave] = useState(false);

  const k = parseAmount(kcal, MAX_DISH_KCAL);
  const pv = parseAmount(p, 800, true), cv = parseAmount(c, 800, true), fv = parseAmount(f, 800, true);
  const valid = name.trim().length > 0 && k !== null && pv !== null && cv !== null && fv !== null;
  const macro = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder="0" />
    </Field>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ name: name.trim(), kcal: k, protein_g: pv, carbs_g: cv, fat_g: fv }, save);
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Qué has comido">
        <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pizza Domino's (3 porciones)" autoFocus={!initial} />
      </Field>
      <Field label="Calorías (kcal)">
        <input className={inputCls} inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="Ej. 850" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {macro("Prot. (g)", p, setP)}
        {macro("Hidr. (g)", c, setC)}
        {macro("Grasa (g)", f, setF)}
      </div>
      <p className="-mt-2 text-xs text-subtle">Proteína, hidratos y grasa son opcionales.</p>
      {allowSave && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-5 w-5 accent-primary" />
          Guardar en «Mis comidas» para repetirlo
        </label>
      )}
      <Button type="submit" disabled={!valid || busy}>{busy ? "Guardando…" : submitLabel}</Button>
      {onDelete && (
        <Button type="button" variant="secondary" className="text-danger" onClick={onDelete} disabled={busy}>
          Borrar entrada
        </Button>
      )}
    </form>
  );
}

// Describe la comida → la IA estima kcal y macros por elemento (editables) con un rango → se añade al diario.
function AiEstimate({ meal, date, label, busy, onWrite, initialText, autoRun }: {
  meal: Meal; date: string; label: string; busy: boolean; onWrite: Write; initialText?: string; autoRun?: boolean;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [est, setEst] = useState<Estimate | null>(null);
  const [kcalText, setKcalText] = useState<string[]>([]);
  const [high, setHigh] = useState(false);
  const [save, setSave] = useState(false);
  const [saveName, setSaveName] = useState("");

  async function estimate() {
    setLoading(true);
    setError(null);
    setEst(null);
    try {
      const r = await requestEstimate(text.trim());
      if (r.items.length === 0) throw new Error("No he encontrado comida en esa descripción. Prueba a detallarla un poco más.");
      setEst(r);
      setKcalText(r.items.map((i) => String(Math.round(i.kcal))));
      setHigh(false);
      setSaveName(text.trim().slice(0, 50));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo estimar.");
    } finally {
      setLoading(false);
    }
  }

  const started = useRef(false);
  useEffect(() => {
    if (autoRun && text.trim() && !started.current) {
      started.current = true;
      void estimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  // Platos finales: kcal editadas (los macros escalan con ellas) y, si se pide, el valor alto del rango.
  const edited = est ? kcalText.map((t) => parseAmount(t, MAX_DISH_KCAL)) : [];
  const allValid = edited.length > 0 && edited.every((k) => k !== null);
  const base = est ? est.items.reduce((a, i) => a + i.kcal, 0) : 0;
  const highFactor = est && high && base > 0 ? est.kcal_max / base : 1;
  const dishes: OutsideDish[] = est && allValid
    ? est.items.map((it, i) => {
        const k = edited[i]!;
        const d = it.kcal > 0 ? scaleDish(it, k / it.kcal) : { ...it, kcal: k };
        return scaleDish(d, highFactor);
      })
    : [];
  const total = dishes.reduce((a, d) => a + d.kcal, 0);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Cuéntame qué has comido">
        <textarea
          className="min-h-24 w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none transition focus:border-primary"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. buffet de tacos de TeQuieroTaco: 6 tacos, nachos con queso y 2 cervezas"
          autoFocus={!initialText}
        />
      </Field>
      <Button onClick={estimate} disabled={!text.trim() || loading} className="flex items-center justify-center gap-2">
        <Sparkles size={18} /> {loading ? "Estimando…" : est ? "Volver a estimar" : "Estimar"}
      </Button>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {est && (
        <>
          <ul className="flex flex-col gap-2" aria-label="Elementos estimados">
            {est.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{it.name}</span>
                  <span className="block text-xs text-subtle">P {Math.round(it.protein_g)} · H {Math.round(it.carbs_g)} · G {Math.round(it.fat_g)}</span>
                </span>
                <input
                  aria-label={`kcal de ${it.name}`}
                  className={`h-11 w-24 text-right ${inputBase} ${edited[i] === null ? "border-danger" : ""}`}
                  inputMode="decimal"
                  value={kcalText[i]}
                  onChange={(e) => setKcalText((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
            <p className="text-2xl font-bold">{nf(total)} <span className="text-base font-medium text-subtle">kcal</span></p>
            <p className="text-subtle">Rango estimado: {nf(est.kcal_min)}–{nf(est.kcal_max)} kcal</p>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} className="h-5 w-5 accent-primary" />
            Apuntar el valor alto del rango (por si acaso)
          </label>
          <p className="-mt-2 text-xs text-subtle">Es una estimación de la IA y puede fallar un 20–30 %, sobre todo en buffets. Ajusta las kcal si sabes más.</p>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-5 w-5 accent-primary" />
            Guardar en «Mis comidas» para repetirlo
          </label>
          {save && (
            <Field label="Nombre de la comida guardada">
              <input className={inputCls} value={saveName} maxLength={80} onChange={(e) => setSaveName(e.target.value)} />
            </Field>
          )}
          <Button
            disabled={!allValid || busy || (save && !saveName.trim())}
            onClick={() => onWrite(() => addOutside(dishes, date, meal, save ? saveName.trim() : null), "No se pudo añadir. Si guardas en Mis comidas necesitas conexión.")}
          >
            {busy ? "Añadiendo…" : `Añadir a ${label}`}
          </Button>
        </>
      )}
    </div>
  );
}

// Desde el chat: estima la comida que el usuario ha contado y la añade al diario de hoy (a la comida elegida).
export function EstimateToDiarySheet({ text, onClose, onAdded }: { text: string; onClose: () => void; onAdded: (mealLabel: string) => void }) {
  const [date] = useState(() => toISO(new Date()));
  const [meal, setMeal] = useState<Meal>(() => mealByHour(new Date().getHours()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = MEALS.find((m) => m.id === meal)!.label;

  // Misma lógica que el diario: bloquea el botón mientras escribe y muestra el fallo dentro de la hoja.
  const onWrite: Write = async (action, failText) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onAdded(label);
    } catch {
      setError(failText);
      setBusy(false);
    }
  };

  return (
    <Sheet title="Añadir al diario" onClose={onClose} error={error}>
      <div className="flex flex-col gap-4">
        <Field label="Comida de hoy">
          <select className={inputCls} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <AiEstimate meal={meal} date={date} label={label} busy={busy} onWrite={onWrite} initialText={text.slice(0, 500)} autoRun />
      </div>
    </Sheet>
  );
}
