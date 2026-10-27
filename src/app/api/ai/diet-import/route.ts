import { aiFetch, shouldFallback } from "@/lib/ai/call";
import { DIET_IMPORT_PROMPT, looksDegenerate, parseDietImport } from "@/lib/ai/diet-import";
import { getAiConfig } from "@/lib/ai/provider";
import { createRateLimiter } from "@/lib/ai/request";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_TEXT = 8000;
const limiter = createRateLimiter(10, 60 * 60 * 1000); // 10 importaciones por hora y usuario (mejor esfuerzo, ver request.ts)
const json = (body: unknown, status: number, headers?: HeadersInit) => Response.json(body, { status, headers });

// Mensaje para el usuario según el código HTTP del proveedor de IA (igual que en el chat).
function providerError(status: number): string {
  if (status === 401 || status === 403) return "La clave de la IA no es válida o no tiene permiso.";
  if (status === 429) return "Has llegado al límite gratuito de la IA (por minuto o por día). Espera un poco y vuelve a probar.";
  if (status === 413) return "El texto es demasiado grande para el límite del plan gratuito. Pega solo la parte de las comidas.";
  if (status === 400 || status === 404) return "La IA rechazó la petición o el modelo ya no está disponible (revisa la variable AI_MODEL).";
  return "El servicio de IA no responde ahora mismo.";
}

// Convierte el texto de un plan nutricional en una dieta estructurada: {name, notes, options} o {error}.
export async function POST(request: Request) {
  const cfg = getAiConfig(process.env);
  if (!cfg) return json({ error: "La IA no está activada en este servidor." }, 503);

  const sb = await createServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No has iniciado sesión." }, 401);

  const rate = limiter.check(auth.user.id);
  if (!rate.ok) return json({ error: "Has hecho muchas importaciones seguidas. Espera un poco." }, 429, { "Retry-After": String(rate.retryAfterSec) });

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 20) return json({ error: "Pega el texto del plan (las comidas con sus cantidades)." }, 400);
  if (text.length > MAX_TEXT) return json({ error: `El texto es demasiado largo (máximo ${MAX_TEXT} caracteres).` }, 400);

  // Tarea pesada y con salida estructurada: ante un límite (429) no se usa el modelo de reserva (daría basura en vez del
  // aviso de esperar). Y como a veces el modelo devuelve una respuesta degradada (JSON roto o todo ceros), se reintenta una vez.
  const ask = () =>
    aiFetch(
      cfg,
      {
        messages: [
          { role: "system", content: DIET_IMPORT_PROMPT },
          { role: "user", content: `<plan>\n${text}\n</plan>` },
        ],
        max_tokens: 4500,
        temperature: 0.1,
        // Modo JSON del proveedor (verificado en Groq: 5/5 respuestas válidas frente a 3/5 sin él). Con otro proveedor no se envía.
        ...(cfg.baseUrl.includes("api.groq.com") ? { response_format: { type: "json_object" } } : {}),
      },
      { signal: request.signal, timeoutMs: 25_000, log: console.warn, fallbackWhen: (s) => s !== 429 && shouldFallback(s) },
    );

  for (let attempt = 0; attempt < 2; attempt++) {
    let upstream: Response;
    try {
      upstream = await ask();
    } catch {
      return json({ error: "No se pudo conectar con el servicio de IA." }, 502);
    }
    if (!upstream.ok) return json({ error: providerError(upstream.status) }, upstream.status === 429 ? 429 : 502);

    const data = (await upstream.json().catch(() => null)) as { choices?: { message?: { content?: string | null } }[] } | null;
    const content = (data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
    const diet = parseDietImport(content);
    if (diet && !looksDegenerate(diet)) return json(diet, 200, { "Cache-Control": "no-store" });
    console.warn(`IA: importación de dieta degradada (intento ${attempt + 1})`);
  }
  return json({ error: "La IA no devolvió un resultado válido. Inténtalo de nuevo en un momento." }, 502);
}
