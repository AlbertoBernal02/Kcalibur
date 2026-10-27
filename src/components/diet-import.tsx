"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestDietImport } from "@/lib/ai/diet-import-client";
import { createDiet, deleteDiet } from "@/lib/data/diets";
import { listFoods } from "@/lib/data/foods";
import { createSavedMeal } from "@/lib/data/saved-meals";
import { buildOptions, type BuiltOption } from "@/lib/diet-import";
import { MEALS } from "@/lib/meals";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

const nf = (n: number) => Math.round(n).toLocaleString("es-ES");
const kcalOf = (o: BuiltOption) => o.items.reduce((a, i) => a + i.kcal, 0);

type Preview = { name: string; notes: string; options: BuiltOption[] };

// Importar una dieta: se pega el texto del plan del nutricionista, la IA lo estructura y, tras revisarlo, se crea.
export function DietImportSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // Analiza el texto con la IA y asocia cada alimento con tu catálogo (valores reales) o con la estimación de la IA.
  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const parsed = await requestDietImport(text.trim());
      if (parsed.options.length === 0) throw new Error("No he encontrado comidas en ese texto. Pega la parte del plan con las comidas y sus cantidades.");
      const { foods } = await listFoods(createClient());
      setPreview({ name: parsed.name, notes: parsed.notes, options: buildOptions(parsed, foods) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar el plan.");
    } finally {
      setLoading(false);
    }
  }

  // Crea la dieta y sus opciones; si algo falla a medias se borra la dieta para no dejarla incompleta.
  async function create() {
    if (!preview || !preview.name.trim()) return setError("Ponle un nombre a la dieta.");
    setBusy(true);
    setError(null);
    const sb = createClient();
    let dietId: string | null = null;
    try {
      const userId = await currentUserId();
      dietId = await createDiet(sb, userId, preview.name.trim().slice(0, 80), preview.notes.trim() || null);
      for (const o of preview.options) {
        await createSavedMeal(sb, userId, {
          name: o.name, kind: "meal", servings: 1, dietId, dietMeal: o.meal,
          items: o.items.map((i) => ({ food_id: i.food_id, name: i.name, grams: i.grams, serving_g: null, kcal: i.kcal, protein_g: i.protein_g, carbs_g: i.carbs_g, fat_g: i.fat_g })),
        });
      }
      router.push(`/dietas/${dietId}`);
    } catch {
      if (dietId) await deleteDiet(sb, dietId).catch(() => undefined);
      setError("No se pudo crear la dieta. Comprueba la conexión e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  const estimated = preview?.options.reduce((a, o) => a + o.items.filter((i) => i.estimated).length, 0) ?? 0;
  // Día tipo = primera opción de cada comida (igual que el resumen de la lista de dietas).
  const dayKcal = preview ? MEALS.reduce((a, m) => a + (preview.options.find((o) => o.meal === m.id) ? kcalOf(preview.options.find((o) => o.meal === m.id)!) : 0), 0) : 0;

  return (
    <Sheet title="Importar dieta con IA" onClose={onClose} error={error}>
      {!preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-subtle">
            Copia el texto del plan de tu nutricionista (de Word, PDF o web) y pégalo aquí. La IA separa las comidas y opciones; podrás revisarlo antes de crear nada.
          </p>
          <Field label="Texto del plan">
            <textarea
              className="min-h-56 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary"
              value={text}
              maxLength={8000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pega aquí el plan nutricional…"
            />
          </Field>
          <Button onClick={analyze} disabled={loading || text.trim().length < 20} className="flex items-center justify-center gap-2">
            <Sparkles size={18} /> {loading ? "Analizando…" : "Analizar con IA"}
          </Button>
          <p className="text-xs text-subtle">El texto se envía al servicio de IA para analizarlo. No pegues datos que no quieras compartir.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Nombre de la dieta">
            <input className={inputCls} value={preview.name} maxLength={80} onChange={(e) => setPreview({ ...preview, name: e.target.value })} />
          </Field>
          <Field label="Notas (agua, suplementos…)">
            <textarea className={`${inputCls} h-28 py-3 text-sm`} value={preview.notes} maxLength={1000} onChange={(e) => setPreview({ ...preview, notes: e.target.value })} />
          </Field>

          <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
            {preview.options.length} opciones · día tipo ≈ <span className="font-semibold">{nf(dayKcal)} kcal</span> (primera opción de cada comida).
            {estimated > 0 && <span className="text-subtle"> {estimated} alimentos no están en tu catálogo y llevan valores estimados por la IA: revísalos.</span>}
          </p>

          {MEALS.map((m) => {
            const opts = preview.options.filter((o) => o.meal === m.id);
            if (opts.length === 0) return null;
            return (
              <section key={m.id} aria-label={m.label} className="flex flex-col gap-2">
                <h3 className="px-1 text-sm font-semibold text-subtle">{m.label}</h3>
                {opts.map((o, idx) => (
                  <div key={idx} className="rounded-2xl bg-card px-4 py-3">
                    <p className="flex items-baseline gap-2 font-medium">
                      <span className="min-w-0 flex-1 break-words">{o.name}</span>
                      <span className="shrink-0 text-sm font-semibold">{nf(kcalOf(o))} kcal</span>
                    </p>
                    <ul className="mt-1 text-sm text-subtle">
                      {o.items.map((i, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="min-w-0 flex-1 break-words">{i.name} · {i.grams} g</span>
                          {i.estimated && <span className="shrink-0 rounded-full bg-carbs/15 px-2 text-xs text-carbs">estimado</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}

          <Button onClick={create} disabled={busy}>{busy ? "Creando…" : "Crear dieta"}</Button>
          <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>Volver al texto</Button>
        </div>
      )}
    </Sheet>
  );
}
