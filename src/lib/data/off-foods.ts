import type { SupabaseClient } from "@supabase/supabase-js";
import { isComplete, offPrefill, type OffProduct } from "@/lib/off";
import { findByBarcode, insertOffFood, type Food } from "@/lib/data/foods";

// Resultado de resolver un código de barras.
export type BarcodeResult =
  | { kind: "food"; food: Food } // ya estaba en caché o se acaba de importar
  | { kind: "incomplete"; product: OffProduct } // existe en OFF pero faltan kcal/macros
  | { kind: "notfound" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function searchOff(query: string): Promise<OffProduct[]> {
  const data = await getJson<{ products: OffProduct[] }>(`/api/off/search?q=${encodeURIComponent(query)}`);
  // Los completos primero (el sort es estable: se conserva la relevancia dentro de cada grupo).
  return [...data.products].sort((a, b) => Number(isComplete(b)) - Number(isComplete(a)));
}

// Importa un producto completo a la caché (si ya existe ese código, devuelve el existente).
export async function importOffProduct(sb: SupabaseClient, userId: string, p: OffProduct): Promise<Food> {
  const cached = await findByBarcode(sb, p.code);
  if (cached) return cached;
  return insertOffFood(sb, userId, {
    name: p.name,
    brand: p.brand,
    barcode: p.code,
    category: "otros",
    state: null,
    kcal_100g: p.kcal!,
    protein_100g: p.protein!,
    carbs_100g: p.carbs!,
    fat_100g: p.fat!,
    serving_g: p.serving_g,
  });
}

// Busca un código: primero en la caché propia (rápido y sin red) y si no en Open Food Facts.
export async function resolveBarcode(sb: SupabaseClient, userId: string, code: string): Promise<BarcodeResult> {
  const cached = await findByBarcode(sb, code);
  if (cached) return { kind: "food", food: cached };

  const { product } = await getJson<{ product: OffProduct | null }>(`/api/off/product/${code}`);
  if (!product) return { kind: "notfound" };
  if (!isComplete(product)) return { kind: "incomplete", product };
  return { kind: "food", food: await importOffProduct(sb, userId, product) };
}

// Enlace al editor de alimento nuevo con los datos de OFF que sí existen (el usuario completa el resto).
export const prefillHref = (p: OffProduct): string => `/alimentos/nuevo?${new URLSearchParams(offPrefill(p))}`;

// Producto de OFF por código, sin guardarlo (para rellenar el formulario de alimento nuevo). null = no existe.
export async function lookupOffProduct(code: string): Promise<OffProduct | null> {
  return (await getJson<{ product: OffProduct | null }>(`/api/off/product/${code}`)).product;
}
