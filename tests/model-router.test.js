import test from "node:test";
import assert from "node:assert/strict";
import { runModelDetailed, getRouterConfig } from "../src/services/model-router.js";

const originalFetch = globalThis.fetch;

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of [
    "MODEL_ROUTER_ORDER",
    "OPENROUTER_API_KEY",
    "OPENROUTER_MODEL",
    "GEMINI_API_KEY",
    "GEMINI_MODEL"
  ]) delete process.env[key];
});

test("automatic router fails over to the next configured provider", async () => {
  process.env.MODEL_ROUTER_ORDER = "openrouter,gemini";
  process.env.OPENROUTER_API_KEY = "test-openrouter";
  process.env.OPENROUTER_MODEL = "openrouter/free";
  process.env.GEMINI_API_KEY = "test-gemini";
  process.env.GEMINI_MODEL = "gemini-2.5-flash";

  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.includes("openrouter.ai")) {
      return response(503, { error: { message: "temporary outage" } });
    }
    return response(200, {
      candidates: [{ content: { parts: [{ text: "Gemini fallback works." }] } }]
    });
  };

  const result = await runModelDetailed({
    provider: "auto",
    messages: [{ role: "user", content: "hello" }]
  });

  assert.equal(result.answer, "Gemini fallback works.");
  assert.equal(result.provider, "gemini");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.failures[0].status, 503);
  assert.equal(calls.length, 2);
});

test("explicit provider selection stays strict and does not fail over", async () => {
  process.env.OPENROUTER_API_KEY = "test-openrouter";
  process.env.OPENROUTER_MODEL = "openrouter/free";
  process.env.GEMINI_API_KEY = "test-gemini";
  process.env.GEMINI_MODEL = "gemini-2.5-flash";

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response(503, { error: { message: "down" } });
  };

  await assert.rejects(
    () => runModelDetailed({
      provider: "openrouter",
      messages: [{ role: "user", content: "hello" }]
    }),
    /All configured AI providers failed/
  );
  assert.equal(calls, 1);
});

test("router configuration exposes safe provider names only", () => {
  process.env.MODEL_ROUTER_ORDER = "gemini,openrouter,unknown";
  assert.deepEqual(getRouterConfig().order, ["gemini", "openrouter"]);
});
