"use client";

import { Plus, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, foodLabel, listFoods, normalize, setFavorite, type Category, type Food } from "@/lib/data/foods";
import { createClient } from "@/lib/supabase/client";
import { OffSearch } from "@/components/off-search";
import { SearchBox } from "@/components/search-box";
import { inputBase } from "@/components/ui";

type Tab = "all" | "fav" | "recent" | "mine";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "fav", label: "Favoritos" },
  { id: "recent", label: "Recientes" },
  { id: "mine", label: "Míos" },
];

const EMPTY_TEXT: Record<Tab, string> = {
  all: "No hay alimentos que coincidan.",
  fav: "Aún no tienes favoritos. Toca la estrella de un alimento.",
  recent: "Los alimentos que añadas al diario aparecerán aquí.",
  mine: "Todavía no has creado alimentos propios.",
};

// Listado de alimentos con búsqueda, pestañas, filtro por categoría y favoritos.
export function FoodList() {
  const router = useRouter();
  const [foods, setFoods] = useState<Food[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(false); // true = el texto viene de un código escaneado
  const [tab, setTab] = useState<Tab>("all");
  const [cat, setCat] = useState<Category | "">("");

  useEffect(() => {
    listFoods(createClient())
      .then((r) => {
        setFoods(r.foods);
        setFavs(r.favorites);
        setLastUsed(r.lastUsed);
      })
      .catch(() => setError("No se pudieron cargar los alimentos."))
      .finally(() => setLoading(false));
  }, []);

  // Filtra por pestaña, categoría y texto; "recientes" se ordena por último uso.
  const visible = useMemo(() => {
    const nq = normalize(q.trim());
    let list = foods.filter(
      (f) =>
        (!cat || f.category === cat) &&
        (!nq || normalize(`${foodLabel(f)} ${f.brand ?? ""} ${f.barcode ?? ""}`).includes(nq)) &&
        (tab === "all" ||
          (tab === "fav" && favs.has(f.id)) ||
          (tab === "recent" && lastUsed.has(f.id)) ||
          (tab === "mine" && f.user_id !== null)),
    );
    if (tab === "recent") list = [...list].sort((a, b) => lastUsed.get(b.id)!.localeCompare(lastUsed.get(a.id)!));
    return list;
  }, [foods, favs, lastUsed, q, tab, cat]);

  // Actualiza la UI al instante y revierte si falla el guardado.
  async function toggleFav(id: string) {
    const on = !favs.has(id);
    const apply = (value: boolean) =>
      setFavs((prev) => {
        const next = new Set(prev);
        if (value) next.add(id);
        else next.delete(id);
        return next;
      });
    apply(on);
    try {
      const sb = createClient();
      const { data } = await sb.auth.getUser();
      await setFavorite(sb, data.user!.id, id, on);
    } catch {
      apply(!on);
      setError("No se pudo actualizar el favorito.");
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex gap-2">
          <SearchBox
            value={q}
            height="h-12"
            onChange={(v) => {
              setAuto(false);
              setQ(v);
            }}
            onScan={(code) => {
              setAuto(true);
              setQ(code);
            }}
          />
          <select
            aria-label="Categoría"
            value={cat}
            onChange={(e) => setCat(e.target.value as Category | "")}
            className={`${inputBase} h-12 w-36 shrink-0 px-3 text-sm`}
          >
            <option value="">Categoría</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex rounded-2xl bg-muted p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-subtle"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Cargando alimentos">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-center text-subtle">{EMPTY_TEXT[tab]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((f) => (
            <li key={f.id} className="flex items-center rounded-2xl bg-card">
              <Link href={`/alimentos/${f.id}`} className="min-w-0 flex-1 px-4 py-3">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{foodLabel(f)}</span>
                  {f.user_id && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      {f.source === "off" ? "OFF" : "Propio"}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-subtle">
                  {f.brand ? `${f.brand} · ` : ""}
                  {Math.round(f.kcal_100g)} kcal · P {f.protein_100g} · H {f.carbs_100g} · G {f.fat_100g}
                  <span className="opacity-70"> /100 g</span>
                </p>
              </Link>
              <button
                onClick={() => toggleFav(f.id)}
                aria-label={favs.has(f.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
                aria-pressed={favs.has(f.id)}
                className="flex h-14 w-14 shrink-0 items-center justify-center"
              >
                <Star size={22} className={favs.has(f.id) ? "fill-carbs text-carbs" : "text-subtle"} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && (
        <div className="pb-20">
          <OffSearch key={q.trim()} query={q} autoRun={auto} onFood={(f) => router.push(`/alimentos/${f.id}`)} />
        </div>
      )}

      <Link
        href="/alimentos/nuevo"
        aria-label="Crear alimento"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition active:scale-95"
      >
        <Plus size={28} />
      </Link>
    </>
  );
}
