import { aiFetch } from "@/lib/ai/call";
import { ESTIMATE_PROMPT, parseEstimate } from "@/lib/ai/estimate";
import { getAiConfig } from "@/lib/ai/provider";
import { createRateLimiter } from "@/lib/ai/request";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_TEXT = 500;
const limiter = createRateLimiter(30, 60 * 60 * 1000); // 30 estimaciones por hora y usuario (mejor esfuerzo, ver request.ts)
const json = (body: unknown, status: number, headers?: HeadersInit) => Response.json(body, { status, headers });

// Mensaje para el usuario según el código HTTP del proveedor de IA (igual que en el chat).
function providerError(status: number): string {
  if (status === 401 || status === 403) return "La clave de la IA no es válida o no tiene permiso.";
  if (status === 429) return "Has llegado al límite gratuito de la IA (por minuto o por día). Espera un poco y vuelve a probar.";
  if (status === 400 || status === 404) return "La IA rechazó la petición o el modelo ya no está disponible (revisa la variable AI_MODEL).";
  return "El servicio de IA no responde ahora mismo.";
}

// Estima las kcal y macros de una comida de fuera descrita en texto. Responde {items, kcal_min, kcal_max} o {error}.
export async function POST(request: Request) {
  const cfg = getAiConfig(process.env);
  if (!cfg) return json({ error: "La IA no está activada en este servidor." }, 503);

  const sb = await createServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No has iniciado sesión." }, 401);

  const rate = limiter.check(auth.user.id);
  if (!rate.ok) return json({ error: "Has pedido muchas estimaciones seguidas. Espera un poco." }, 429, { "Retry-After": String(rate.retryAfterSec) });

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "Describe qué has comido." }, 400);
  if (text.length > MAX_TEXT) return json({ error: `Descripción demasiado larga (máximo ${MAX_TEXT} caracteres).` }, 400);

  let upstream: Response;
  try {
    upstream = await aiFetch(
      cfg,
      {
        messages: [
          { role: "system", content: ESTIMATE_PROMPT },
          { role: "user", content: `<comida>\n${text}\n</comida>` },
        ],
        max_tokens: 900,
        temperature: 0.2,
      },
      { signal: request.signal, timeoutMs: 45_000, log: console.warn },
    );
  } catch {
    return json({ error: "No se pudo conectar con el servicio de IA." }, 502);
  }
  if (!upstream.ok) return json({ error: providerError(upstream.status) }, upstream.status === 429 ? 429 : 502);

  const data = (await upstream.json().catch(() => null)) as { choices?: { message?: { content?: string | null } }[] } | null;
  // Por si el modelo emite <think>…</think> en la respuesta.
  const content = (data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const estimate = parseEstimate(content);
  if (!estimate) return json({ error: "La IA no devolvió una estimación válida. Inténtalo de nuevo." }, 502);
  return json(estimate, 200, { "Cache-Control": "no-store" });
}
