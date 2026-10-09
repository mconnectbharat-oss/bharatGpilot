import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("inline frontend scripts parse as valid JavaScript", () => {
  const scripts = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  assert.ok(scripts.length > 0, "expected at least one inline script");
  for (const source of scripts) assert.doesNotThrow(() => new Script(source));
});

test("knowledge vault controls are present and retrieved content uses text rendering", () => {
  assert.match(html, /id="knowledge-panel"/);
  assert.match(html, /id="knowledge-save"/);
  assert.match(html, /id="knowledge-search-button"/);
  assert.match(html, /excerpt\\.textContent=item\\.content/);
  assert.doesNotMatch(html, /excerpt\\.innerHTML/);
});
