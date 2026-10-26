import Anthropic from "@anthropic-ai/sdk";
import { buildContext } from "@/lib/ai/context";
import { loadAiData } from "@/lib/ai/load-context";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { createRateLimiter, parseChatRequest } from "@/lib/ai/request";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

// Modelo configurable; por defecto el recomendado actual. Esfuerzo bajo: respuestas ágiles y baratas para un chat.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const limiter = createRateLimiter(40, 60 * 60 * 1000); // 40 preguntas por hora y usuario (mejor esfuerzo, ver request.ts)

const json = (body: unknown, status: number, headers?: HeadersInit) => Response.json(body, { status, headers });

// Traduce los errores del SDK a un mensaje que pueda leer el usuario.
function userMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "La clave de la IA no es válida o no tiene permiso.";
  if (e instanceof Anthropic.RateLimitError) return "El asistente está muy ocupado ahora mismo. Prueba de nuevo en un minuto.";
  if (e instanceof Anthropic.APIConnectionError) return "No se pudo conectar con el asistente. Comprueba la conexión.";
  return "No se pudo obtener respuesta del asistente.";
}

// Chat con el asistente. Responde en NDJSON: {"t":"delta","text":…} … y al final {"t":"done"} o {"t":"error","message":…}.
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  const sb = await createServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No has iniciado sesión." }, 401);

  const rate = limiter.check(auth.user.id);
  if (!rate.ok) return json({ error: "Has hecho muchas preguntas seguidas. Espera un poco." }, 429, { "Retry-After": String(rate.retryAfterSec) });

  const parsed = parseChatRequest(await request.json().catch(() => null));
  if (typeof parsed === "string") return json({ error: parsed }, 400);

  const context = buildContext(await loadAiData(sb, parsed.date));
  const client = new Anthropic(); // lee ANTHROPIC_API_KEY (y ANTHROPIC_BASE_URL si se define)
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let sent = false;
      try {
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 1500,
          system: [
            { type: "text", text: SYSTEM_PROMPT },
            { type: "text", text: `<datos_usuario>\n${context}\n</datos_usuario>` },
          ],
          messages: parsed.messages,
          output_config: { effort: "low" },
          // Si un clasificador de seguridad rechaza la petición, la API la reintenta en otro modelo (sin mantener listas).
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        request.signal.addEventListener("abort", () => stream.abort());
        stream.on("text", (delta) => {
          sent = true;
          send({ t: "delta", text: delta });
        });
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !sent) send({ t: "error", message: "No puedo ayudarte con esa petición." });
        else send({ t: "done", truncated: final.stop_reason === "max_tokens" });
      } catch (e) {
        if (!request.signal.aborted) send({ t: "error", message: userMessage(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
