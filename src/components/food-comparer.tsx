"use client";

import { ArrowLeftRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { foodLabel, listFoods, type Food } from "@/lib/data/foods";
import { METRICS, cookedPer100Raw, equivalentGrams, findCounterpart } from "@/lib/equivalences";
import { scaleMacros } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/client";
import { FoodSelect } from "@/components/food-select";
import { Field, inputCls } from "@/components/ui";

const nf = (n: number, d = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: d });
const per100 = (f: Food) => ({ kcal: f.kcal_100g, protein_g: f.protein_100g, carbs_g: f.carbs_100g, fat_g: f.fat_100g });

// Comparador: macros por 100 g de dos alimentos y cuánto de uno equivale a una cantidad del otro.
// Sirve también para crudo vs cocinado (arroz seco / cocido) y para sustituir un alimento por otro.
export function FoodComparer() {
  const [a, setA] = useState<Food | null>(null);
  const [b, setB] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [catalog, setCatalog] = useState<Food[]>([]);

  useEffect(() => {
    listFoods(createClient()).then((r) => setCatalog(r.foods)).catch(() => setCatalog([]));
  }, []);

  // Nombres elegidos (el texto de la pantalla usa estos nombres en vez de "A" y "B").
  const nameA = a ? foodLabel(a) : "";
  const nameB = b ? foodLabel(b) : "";

  const g = Number(grams.replace(",", "."));
  const valid = Number.isFinite(g) && g > 0;
  const counterpart = a ? findCounterpart(a, catalog) : null;
  const sameFamily = a && b && a.name === b.name && a.state && b.state && a.state !== b.state;
  const raw = sameFamily ? (a.state === "raw" ? a : b) : null;
  const cooked = sameFamily ? (a.state === "cooked" ? a : b) : null;
  const yieldG = raw && cooked ? cookedPer100Raw(raw, cooked) : null;

  return (
    <>
      <Link href="/alimentos" className="mb-2 -ml-2 inline-flex h-12 items-center gap-1 px-2 text-primary">
        <ChevronLeft size={22} /> Alimentos
      </Link>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Comparador</h1>
      <p className="mb-5 text-subtle">Crudo vs cocinado, o cuánto de un alimento equivale a otro.</p>

      <div className="flex flex-col gap-3">
        <FoodSelect label="Primer alimento" food={a} onChange={setA} />
        <Field label={a ? `Cantidad de ${nameA} (g)` : "Cantidad (g)"}>
          <input className={inputCls} inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </Field>

        {counterpart && (!b || b.id !== counterpart.id) && (
          <button onClick={() => setB(counterpart)} className="h-12 rounded-2xl bg-muted px-4 text-sm font-semibold text-primary">
            Comparar con su versión {counterpart.state === "raw" ? "cruda" : "cocinada"}
          </button>
        )}

        <FoodSelect label="Segundo alimento" food={b} onChange={setB} />
        {a && b && (
          <button
            onClick={() => {
              setA(b);
              setB(a);
            }}
            className="flex h-11 items-center justify-center gap-2 text-sm font-medium text-subtle"
          >
            <ArrowLeftRight size={16} /> Intercambiar los dos alimentos
          </button>
        )}
      </div>

      {a && b && valid && (
        <div className="mt-5 flex flex-col gap-4">
          {yieldG && (
            <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">
              <span className="font-semibold">Crudo ↔ cocinado:</span> 100 g crudos ≈ {nf(yieldG)} g cocinados (y 100 g cocinados ≈ {nf(10000 / yieldG)} g crudos), conservando las calorías.
            </p>
          )}

          <section aria-label="Por 100 g" className="rounded-3xl bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-subtle">Por 100 g</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-subtle">
                  <th className="py-1 font-medium" />
                  <th className="py-1 align-bottom font-medium">{nameA}</th>
                  <th className="py-1 align-bottom font-medium">{nameB}</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-1.5 capitalize text-subtle">{m.label}</td>
                    <td className="py-1.5 font-medium">{nf(per100(a)[m.id])} {m.unit}</td>
                    <td className="py-1.5 font-medium">{nf(per100(b)[m.id])} {m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-label="Equivalencias" className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-semibold text-subtle">
              Para igualar {nf(g, 0)} g de {nameA} ({nf(scaleMacros(per100(a), g).kcal, 0)} kcal)…
            </h2>
            {METRICS.map((m) => {
              const eq = equivalentGrams(a, g, b, m.id);
              const at = eq !== null ? scaleMacros(per100(b), eq) : null;
              return (
                <div key={m.id} className="rounded-2xl bg-card px-4 py-3">
                  <p className="text-sm text-subtle">En {m.label}</p>
                  {eq !== null && at ? (
                    <>
                      <p className="text-lg font-bold">{nf(eq)} g de {nameB}</p>
                      <p className="text-xs text-subtle">
                        Con esa cantidad: {nf(at.kcal, 0)} kcal · P {nf(at.protein_g)} · H {nf(at.carbs_g)} · G {nf(at.fat_g)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">{nameB} no aporta {m.label}: no hay equivalencia.</p>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}

      {(!a || !b) && <p className="mt-6 text-center text-sm text-subtle">Elige los dos alimentos para ver la comparación.</p>}
    </>
  );
}
