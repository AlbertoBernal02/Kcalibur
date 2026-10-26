// Utilidades puras para leer la respuesta en streaming de una API compatible con OpenAI.

// Parser SSE incremental: se le van pasando trozos de texto y devuelve el `data:` de cada evento completo.
export function createSseParser() {
  let buf = "";
  return (chunk: string): string[] => {
    buf += chunk;
    const out: string[] = [];
    for (let m = /\r?\n\r?\n/.exec(buf); m; m = /\r?\n\r?\n/.exec(buf)) {
      const block = buf.slice(0, m.index);
      buf = buf.slice(m.index + m[0].length);
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (data) out.push(data);
    }
    return out;
  };
}

// Mayor sufijo de `text` que sea el comienzo de `tag` (puede completarse en el siguiente trozo).
function partialTail(text: string, tag: string): string {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) if (tag.startsWith(text.slice(-n))) return text.slice(-n);
  return "";
}

const OPEN = "<think>";
const CLOSE = "</think>";

// Quita los bloques <think>…</think> (razonamiento de Qwen y otros) aunque lleguen partidos entre trozos.
export function createThinkFilter() {
  let inThink = false;
  let pending = "";
  return {
    push(delta: string): string {
      let text = pending + delta;
      pending = "";
      let out = "";
      while (text) {
        if (inThink) {
          const end = text.indexOf(CLOSE);
          if (end === -1) {
            pending = partialTail(text, CLOSE);
            break;
          }
          text = text.slice(end + CLOSE.length).replace(/^\s+/, ""); // el salto de línea tras </think> sobra
          inThink = false;
        } else {
          const start = text.indexOf(OPEN);
          if (start === -1) {
            pending = partialTail(text, OPEN);
            out += text.slice(0, text.length - pending.length);
            break;
          }
          out += text.slice(0, start);
          text = text.slice(start + OPEN.length);
          inThink = true;
        }
      }
      return out;
    },
    // Al terminar el stream: lo retenido que no era una etiqueta se devuelve (un <think> sin cerrar se descarta).
    flush(): string {
      const rest = inThink ? "" : pending;
      pending = "";
      return rest;
    },
  };
}
