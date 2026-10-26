import { clear, get, set } from "idb-keyval";

// Caché local en IndexedDB (clave-valor). Los fallos de almacenamiento nunca deben romper la app.
export const cacheGet = <T>(key: string): Promise<T | undefined> => get<T>(key).catch(() => undefined);
export const cacheSet = (key: string, value: unknown): Promise<void> => set(key, value).catch(() => undefined);

// ¿El error viene de no poder llegar al servidor? (supabase-js devuelve el fallo de fetch como
// error con mensaje "TypeError: Failed to fetch" y code ""; Safari dice "Load failed").
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const o = (typeof e === "object" && e ? e : {}) as { message?: unknown; code?: unknown };
  return o.code === "" || /failed to fetch|load failed|network ?error|network request failed|fetch failed/i.test(String(o.message ?? e));
}

// Lee de la red y guarda copia; sin conexión devuelve la última copia (si no hay, relanza el error).
export async function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const value = await fetcher();
    void cacheSet(key, value);
    return value;
  } catch (e) {
    if (isNetworkError(e)) {
      const hit = await cacheGet<T>(key);
      if (hit !== undefined) return hit;
    }
    throw e;
  }
}

// Al cerrar sesión: borra datos cacheados, cola y páginas guardadas (otra cuenta no debe verlos).
export async function clearOfflineData(): Promise<void> {
  await clear().catch(() => undefined);
  if (typeof caches !== "undefined") {
    for (const key of await caches.keys()) if (key.startsWith("kcalibur-")) await caches.delete(key);
  }
}
