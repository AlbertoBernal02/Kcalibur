// Llamada al proveedor de IA con modelo de reserva (sin dependencias de Next: se puede probar con un fetch falso).
import type { AiConfig } from "./provider.ts";

// ¿Merece la pena probar el modelo de reserva con este fallo? No con 401/403 (la clave es mala y fallaría igual).
export const shouldFallback = (status: number) => [400, 404, 429, 500, 502, 503, 504].includes(status);

type Opts = { signal?: AbortSignal; timeoutMs: number; fetchImpl?: typeof fetch; log?: (msg: string) => void };

// POST a /chat/completions con el modelo principal; si falla de forma recuperable (o no responde), repite con el de reserva.
// Devuelve la última respuesta (correcta o no) para que quien llama traduzca el error como siempre.
export async function aiFetch(cfg: AiConfig, body: Record<string, unknown>, opts: Opts): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch;
  const attempt = (model: string, extra: Record<string, unknown>) =>
    doFetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ ...body, model, ...extra }),
      signal: AbortSignal.any([...(opts.signal ? [opts.signal] : []), AbortSignal.timeout(opts.timeoutMs)]),
    });

  let first: Response | null = null;
  try {
    first = await attempt(cfg.model, cfg.extraBody);
  } catch (e) {
    // Si el usuario cancela o no hay reserva, el error sigue su camino.
    if (opts.signal?.aborted || !cfg.fallback) throw e;
  }
  if (first && (first.ok || !cfg.fallback || !shouldFallback(first.status))) return first;

  opts.log?.(`IA: el modelo ${cfg.model} falló (${first ? first.status : "sin respuesta"}); se prueba ${cfg.fallback!.model}`);
  return attempt(cfg.fallback!.model, cfg.fallback!.extraBody);
}
