# Kcalibur

PWA personal para registrar comidas y calcular **calorías y macros**, pensada para el iPhone (Safari → «Añadir a pantalla de inicio») y tablets Android.

- **Diario** por días con 5 comidas, gramos o raciones, copiar comidas/día, resumen con lo que **falta** para el objetivo.
- **Alimentos**: ~130 genéricos (crudo/cocinado), propios, favoritos y recientes; **Open Food Facts** por nombre o código; **escáner de códigos de barras**.
- **Comidas guardadas, recetas y dietas** con varias opciones por comida y cálculo automático del día tipo.
- **Seguimiento**: peso, agua, medias y adherencia, **fotos de progreso** quincenales con comparador.
- **Asistente de IA** que conoce tus objetivos, tu diario y tus dietas (opcional).
- **Offline**: el diario funciona sin conexión y se sincroniza al volver. Exportación a CSV.

## Stack

Next.js 16 (App Router) · TypeScript estricto · Tailwind 4 · Supabase (Postgres + Auth + Storage, con RLS en todas las tablas) · `@zxing/browser` · `@anthropic-ai/sdk`.

## Puesta en marcha (local)

```bash
npm install
cp .env.example .env.local     # y rellena los valores (ver el propio archivo)
npm run migrate                # aplica supabase/migrations a tu proyecto (usa SUPABASE_DB_URL)
npm run dev                    # http://localhost:3000
```

Otros comandos: `npm test` (lógica pura), `npm run lint`, `npm run build`.

> La cámara solo funciona con **HTTPS** (o `localhost`). El service worker solo se registra en producción (`npm run build && npm start`).

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | Clave publicable (la seguridad la da RLS) |
| `SUPABASE_DB_URL` | solo local | Cadena Postgres para `npm run migrate`. **No** subir a Vercel |
| `ANTHROPIC_API_KEY` | local + Vercel (opcional) | Activa el asistente de IA. Solo servidor |
| `ANTHROPIC_MODEL` | opcional | Modelo del asistente (por defecto `claude-opus-5-5`) |

## Despliegue en Vercel

1. Sube el repositorio a GitHub y, en Vercel, **Add New → Project** e importa el repo (Next.js se detecta solo).
2. En **Environment Variables** añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (y `ANTHROPIC_API_KEY` si quieres el asistente). **Deploy**.
3. En Supabase → **Authentication → URL Configuration**: pon como *Site URL* tu dominio de Vercel y añade `https://TU-DOMINIO/restablecer` a *Redirect URLs* (necesario para recuperar la contraseña).
4. Abre la URL en el iPhone con **Safari** → Compartir → **Añadir a pantalla de inicio**. Ábrela una vez con conexión para que se guarde para uso offline.

## Estructura

```
src/app/            rutas: (auth) login/registro/recuperar, (app) diario, alimentos, comidas, dietas, progreso, perfil, asistente, api/
src/components/     UI (cliente) por pantalla
src/lib/            lógica pura con tests (*.test.ts), capa de datos (data/), offline (offline/), IA (ai/)
src/proxy.ts        sesión de Supabase y redirecciones
public/sw.js        service worker
supabase/migrations esquema versionado (RLS en todas las tablas; bucket privado de fotos)
```

## Notas

- Los valores nutricionales de los alimentos genéricos son aproximados (USDA/BEDCA): revísalos si algo no cuadra con tu etiqueta.
- Las respuestas del asistente son orientativas y no sustituyen a un profesional.
