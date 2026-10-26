# App de macros (tipo MyFitnessPal) — Contexto del proyecto

## Objetivo
App personal para registrar comidas y calcular calorías y macros (proteína, hidratos, grasa), con escaneo de códigos de barras de productos envasados. Uso personal, no comercial.

Se usará como **PWA** (sin App Store) en:
- **iPhone 14 Pro Max** (Safari → Compartir → "Añadir a pantalla de inicio")
- **Tablet Android** Honor MagicPad 4 (Chrome)

## Stack decidido
- **Frontend:** JavaScript, desplegado en **Vercel** (plan Hobby, gratuito).
- **Base de datos / backend:** **Supabase** (PostgreSQL + API + auth).
- Tiene que ser una PWA instalable: `manifest.json`, service worker, iconos, modo standalone.
- HTTPS obligatorio (lo da Vercel): la cámara no funciona sin él.

## Fuentes de datos
1. **Open Food Facts** para productos envasados (gratis, sin clave).
   - Endpoint: `GET https://world.openfoodfacts.org/api/v2/product/{codigo}.json?fields=product_name,brands,nutriments,serving_size`
   - Campos útiles en `nutriments`: `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`.
   - Enviar un `User-Agent` propio identificando la app.
   - Los datos son colaborativos: pueden tener errores o faltar valores → el usuario debe poder editarlos.
2. **Tabla propia de alimentos genéricos** sin código de barras (pollo, arroz, patata, huevos…), con valores **crudo y cocinado** por separado. Se puede rellenar con datos de BEDCA o USDA FoodData Central.

## Escáner de códigos de barras (importante)
- **Safari en iOS no soporta `BarcodeDetector`**, así que el escáner debe basarse en una librería JS (ZXing / `@zxing/browser` o `html5-qrcode`) para que funcione en iPhone.
- En Android/Chrome se puede usar `BarcodeDetector` nativo si está disponible, con la librería como respaldo.
- Usar la cámara trasera.
- Alternativa siempre disponible: introducir el código a mano.

## Modelo de datos (orientativo)
- `foods`: nombre, marca, código de barras, kcal/proteína/hidratos/grasa por 100 g, origen (`off` | `custom`).
- `diary_entries`: fecha, comida (desayuno / almuerzo / cena / snack), `food_id`, gramos.
- `goals`: objetivos diarios de kcal y macros.

Cálculo: `macro = valor_por_100g × gramos / 100`.

## Funcionalidades clave
- Cachear en la BD cada producto escaneado (más rápido, menos llamadas a OFF).
- Editar datos de alimentos.
- Comidas guardadas (combinaciones habituales que se añaden de un toque).
- Resumen diario mostrando lo que **falta** para el objetivo, no solo lo consumido.

## Orden de desarrollo
1. Proyecto base + Supabase + despliegue en Vercel.
2. CRUD de alimentos + diario + resumen diario (sin escáner).
3. Integración con Open Food Facts introduciendo el código a mano.
4. Escáner con cámara (compatible con iPhone).
5. PWA: manifest + service worker, probar instalación en iPhone y Android.

## Preferencias del desarrollador
- Responder en español.
- Código completo cuando se pida, explicando qué cambia y por qué.
- No inventar rutas, métodos ni variables; respetar la estructura existente salvo que se pida cambiarla.
- Funciones pequeñas y comentadas.
