import { buildContext } from "@/lib/ai/context";
import { loadAiData } from "@/lib/ai/load-context";
import { getAiConfig } from "@/lib/ai/provider";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { createRateLimiter, parseChatRequest } from "@/lib/ai/request";
import { createSseParser, createThinkFilter } from "@/lib/ai/stream";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const limiter = createRateLimiter(40, 60 * 60 * 1000); // 40 preguntas por hora y usuario (mejor esfuerzo, ver request.ts)
const json = (body: unknown, status: number, headers?: HeadersInit) => Response.json(body, { status, headers });

// Mensaje para el usuario según el código HTTP que devuelve el proveedor de IA.
function providerError(status: number): string {
  if (status === 401 || status === 403) return "La clave de la IA no es válida o no tiene permiso.";
  if (status === 429) return "Has llegado al límite gratuito de la IA (por minuto o por día). Espera un poco y vuelve a probar.";
  if (status === 413) return "La pregunta es demasiado grande para el límite del plan gratuito. Pregunta algo más corto.";
  if (status === 400 || status === 404) return "La IA rechazó la petición o el modelo ya no está disponible (revisa la variable AI_MODEL).";
  return "El servicio de IA no responde ahora mismo.";
}

// Chat con el asistente. Responde en NDJSON: {"t":"delta","text":…} … y al final {"t":"done"} o {"t":"error","message":…}.
export async function POST(request: Request) {
  const cfg = getAiConfig(process.env);
  if (!cfg) return json({ error: "not_configured" }, 503);

  const sb = await createServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No has iniciado sesión." }, 401);

  const rate = limiter.check(auth.user.id);
  if (!rate.ok) return json({ error: "Has hecho muchas preguntas seguidas. Espera un poco." }, 429, { "Retry-After": String(rate.retryAfterSec) });

  const parsed = parseChatRequest(await request.json().catch(() => null));
  if (typeof parsed === "string") return json({ error: parsed }, 400);

  // Los valores de referencia se eligen con las dos últimas preguntas del usuario (cubre los seguimientos).
  const userTexts = parsed.messages.filter((m) => m.role === "user").slice(-2).map((m) => m.content);
  const context = buildContext(await loadAiData(sb, parsed.date, userTexts));

  // Petición a la API compatible con OpenAI (Groq por defecto). Se hace antes de abrir el stream para poder
  // devolver un error HTTP normal si el proveedor falla.
  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\n<datos_usuario>\n${context}\n</datos_usuario>` }, ...parsed.messages],
        stream: true,
        max_tokens: 800,
        temperature: 0.4,
        ...cfg.extraBody,
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]),
    });
  } catch {
    return json({ error: "No se pudo conectar con el servicio de IA." }, 502);
  }
  if (!upstream.ok || !upstream.body) return json({ error: providerError(upstream.status) }, upstream.status === 429 ? 429 : 502);

  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const events = createSseParser();
      const think = createThinkFilter(); // por si el modelo emite <think>…</think>
      let sent = false;
      let finish: string | null = null;
      const emit = (text: string) => {
        if (!text) return;
        sent = true;
        send({ t: "delta", text });
      };

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const data of events(decoder.decode(value, { stream: true }))) {
            if (data === "[DONE]") continue;
            let chunk: { choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[]; error?: { message?: string } };
            try {
              chunk = JSON.parse(data);
            } catch {
              continue; // línea que no es JSON (comentario/keep-alive)
            }
            if (chunk.error) throw new Error(chunk.error.message ?? "error del proveedor");
            const choice = chunk.choices?.[0];
            if (choice?.delta?.content) emit(think.push(choice.delta.content));
            if (choice?.finish_reason) finish = choice.finish_reason;
          }
        }
        emit(think.flush());
        if (!sent) send({ t: "error", message: finish === "content_filter" ? "No puedo ayudarte con esa petición." : "La IA no devolvió respuesta. Inténtalo de nuevo." });
        else send({ t: "done", truncated: finish === "length" });
      } catch {
        if (!request.signal.aborted) send({ t: "error", message: "Se interrumpió la respuesta de la IA." });
      } finally {
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
