"use client";

import { ChevronLeft, ScanBarcode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORIES, deleteFood, findByBarcode, getFood, saveFood, STATE_LABEL,
  type Category, type Food, type FoodInput, type FoodState,
} from "@/lib/data/foods";
import { lookupOffProduct } from "@/lib/data/off-foods";
import { isComplete, offPrefill } from "@/lib/off";
import { createClient } from "@/lib/supabase/client";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Button, Field, inputCls } from "@/components/ui";

type Form = {
  name: string; brand: string; barcode: string; category: Category; state: FoodState | "";
  kcal: string; protein: string; carbs: string; fat: string; serving: string;
};

const EMPTY: Form = {
  name: "", brand: "", barcode: "", category: "otros", state: "",
  kcal: "", protein: "", carbs: "", fat: "", serving: "",
};

// Estado de la búsqueda por código de barras del formulario de alimento nuevo.
type Lookup =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found" | "incomplete" | "notfound" | "error" }
  | { kind: "exists"; food: Food };

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

const toForm = (f: Food): Form => ({
  name: f.name, brand: f.brand ?? "", barcode: f.barcode ?? "", category: f.category, state: f.state ?? "",
  kcal: String(f.kcal_100g), protein: String(f.protein_100g), carbs: String(f.carbs_100g), fat: String(f.fat_100g),
  serving: f.serving_g?.toString() ?? "",
});

// Crear / ver / editar un alimento. Los genéricos son de solo lectura (se pueden duplicar).
export type Prefill = Partial<Pick<Form, "name" | "brand" | "barcode" | "kcal" | "protein" | "carbs" | "fat" | "serving">>;

