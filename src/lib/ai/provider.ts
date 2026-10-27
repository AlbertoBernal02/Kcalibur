// Configuración del proveedor de IA (cualquier API compatible con OpenAI). Pura: recibe las variables de entorno.
// Por defecto: Groq con gpt-oss-120b, que tiene plan gratuito. Se cambia con variables de entorno, sin tocar código:
//   AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_FALLBACK_MODEL, AI_REASONING_EFFORT.

type ModelCfg = { model: string; extraBody: Record<string, unknown> };
// `fallback` = modelo de reserva que se prueba solo si el principal falla (modelo retirado, límite o caída).
export type AiConfig = { baseUrl: string; apiKey: string | null; fallback: ModelCfg | null } & ModelCfg;

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// gpt-oss-120b razona poco con esfuerzo "low" y termina siempre la respuesta. Qwen 3 en Groq gasta casi todos los tokens
// de salida razonando (respuestas cortadas o vacías) y además tiene un tope propio de 1.000 tokens de salida por minuto.
export const DEFAULT_MODEL = "openai/gpt-oss-120b";
// Reserva por defecto en Groq: más pequeño y menos preciso en las cuentas, pero responde y tiene su propio límite.
export const DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b";

// Parámetros de razonamiento de un modelo. Razonamiento "low" en Groq; con otro proveedor solo se envía si se pide
// expresamente (un parámetro desconocido podría rechazarse). `reasoning_format: "hidden"` solo lo usa Qwen (con "none"
// responde "pensando en voz alta"); gpt-oss ya devuelve el razonamiento aparte, fuera del texto de la respuesta.
function reasoningParams(model: string, env: Record<string, string | undefined>): Record<string, unknown> {
  const effort = env.AI_REASONING_EFFORT || (env.AI_BASE_URL ? undefined : "low");
  const hide = /qwen/i.test(model) && effort !== "none";
  return effort ? { reasoning_effort: effort, ...(hide ? { reasoning_format: "hidden" } : {}) } : {};
}

export function getAiConfig(env: Record<string, string | undefined>): AiConfig | null {
  const baseUrl = (env.AI_BASE_URL || GROQ_BASE_URL).replace(/\/+$/, "");
  const apiKey = env.AI_API_KEY || null;
  // Un servidor local (p. ej. Ollama) no necesita clave; cualquier otro, sí.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl);
  if (!apiKey && !local) return null;

  const model = env.AI_MODEL || DEFAULT_MODEL;
  // Reserva: la indicada en AI_FALLBACK_MODEL ("off" la desactiva) o, con la configuración por defecto de Groq, gpt-oss-20b.
  const requested = env.AI_FALLBACK_MODEL?.trim();
  const fbModel = requested === "off" ? null : requested || (!env.AI_BASE_URL && model === DEFAULT_MODEL ? DEFAULT_FALLBACK_MODEL : null);
  return {
    baseUrl,
    apiKey,
    model,
    extraBody: reasoningParams(model, env),
    fallback: fbModel && fbModel !== model ? { model: fbModel, extraBody: reasoningParams(fbModel, env) } : null,
  };
}
