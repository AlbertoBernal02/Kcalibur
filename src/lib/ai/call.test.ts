import assert from "node:assert/strict";
import { test } from "node:test";
import { aiFetch, shouldFallback } from "./call.ts";
import { getAiConfig } from "./provider.ts";

const cfg = getAiConfig({ AI_API_KEY: "k" })!; // Groq: gpt-oss-120b con reserva gpt-oss-20b

// fetch falso: devuelve las respuestas en orden y anota el modelo pedido en cada llamada.
function fakeFetch(...replies: (number | Error)[]) {
  const models: string[] = [];
  const impl = (async (_url: unknown, init?: RequestInit) => {
    models.push(JSON.parse(String(init?.body)).model);
    const r = replies[models.length - 1];
    if (r instanceof Error) throw r;
    return new Response("{}", { status: r });
  }) as typeof fetch;
  return { impl, models };
}
const run = (f: ReturnType<typeof fakeFetch>, c = cfg) => aiFetch(c, { messages: [] }, { timeoutMs: 1000, fetchImpl: f.impl });

test("configuración: reserva por defecto, personalizada o desactivada", () => {
  assert.equal(cfg.fallback?.model, "openai/gpt-oss-20b");
  assert.equal(getAiConfig({ AI_API_KEY: "k", AI_FALLBACK_MODEL: "qwen/qwen3.8-27b" })!.fallback?.model, "qwen/qwen3.8-27b");
  assert.equal(getAiConfig({ AI_API_KEY: "k", AI_FALLBACK_MODEL: "off" })!.fallback, null);
  // con otro proveedor o modelo propio no se inventa una reserva
  assert.equal(getAiConfig({ AI_API_KEY: "k", AI_BASE_URL: "https://x.test/v1", AI_MODEL: "m" })!.fallback, null);
  assert.equal(getAiConfig({ AI_API_KEY: "k", AI_MODEL: "otro/modelo" })!.fallback, null);
  // la reserva igual al principal no tiene sentido
  assert.equal(getAiConfig({ AI_API_KEY: "k", AI_FALLBACK_MODEL: "openai/gpt-oss-120b" })!.fallback, null);
});

test("shouldFallback: sí con modelo retirado/límite/caída, no con clave inválida", () => {
  for (const s of [400, 404, 429, 500, 503]) assert.equal(shouldFallback(s), true, String(s));
  for (const s of [200, 401, 403]) assert.equal(shouldFallback(s), false, String(s));
});

test("aiFetch: si el principal funciona no toca la reserva", async () => {
  const f = fakeFetch(200);
  assert.equal((await run(f)).status, 200);
  assert.deepEqual(f.models, ["openai/gpt-oss-120b"]);
});

test("aiFetch: modelo retirado (404) o límite (429) → usa la reserva", async () => {
  for (const status of [404, 429]) {
    const f = fakeFetch(status, 200);
    assert.equal((await run(f)).status, 200);
    assert.deepEqual(f.models, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  }
});

test("aiFetch: error de red del principal → reserva; clave inválida → sin reserva", async () => {
  const net = fakeFetch(new Error("red caída"), 200);
  assert.equal((await run(net)).status, 200);
  assert.equal(net.models.length, 2);

  const auth = fakeFetch(401, 200);
  assert.equal((await run(auth)).status, 401);
  assert.equal(auth.models.length, 1);
});

test("aiFetch: sin reserva el error del principal se devuelve tal cual", async () => {
  const sin = { ...cfg, fallback: null };
  const f = fakeFetch(503, 200);
  assert.equal((await run(f, sin)).status, 503);
  assert.equal(f.models.length, 1);
  await assert.rejects(run(fakeFetch(new Error("x")), sin));
});

test("aiFetch: si fallan los dos devuelve el último error", async () => {
  const f = fakeFetch(429, 503);
  assert.equal((await run(f)).status, 503);
  assert.equal(f.models.length, 2);
});

test("aiFetch: fallbackWhen permite no usar la reserva con un límite (429)", async () => {
  const f = fakeFetch(429, 200);
  const res = await aiFetch(cfg, { messages: [] }, { timeoutMs: 1000, fetchImpl: f.impl, fallbackWhen: (s) => s !== 429 && shouldFallback(s) });
  assert.equal(res.status, 429);
  assert.equal(f.models.length, 1);
  const g = fakeFetch(404, 200);
  const ok = await aiFetch(cfg, { messages: [] }, { timeoutMs: 1000, fetchImpl: g.impl, fallbackWhen: (s) => s !== 429 && shouldFallback(s) });
  assert.equal(ok.status, 200);
  assert.equal(g.models.length, 2);
});
