// Configuración del proveedor de IA (cualquier API compatible con OpenAI). Pura: recibe las variables de entorno.
// Por defecto: Groq con Qwen 3, que tiene plan gratuito. Se cambia con variables de entorno, sin tocar código:
//   AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_REASONING_EFFORT.

export type AiConfig = { baseUrl: string; model: string; apiKey: string | null; extraBody: Record<string, unknown> };

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_MODEL = "qwen/qwen3.8-27b";

export function getAiConfig(env: Record<string, string | undefined>): AiConfig | null {
  const baseUrl = (env.AI_BASE_URL || GROQ_BASE_URL).replace(/\/+$/, "");
  const apiKey = env.AI_API_KEY || null;
  // Un servidor local (p. ej. Ollama) no necesita clave; cualquier otro, sí.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl);
  if (!apiKey && !local) return null;

  // Qwen 3 "piensa" por defecto: en Groq se apaga para respuestas rápidas y baratas en tokens.
  // Con otro proveedor solo se envía si se pide expresamente (un parámetro desconocido podría rechazarse).
  const effort = env.AI_REASONING_EFFORT || (env.AI_BASE_URL ? undefined : "none");
  return {
    baseUrl,
    apiKey,
    model: env.AI_MODEL || DEFAULT_MODEL,
    extraBody: effort ? { reasoning_effort: effort, ...(effort === "none" ? {} : { reasoning_format: "hidden" }) } : {},
  };
}
