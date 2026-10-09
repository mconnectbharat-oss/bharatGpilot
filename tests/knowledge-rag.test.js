import test from "node:test";
import assert from "node:assert/strict";
import { chunkText, buildKnowledgeContext } from "../src/services/knowledge-rag.js";

test("chunkText returns bounded, non-empty chunks for long text", () => {
  const text = ("BharatGPilot uses evidence-backed repository analysis. ").repeat(60);
  const chunks = chunkText(text, { chunkSize: 300, overlap: 40 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length > 0 && chunk.length <= 300));
});

test("chunkText preserves Unicode and rejects empty or oversized input", () => {
  assert.deepEqual(chunkText("নমস্কার 🚀", { chunkSize: 100, overlap: 10 }), ["নমস্কার 🚀"]);
  assert.throws(() => chunkText("   "), /must contain text/);
  assert.throws(() => chunkText("x".repeat(100001)), /100000 characters/);
});

test("chunkText rejects invalid overlap and limits", () => {
  assert.throws(() => chunkText("valid text", { chunkSize: 50 }), /between 100 and 2400/);
  assert.throws(() => chunkText("valid text", { chunkSize: 100, overlap: 100 }), /smaller than chunk size/);
});

test("buildKnowledgeContext marks excerpts untrusted and provides traceable citations", () => {
  const context = buildKnowledgeContext([{
    document_id: "doc-1",
    title: "BharatGPilot notes",
    source_name: "notes.txt",
    chunk_index: 0,
    content: "The project uses evidence grades.",
    score: "0.25"
  }]);
  assert.equal(context.retrieval, "matched");
  assert.equal(context.sources[0].citation, "K1");
  assert.equal(context.sources[0].chunkIndex, 1);
  assert.match(context.instruction, /untrusted reference data/);
  assert.match(context.instruction, /\[K1\]/);
});

test("buildKnowledgeContext explicitly reports missing evidence", () => {
  const context = buildKnowledgeContext([]);
  assert.equal(context.retrieval, "no_evidence_found");
  assert.deepEqual(context.sources, []);
  assert.equal(context.instruction, "");
});