// `prefill` rellena un alimento nuevo (p. ej. un producto de Open Food Facts con datos incompletos).
export function FoodEditor({ id, prefill }: { id?: string; prefill?: Prefill }) {
  const router = useRouter();
  const [f, setF] = useState<Form>({ ...EMPTY, ...prefill });
  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [scanning, setScanning] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!id) return;
    getFood(createClient(), id)
      .then((r) => {
        if (!r) return setError("Alimento no encontrado.");
        setFood(r);
        setF(toForm(r));
      })
      .catch(() => setError("No se pudo cargar el alimento."))
      .finally(() => setLoading(false));
  }, [id]);

  const readOnly = !!food && food.user_id === null;

  // Con el código (escaneado o escrito): si ya lo tienes lo dice; si no, rellena el resto desde Open Food Facts.
  async function fetchByCode(raw: string) {
    const code = raw.trim();
    setF((p) => ({ ...p, barcode: code }));
    if (!/^\d{6,14}$/.test(code)) return setLookup({ kind: "error" });
    setLookup({ kind: "loading" });
    try {
      const own = await findByBarcode(createClient(), code);
      if (own) return setLookup({ kind: "exists", food: own });
      const product = await lookupOffProduct(code);
      if (!product) return setLookup({ kind: "notfound" });
      setF((p) => ({ ...p, ...offPrefill(product) }));
      setLookup({ kind: isComplete(product) ? "found" : "incomplete" });
    } catch {
      setLookup({ kind: "error" });
    }
  }

  // Valida el formulario y lo convierte al formato de la BD (o devuelve el error).
  function parse(): FoodInput | string {
    const [kcal, protein, carbs, fat] = [num(f.kcal), num(f.protein), num(f.carbs), num(f.fat)];
    if (!f.name.trim()) return "Ponle un nombre al alimento.";
    if (![kcal, protein, carbs, fat].every((n) => Number.isFinite(n) && n >= 0)) return "Rellena kcal y macros por 100 g (0 o más).";
    if (kcal > 950 || [protein, carbs, fat].some((n) => n > 100)) return "Los valores son por 100 g: kcal ≤ 950 y macros ≤ 100.";
    const serving = f.serving.trim() === "" ? null : num(f.serving);
    if (serving !== null && !(serving > 0)) return "La ración debe ser mayor que 0.";
    return {
      name: f.name.trim(), brand: f.brand.trim() || null, barcode: f.barcode.trim() || null,
      category: f.category, state: f.state || null,
      kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat, serving_g: serving,
    };
  }

  // Ejecuta una acción con control de estado y mensaje de error uniforme.
  async function run(action: () => Promise<void>, failText: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const dup = typeof e === "object" && e && "code" in e && e.code === "23505";
      setError(dup ? "Ya tienes un alimento con ese código de barras." : failText);
      setBusy(false);
    }
  }

  async function userId() {
    const { data } = await createClient().auth.getUser();
    if (!data.user) throw new Error("sin sesión");
    return data.user.id;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = parse();
    if (typeof input === "string") return setError(input);
    run(async () => {
      await saveFood(createClient(), await userId(), input, food?.id);
      router.replace("/alimentos");
    }, "No se pudo guardar el alimento.");
  }

  // Copia un genérico como alimento propio y abre su edición.
  function duplicate() {
    const input = parse();
    if (typeof input === "string") return setError(input);
    run(async () => {
      const newId = await saveFood(createClient(), await userId(), input);
      router.replace(`/alimentos/${newId}`);
    }, "No se pudo duplicar el alimento.");
  }

  function remove() {
    if (!food || !confirm(`¿Borrar "${food.name}"? Esta acción no se puede deshacer.`)) return;
    run(async () => {
      await deleteFood(createClient(), food.id);
      router.replace("/alimentos");
    }, "No se pudo borrar el alimento.");
  }

  const kcalFromMacros = Math.round(num(f.protein) * 4 + num(f.carbs) * 4 + num(f.fat) * 9);
  const dis = readOnly || busy;

  return (
    <>
      <Link href="/alimentos" className="mb-4 -ml-2 inline-flex h-12 items-center gap-1 px-2 text-primary">
        <ChevronLeft size={22} /> Alimentos
      </Link>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        {!id ? "Nuevo alimento" : readOnly ? "Alimento" : "Editar alimento"}
      </h1>

      {loading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando alimento" />
      ) : id && !food ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-danger">{error}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {readOnly && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-subtle">
              Es un alimento genérico y no se puede editar. Puedes duplicarlo para crear tu propia versión.
            </p>
          )}
          {food?.source === "off" && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-subtle">
              Importado de Open Food Facts (datos colaborativos, ODbL). Si algo no cuadra con la etiqueta, corrígelo aquí.
            </p>
          )}
          {!id && prefill?.barcode && (
            <p className="rounded-xl bg-carbs/10 px-4 py-3 text-sm text-carbs">
              Open Food Facts no tiene todos los datos de este producto. Completa los valores que faltan (mira la etiqueta).
            </p>
          )}
          {!id && (
            <section aria-label="Buscar por código de barras" className="flex flex-col gap-3 rounded-3xl bg-card p-4">
              <div className="flex flex-col gap-1.5 text-sm font-medium">
                <label htmlFor="barcode-first">Código de barras</label>
                <div className="flex gap-2">
                  <input
                    id="barcode-first"
                    className={inputCls}
                    inputMode="numeric"
                    value={f.barcode}
                    onChange={(e) => {
                      set("barcode")(e);
                      setLookup({ kind: "idle" });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void fetchByCode(f.barcode);
                      }
                    }}
                    placeholder="Escanea o escribe el código"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setScanning(true)}
                    aria-label="Escanear código de barras"
                    disabled={busy}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-fg active:scale-95"
                  >
                    <ScanBarcode size={26} />
                  </button>
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => fetchByCode(f.barcode)} disabled={busy || lookup.kind === "loading" || !f.barcode.trim()}>
                {lookup.kind === "loading" ? "Buscando…" : "Buscar datos del producto"}
              </Button>
              <LookupMessage lookup={lookup} />
            </section>
          )}
          {scanning &&
            // Portal a <body>: un ancestro con backdrop-filter rompería el position:fixed del escáner.
            createPortal(
              <BarcodeScanner
                onClose={() => setScanning(false)}
                onCode={(code) => {
                  setScanning(false);
                  void fetchByCode(code);
                }}
              />,
              document.body,
            )}
          <Field label="Nombre">
            <input className={inputCls} value={f.name} onChange={set("name")} disabled={dis} maxLength={120} />
          </Field>
          <Field label="Marca (opcional)">
            <input className={inputCls} value={f.brand} onChange={set("brand")} disabled={dis} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <select className={inputCls} value={f.category} onChange={set("category")} disabled={dis}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select className={inputCls} value={f.state} onChange={set("state")} disabled={dis}>
                <option value="">No aplica</option>
                {Object.entries(STATE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v[0].toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </Field>
          </div>

          <h2 className="mt-2 text-sm font-semibold text-subtle">Valores por 100 g</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorías (kcal)">
              <input className={inputCls} inputMode="decimal" value={f.kcal} onChange={set("kcal")} disabled={dis} />
            </Field>
            <Field label="Proteína (g)">
              <input className={inputCls} inputMode="decimal" value={f.protein} onChange={set("protein")} disabled={dis} />
            </Field>
            <Field label="Hidratos (g)">
              <input className={inputCls} inputMode="decimal" value={f.carbs} onChange={set("carbs")} disabled={dis} />
            </Field>
            <Field label="Grasa (g)">
              <input className={inputCls} inputMode="decimal" value={f.fat} onChange={set("fat")} disabled={dis} />
            </Field>
          </div>
          {Number.isFinite(kcalFromMacros) && Number.isFinite(num(f.kcal)) && Math.abs(kcalFromMacros - num(f.kcal)) > 0.15 * num(f.kcal) + 10 && (
            <p className="text-sm text-carbs">Ojo: los macros suman {kcalFromMacros} kcal, bastante distinto de las kcal indicadas.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ración (g, opcional)">
              <input className={inputCls} inputMode="decimal" value={f.serving} onChange={set("serving")} disabled={dis} />
            </Field>
            {id && (
              <Field label="Código de barras">
                <input className={inputCls} inputMode="numeric" value={f.barcode} onChange={set("barcode")} disabled={dis} />
              </Field>
            )}
          </div>

          {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

          {readOnly ? (
            <Button type="button" onClick={duplicate} disabled={busy}>Duplicar como mío</Button>
          ) : (
            <>
              <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
              {food && (
                <Button type="button" variant="secondary" className="text-danger" onClick={remove} disabled={busy}>
                  Borrar alimento
                </Button>
              )}
            </>
          )}
        </form>
      )}
    </>
  );
}

// Resultado de la búsqueda por código bajo el campo.
function LookupMessage({ lookup }: { lookup: Lookup }) {
  if (lookup.kind === "idle" || lookup.kind === "loading") return null;
  if (lookup.kind === "exists")
    return (
      <p role="status" className="rounded-xl bg-carbs/10 px-4 py-3 text-sm text-carbs">
        Ya tienes este producto: <strong>{lookup.food.name}</strong>.{" "}
        <Link href={lookup.food.user_id ? `/alimentos/${lookup.food.id}` : "/alimentos"} className="font-semibold underline">Abrirlo</Link>
      </p>
    );
  const text = {
    found: "✓ Producto encontrado: se han rellenado los datos. Revísalos con la etiqueta y guarda.",
    incomplete: "Producto encontrado, pero faltan algunos valores: complétalos con la etiqueta.",
    notfound: "No está en Open Food Facts. Rellena los datos a mano (el código se guardará con el alimento).",
    error: "No se pudo buscar (comprueba que el código tenga entre 6 y 14 dígitos y que haya conexión).",
  }[lookup.kind];
  const ok = lookup.kind === "found";
  return (
    <p role={ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${ok ? "bg-primary/10 text-primary" : "bg-muted text-subtle"}`}>
      {text}
    </p>
  );
}
