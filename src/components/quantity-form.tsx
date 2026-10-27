"use client";

import { useState } from "react";
import { scaleMacros, type Per100 } from "@/lib/nutrition";
import { Button, Field, inputCls } from "@/components/ui";

type Props = {
  name: string;
  per100: Per100;
  servingG: number | null;
  initialGrams?: number;
  initialUnit?: "g" | "serving"; // "serving" empieza en 1 ración (recetas)
  // Por defecto Ración/Raciones; comida fuera: Unidad/Unidades; AOVE en spray: Puff/Puffs (y 10 por defecto).
  servingNames?: { one: string; many: string; defaultCount?: number };
  submitLabel: string;
  onSubmit: (grams: number, servingG: number | null, macros: Per100) => void;
  busy?: boolean;
  onDelete?: () => void;
};

// Cantidad por gramos o raciones con macros calculados en vivo.
export function QuantityForm({ name, per100, servingG, initialGrams, initialUnit, servingNames, submitLabel, onSubmit, busy, onDelete }: Props) {
  const names = servingNames ?? { one: "Ración", many: "Raciones" };
  const startInServings = initialUnit === "serving" && !!servingG;
  const [unit, setUnit] = useState<"g" | "serving">(startInServings ? "serving" : "g");
  const [amount, setAmount] = useState(
    startInServings ? String(names.defaultCount ?? 1) : initialGrams ? String(initialGrams) : servingG ? String(servingG) : "100",
  );

  const value = Number(amount.replace(",", "."));
  const grams = unit === "g" ? value : value * (servingG ?? 0);
  const valid = Number.isFinite(grams) && grams > 0 && grams <= 10000;
  const m = valid ? scaleMacros(per100, grams) : null;

  // Al cambiar de unidad se convierte la cantidad para no perder lo escrito.
  function changeUnit(next: "g" | "serving") {
    if (next === unit) return;
    if (valid && servingG) setAmount(String(next === "g" ? Math.round(grams * 10) / 10 : Math.round((grams / servingG) * 100) / 100));
    setUnit(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (m) onSubmit(Math.round(grams * 10) / 10, servingG, m);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-lg font-semibold">{name}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={unit === "g" ? "Cantidad (g)" : names.many}>
          <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Unidad">
          <select className={inputCls} value={unit} onChange={(e) => changeUnit(e.target.value as "g" | "serving")}>
            <option value="g">Gramos</option>
            {servingG && <option value="serving">{names.one} ({servingG} g)</option>}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card p-3 text-center" aria-live="polite">
        <Stat label="kcal" value={m?.kcal} color="text-foreground" />
        <Stat label="Prot." value={m?.protein_g} color="text-protein" />
        <Stat label="Hidr." value={m?.carbs_g} color="text-carbs" />
        <Stat label="Grasa" value={m?.fat_g} color="text-fat" />
      </div>
      {unit === "serving" && valid && <p className="text-sm text-subtle">= {Math.round(grams * 10) / 10} g</p>}

      <Button type="submit" disabled={!valid || busy}>{busy ? "Guardando…" : submitLabel}</Button>
      {onDelete && (
        <Button type="button" variant="secondary" className="text-danger" onClick={onDelete} disabled={busy}>
          Borrar entrada
        </Button>
      )}
    </form>
  );
}

function Stat({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value === undefined ? "–" : Math.round(value)}</p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}
