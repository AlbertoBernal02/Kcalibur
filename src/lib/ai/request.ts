// Validación de la petición del chat y limitador de frecuencia (puros, sin red).

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatRequest = { messages: ChatMessage[]; date: string };

export const LIMITS = { maxMessages: 20, maxChars: 4000 };

// Devuelve la petición validada y recortada, o un mensaje de error en español.
export function parseChatRequest(body: unknown): ChatRequest | string {
  if (typeof body !== "object" || body === null) return "Petición no válida.";
  const { messages, date } = body as { messages?: unknown; date?: unknown };
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Fecha no válida.";
  if (!Array.isArray(messages) || messages.length === 0) return "No hay mensajes.";

  const clean: ChatMessage[] = [];
  for (const m of messages) {
    const { role, content } = (m ?? {}) as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return "Mensaje no válido.";
    const text = content.trim();
    if (!text) continue; // se descartan los vacíos
    if (text.length > LIMITS.maxChars) return `El mensaje es demasiado largo (máximo ${LIMITS.maxChars} caracteres).`;
    clean.push({ role, content: text });
  }

  const recent = clean.slice(-LIMITS.maxMessages);
  while (recent.length && recent[0].role !== "user") recent.shift(); // la conversación debe empezar por el usuario
  if (recent.length === 0 || recent[recent.length - 1].role !== "user") return "El último mensaje debe ser del usuario.";
  return { messages: recent, date };
}

// Limitador de ventana deslizante en memoria (por clave, p. ej. id de usuario).
// ponytail: vive en la memoria de cada instancia serverless, así que es un freno de coste "de mejor esfuerzo"; usar Redis/Supabase si hace falta un límite estricto.
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSec: Math.ceil((recent[0] + windowMs - now) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}
