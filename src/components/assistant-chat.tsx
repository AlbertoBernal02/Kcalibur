"use client";

import { ArrowUp, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { plainMath } from "@/lib/ai/format";
import { toISO } from "@/lib/meals";
import { cacheGet, cacheSet } from "@/lib/offline/store";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cuánto me falta hoy para mi objetivo?",
  "Sugiere una cena que encaje con lo que me falta",
  "¿Cómo voy esta semana?",
  "Ideas de snack con mucha proteína",
];

// Formato mínimo para las respuestas: **negrita** y listas con "- ". Son elementos de React (nunca HTML crudo).
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  return (
    <>
      {plainMath(text).split("\n").map((line, i) => {
        const t = line.replace(/^#{1,6}\s+/, "");
        const bullet = /^\s*[-*•]\s+/.test(t);
        return bullet ? (
          <p key={i} className="flex gap-2 pl-1"><span aria-hidden>•</span><span>{inline(t.replace(/^\s*[-*•]\s+/, ""))}</span></p>
        ) : t.trim() === "" ? (
          <div key={i} className="h-2" />
        ) : (
          <p key={i}>{inline(t)}</p>
        );
      })}
    </>
  );
}

// Chat con el asistente de nutrición (respuestas en streaming desde /api/ai/chat).
export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // La conversación se guarda en el dispositivo (IndexedDB) y se borra al cerrar sesión.
  useEffect(() => {
    cacheGet<Msg[]>("chat").then((m) => {
      if (m) setMessages(m);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (loaded && !busy) void cacheSet("chat", messages);
  }, [messages, busy, loaded]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const setLast = (fn: (m: Msg) => Msg) => setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: Msg[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, date: toISO(new Date()) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        if (data.error === "not_configured") setNotConfigured(true);
        else setError(data.error ?? "No se pudo contactar con el asistente.");
        setMessages(history); // quita la burbuja vacía
        return;
      }

      // Líneas JSON: {"t":"delta","text"} … {"t":"done"} | {"t":"error","message"}
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { t: string; text?: string; message?: string; truncated?: boolean };
          if (ev.t === "delta") setLast((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.t === "error") setError(ev.message ?? "Error del asistente.");
          else if (ev.t === "done" && ev.truncated) setLast((m) => ({ ...m, content: m.content + "\n\n(Respuesta recortada: pídeme que continúe.)" }));
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError("Se perdió la conexión con el asistente.");
    } finally {
      // Si la respuesta quedó vacía (error o parada sin texto) no se deja una burbuja en blanco.
      setMessages((prev) => (prev.length && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content ? prev.slice(0, -1) : prev));
      setBusy(false);
      abortRef.current = null;
    }
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-fg"><Sparkles size={22} /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Asistente</h1>
          <p className="text-sm text-subtle">Conoce tus objetivos, tu diario y tus dietas.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} aria-label="Nueva conversación" className="flex h-11 w-11 items-center justify-center rounded-full text-subtle active:bg-muted">
            <Trash2 size={20} />
          </button>
        )}
      </header>

      {notConfigured ? (
        <div role="alert" className="rounded-3xl bg-card p-5">
          <p className="font-semibold">El asistente todavía no está activado</p>
          <p className="mt-1 text-sm text-subtle">
            Falta la clave de la IA en el servidor. Crea una gratis en <strong>console.groq.com</strong> (API Keys) y añádela como{" "}
            <code className="rounded bg-muted px-1">AI_API_KEY</code> en <code className="rounded bg-muted px-1">.env.local</code> (o en las
            variables de entorno de Vercel). Después reinicia la app.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3" aria-live="polite">
            {loaded && messages.length === 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-sm text-subtle">Pregúntame lo que quieras sobre tu alimentación. Por ejemplo:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-2xl bg-card px-4 py-3 text-left text-sm font-medium transition active:scale-[0.99]">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[88%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${m.role === "user" ? "self-end bg-primary text-primary-fg" : "self-start bg-card"}`}>
                {m.role === "assistant" ? (
                  m.content ? <Rich text={m.content} /> : <span className="inline-flex gap-1" aria-label="Escribiendo"><i className="h-2 w-2 animate-bounce rounded-full bg-subtle" /><i className="h-2 w-2 animate-bounce rounded-full bg-subtle [animation-delay:150ms]" /><i className="h-2 w-2 animate-bounce rounded-full bg-subtle [animation-delay:300ms]" /></span>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            ))}
            {error && <p role="alert" className="self-start rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] mt-4 bg-gradient-to-t from-background via-background to-transparent pt-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 rounded-3xl border border-border bg-card p-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Escribe tu pregunta…"
                aria-label="Pregunta para el asistente"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none"
              />
              {busy ? (
                <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Parar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  <Square size={18} />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="Enviar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-fg disabled:opacity-40">
                  <ArrowUp size={22} />
                </button>
              )}
            </form>
            <p className="mt-2 px-2 text-center text-xs text-subtle">Respuestas orientativas: no sustituyen a tu nutricionista.</p>
          </div>
        </>
      )}
    </div>
  );
}
