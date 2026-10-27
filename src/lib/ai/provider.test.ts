import assert from "node:assert/strict";
import { test } from "node:test";
import { getAiConfig } from "./provider.ts";
import { createSseParser, createThinkFilter } from "./stream.ts";

test("proveedor: sin clave no está configurado (salvo servidor local)", () => {
  assert.equal(getAiConfig({}), null);
  assert.ok(getAiConfig({ AI_BASE_URL: "http://localhost:11434/v1", AI_MODEL: "qwen3:8b" }));
});

test("proveedor: por defecto Groq + gpt-oss con razonamiento bajo", () => {
  const c = getAiConfig({ AI_API_KEY: "k" })!;
  assert.equal(c.baseUrl, "https://api.groq.com/openai/v1");
  assert.equal(c.model, "openai/gpt-oss-120b");
  assert.deepEqual(c.extraBody, { reasoning_effort: "low" });
});

test("proveedor: con Qwen el razonamiento va oculto (salvo con esfuerzo none)", () => {
  const qwen = { AI_API_KEY: "k", AI_MODEL: "qwen/qwen3.8-27b" };
  assert.deepEqual(getAiConfig(qwen)!.extraBody, { reasoning_effort: "low", reasoning_format: "hidden" });
  assert.deepEqual(getAiConfig({ ...qwen, AI_REASONING_EFFORT: "none" })!.extraBody, { reasoning_effort: "none" });
});

test("proveedor: con otro proveedor no se envían parámetros desconocidos", () => {
  const c = getAiConfig({ AI_API_KEY: "k", AI_BASE_URL: "https://openrouter.ai/api/v1/", AI_MODEL: "x/y" })!;
  assert.equal(c.baseUrl, "https://openrouter.ai/api/v1");
  assert.deepEqual(c.extraBody, {});
  assert.deepEqual(getAiConfig({ AI_API_KEY: "k", AI_REASONING_EFFORT: "low" })!.extraBody, { reasoning_effort: "low" });
});

test("SSE: eventos completos aunque lleguen partidos", () => {
  const p = createSseParser();
  assert.deepEqual(p('data: {"a":1}\n\ndata: {"a"'), ['{"a":1}']);
  assert.deepEqual(p(':2}\n\ndata: [DONE]\n\n'), ['{"a":2}', "[DONE]"]);
  assert.deepEqual(p("data: sin fin"), []); // incompleto: se espera al resto
});

test("SSE: admite saltos CRLF", () => {
  assert.deepEqual(createSseParser()('data: x\r\n\r\ndata: y\r\n\r\n'), ["x", "y"]);
});

test("think: quita el razonamiento aunque las etiquetas lleguen partidas", () => {
  const f = createThinkFilter();
  const out = ["Hola <th", "ink>pienso", " mucho</thi", "nk>\n\nRespuesta ", "final"].map((c) => f.push(c)).join("") + f.flush();
  assert.equal(out, "Hola Respuesta final");
});

test("think: texto normal intacto, y un '<' suelto no se pierde", () => {
  const f = createThinkFilter();
  assert.equal(f.push("5 < 6 y ") + f.push("<") + f.flush(), "5 < 6 y <");
});

test("think: un bloque sin cerrar se descarta", () => {
  const f = createThinkFilter();
  assert.equal(f.push("Antes <think>nunca termina") + f.flush(), "Antes ");
});
