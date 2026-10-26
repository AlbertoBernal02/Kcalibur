// Service worker de Kcalibur.
// - Páginas: red primero; si falla, la última copia guardada (o una pantalla "sin conexión").
// - /_next/static e iconos: caché primero (los ficheros llevan hash en el nombre: son inmutables).
// - Todo lo demás (API propia, Supabase, Open Food Facts) NO se intercepta: los datos
//   offline los gestiona la app con su propia caché y cola de sincronización.
const VERSION = "v2";
const PAGES = `kcalibur-pages-${VERSION}`;
const ASSETS = `kcalibur-assets-${VERSION}`;

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sin conexión · Kcalibur</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;font-family:system-ui,sans-serif;background:#0c1210;color:#eaf1ec}a{display:inline-block;margin-top:8px;padding:14px 28px;border-radius:16px;background:#22c55e;color:#04130a;font-weight:600;text-decoration:none}p{color:#93a39a;max-width:320px}</style>
</head><body><h1>Sin conexión</h1><p>Esta pantalla aún no está guardada en el dispositivo. Vuelve a intentarlo cuando tengas internet.</p><a href="/">Ir al diario</a></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borra cachés de versiones anteriores.
      for (const key of await caches.keys()) {
        if (key.startsWith("kcalibur-") && key !== PAGES && key !== ASSETS) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req, url));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

// Clave de caché de una página: solo la ruta (sin query), una copia por pantalla.
const pageKey = (url) => new Request(url.origin + url.pathname);

async function networkFirstPage(req, url) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    // No se guardan redirecciones (p. ej. al login) ni errores.
    if (res.ok && !res.redirected && res.type === "basic") cache.put(pageKey(url), res.clone());
    return res;
  } catch {
    // Una pantalla no guardada muestra el aviso "sin conexión" (servir otra pantalla en esta URL la rompería).
    return (
      (await cache.match(pageKey(url))) ||
      new Response(OFFLINE_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })
    );
  }
}

// La app pide guardar de antemano las pantallas principales y sus ficheros, para que
// funcionen sin conexión aunque no se hayan visitado todavía.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "precache") event.waitUntil(precache(event.data.urls));
});

async function precache(urls) {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  for (const path of urls) {
    try {
      const res = await fetch(path);
      if (!res.ok || res.redirected) continue; // sin sesión: redirige al login, no se guarda
      const html = await res.clone().text();
      await pages.put(pageKey(new URL(path, self.location.origin)), res);
      for (const asset of new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || [])) {
        if (await assets.match(asset)) continue;
        try {
          const r = await fetch(asset);
          if (r.ok) await assets.put(asset, r);
        } catch {
          // un fichero que falle no impide guardar el resto
        }
      }
    } catch {
      // sin red: se reintentará en el próximo arranque
    }
  }
}
