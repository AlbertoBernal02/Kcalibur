"use client";

import { useEffect, useMemo, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/data/profile";
import {
  ACTIVITY,
  GOAL,
  ageFromBirth,
  kcalFromMacros,
  suggestGoals,
  tdee,
  type Activity,
  type Goal,
  type Sex,
} from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Section, inputCls } from "@/components/ui";

// Estado del formulario: todo como texto para poder editar cómodamente.
type Form = {
  name: string;
  sex: Sex | "";
  birth: string;
  height: string;
  weight: string;
  activity: Activity | "";
  goal: Goal | "";
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

const EMPTY: Form = {
  name: "", sex: "", birth: "", height: "", weight: "", activity: "", goal: "",
  kcal: "", protein: "", carbs: "", fat: "",
};

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

export function ProfileForm() {
  const [f, setF] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  // Carga inicial desde Supabase.
  useEffect(() => {
    loadProfile(createClient())
      .then(({ profile: p, goals: g }) =>
        setF({
          name: p?.display_name ?? "",
          sex: p?.sex ?? "",
          birth: p?.birth_date ?? "",
          height: p?.height_cm?.toString() ?? "",
          weight: p?.weight_kg?.toString() ?? "",
          activity: p?.activity ?? "",
          goal: p?.goal ?? "",
          kcal: g?.kcal.toString() ?? "",
          protein: g?.protein_g.toString() ?? "",
          carbs: g?.carbs_g.toString() ?? "",
          fat: g?.fat_g.toString() ?? "",
        }),
      )
      .catch(() => setMsg({ ok: false, text: "No se pudo cargar tu perfil. Revisa la conexión." }))
      .finally(() => setLoading(false));
  }, []);

  // Gasto estimado: solo si están todos los datos y son razonables.
  const estimate = useMemo(() => {
    const w = num(f.weight), h = num(f.height);
    if (!f.sex || !f.birth || !f.activity || !(w >= 30) || !(h >= 100)) return null;
    const age = ageFromBirth(f.birth);
    if (!(age >= 10 && age <= 100)) return null;
    return { age, tdee: tdee(f.sex, w, h, age, f.activity) };
  }, [f.sex, f.birth, f.weight, f.height, f.activity]);

  // Rellena los objetivos con la sugerencia calculada.
  function applySuggestion() {
    if (!estimate || !f.goal) return;
    const g = suggestGoals(estimate.tdee, num(f.weight), f.goal);
    setF((p) => ({ ...p, kcal: String(g.kcal), protein: String(g.protein_g), carbs: String(g.carbs_g), fat: String(g.fat_g) }));
  }

  const goalsNum = { kcal: num(f.kcal), protein_g: num(f.protein), carbs_g: num(f.carbs), fat_g: num(f.fat) };
  const macroKcal = [goalsNum.protein_g, goalsNum.carbs_g, goalsNum.fat_g].every((n) => n >= 0) ? kcalFromMacros(goalsNum) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const h = num(f.height), w = num(f.weight);
    if (f.height && !(h >= 100 && h <= 250)) return setMsg({ ok: false, text: "La altura debe estar entre 100 y 250 cm." });
    if (f.weight && !(w >= 30 && w <= 300)) return setMsg({ ok: false, text: "El peso debe estar entre 30 y 300 kg." });
    const g = goalsNum;
    if (![g.kcal, g.protein_g, g.carbs_g, g.fat_g].every((n) => Number.isFinite(n) && n >= 0) || g.kcal < 500)
      return setMsg({ ok: false, text: "Completa los objetivos (mínimo 500 kcal)." });

    setSaving(true);
    try {
      const sb = createClient();
      const { data } = await sb.auth.getUser();
      if (!data.user) throw new Error("sin sesión");
      await saveProfile(
        sb,
        data.user.id,
        {
          display_name: f.name.trim() || null,
          sex: f.sex || null,
          birth_date: f.birth || null,
          height_cm: f.height ? h : null,
          weight_kg: f.weight ? w : null,
          activity: f.activity || null,
          goal: f.goal || null,
        },
        { kcal: Math.round(g.kcal), protein_g: Math.round(g.protein_g), carbs_g: Math.round(g.carbs_g), fat_g: Math.round(g.fat_g) },
      );
      setMsg({ ok: true, text: "Guardado ✓" });
    } catch {
      setMsg({ ok: false, text: "No se pudo guardar. Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando perfil" />;

  return (
    <form onSubmit={onSubmit}>
      <Section title="Tus datos">
        <Field label="Nombre">
          <input className={inputCls} value={f.name} onChange={set("name")} autoComplete="given-name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sexo">
            <select className={inputCls} value={f.sex} onChange={set("sex")}>
              <option value="">—</option>
              <option value="male">Hombre</option>
              <option value="female">Mujer</option>
            </select>
          </Field>
          <Field label="Nacimiento">
            <input type="date" className={inputCls} value={f.birth} onChange={set("birth")} max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Altura (cm)">
            <input className={inputCls} inputMode="decimal" value={f.height} onChange={set("height")} />
          </Field>
          <Field label="Peso (kg)">
            <input className={inputCls} inputMode="decimal" value={f.weight} onChange={set("weight")} />
          </Field>
        </div>
        <Field label="Actividad">
          <select className={inputCls} value={f.activity} onChange={set("activity")}>
            <option value="">—</option>
            {Object.entries(ACTIVITY).map(([k, v]) => (
              <option key={k} value={k}>{v.label} · {v.hint}</option>
            ))}
          </select>
        </Field>
        <Field label="Objetivo">
          <select className={inputCls} value={f.goal} onChange={set("goal")}>
            <option value="">—</option>
            {Object.entries(GOAL).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Gasto calórico estimado">
        <div className="rounded-3xl bg-card p-5">
          {estimate ? (
            <>
              <p className="text-3xl font-bold">{estimate.tdee} <span className="text-base font-medium text-subtle">kcal/día</span></p>
              <p className="mt-1 text-sm text-subtle">Mantenimiento a los {estimate.age} años (Mifflin-St Jeor).</p>
              <Button type="button" variant="secondary" className="mt-4" disabled={!f.goal} onClick={applySuggestion}>
                {f.goal ? "Aplicar sugerencia a mis objetivos" : "Elige un objetivo para sugerir macros"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-subtle">Completa sexo, nacimiento, altura, peso y actividad para calcularlo.</p>
          )}
        </div>
      </Section>

      <Section title="Objetivos diarios">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calorías (kcal)">
            <input className={inputCls} inputMode="numeric" value={f.kcal} onChange={set("kcal")} />
          </Field>
          <Field label="Proteína (g)">
            <input className={inputCls} inputMode="numeric" value={f.protein} onChange={set("protein")} />
          </Field>
          <Field label="Hidratos (g)">
            <input className={inputCls} inputMode="numeric" value={f.carbs} onChange={set("carbs")} />
          </Field>
          <Field label="Grasa (g)">
            <input className={inputCls} inputMode="numeric" value={f.fat} onChange={set("fat")} />
          </Field>
        </div>
        {macroKcal !== null && (
          <p className="text-sm text-subtle">Tus macros suman {macroKcal} kcal.</p>
        )}
      </Section>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
          {msg.text}
        </p>
      )}
      <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
    </form>
  );
}
