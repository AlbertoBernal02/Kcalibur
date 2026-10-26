"use client";

import { useEffect, useMemo, useState } from "react";
import { foodLabel, listFoods, normalize, type Food } from "@/lib/data/foods";
import { createClient } from "@/lib/supabase/client";
import { OffSearch } from "@/components/off-search";
import { SearchBox } from "@/components/search-box";

type Tab = "recent" | "fav" | "all";
const TABS: { id: Tab; label: string }[] = [
  { id: "recent", label: "Recientes" },
  { id: "fav", label: "Favoritos" },
  { id: "all", label: "Todos" },
];

// Selector de alimento para el diario: búsqueda + recientes / favoritos / todos.
export function FoodPicker({ onPick }: { onPick: (food: Food) => void }) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(false); // true = el texto viene de un código escaneado
  const [tab, setTab] = useState<Tab>("recent");

  useEffect(() => {
    listFoods(createClient())
      .then((r) => {
        setFoods(r.foods);
        setFavs(r.favorites);
        setLastUsed(r.lastUsed);
        // Sin recientes todavía: empezamos en "Todos".
        if (r.lastUsed.size === 0) setTab("all");
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const nq = normalize(q.trim());
    // Buscar ignora la pestaña: se busca en todo el catálogo.
    const list = foods.filter(
      (f) =>
        (nq ? normalize(`${foodLabel(f)} ${f.brand ?? ""} ${f.barcode ?? ""}`).includes(nq) : true) &&
        (nq || tab === "all" || (tab === "fav" ? favs.has(f.id) : lastUsed.has(f.id))),
    );
    return !nq && tab === "recent" ? list.sort((a, b) => lastUsed.get(b.id)!.localeCompare(lastUsed.get(a.id)!)) : list;
  }, [foods, favs, lastUsed, q, tab]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex">
        <SearchBox
          value={q}
          onChange={(v) => {
            setAuto(false);
            setQ(v);
          }}
          onScan={(code) => {
            setAuto(true);
            setQ(code);
          }}
        />
      </div>
      <div className="flex rounded-2xl bg-muted p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id && !q}
            onClick={() => {
              setTab(t.id);
              setQ("");
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${tab === t.id && !q ? "bg-card text-foreground shadow-sm" : "text-subtle"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">No se pudieron cargar los alimentos.</p>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-subtle">
          {q ? "Sin resultados." : tab === "fav" ? "Aún no tienes favoritos." : "Aquí aparecerán tus alimentos recientes."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((f) => (
            <li key={f.id}>
              <button onClick={() => onPick(f)} className="w-full rounded-2xl bg-card px-4 py-3 text-left transition active:scale-[0.99]">
                <p className="truncate font-medium">{foodLabel(f)}</p>
                <p className="truncate text-sm text-subtle">
                  {f.brand ? `${f.brand} · ` : ""}
                  {Math.round(f.kcal_100g)} kcal /100 g
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && <OffSearch key={q.trim()} query={q} autoRun={auto} onFood={onPick} />}
    </div>
  );
}
