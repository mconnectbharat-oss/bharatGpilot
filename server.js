
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runModelDetailed,
  getAvailableProviders,
  getAvailableModels,
  getRouterConfig
} from "./src/services/model-router.js";
import {
  registerUser,
  loginUser,
  logoutRequest,
  requireAuth
} from "./src/security/auth.js";
import { getActionPolicySnapshot } from "./src/core/permissions.js";
import { query } from "./src/services/db.js";
import { beginGitHubConnect, finishGitHubConnect, getGitHubAccessToken, getGitHubIdentity } from "./src/security/github-account.js";
import { createInvestigationPlan } from "./src/core/orchestrator.js";
import { createResearchPlan } from "./src/core/planner.js";
import { researchRepository } from "./src/core/researcher.js";
import { analyzeRepository } from "./src/agents/repository-analyst.js";
import { inspectRepository } from "./src/github/repository-intelligence.js";
import { analyzeRepositorySignals } from "./src/github/repository-analysis.js";
import { detectIntent, buildCopilotSystemPrompt } from "./src/services/intent-engine.js";
import { buildGitHubIntelligence } from "./src/github/github-intelligence.js";
import { listMemories, createMemory, deleteMemory } from "./src/services/agent-memory.js";
import { addKnowledgeDocument, listKnowledgeDocuments, deleteKnowledgeDocument, searchKnowledge, buildKnowledgeContext } from "./src/services/knowledge-rag.js";
import { dispatchAutomationEvent, getAutomationStatus } from "./src/services/n8n-automation.js";



dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: process.env.APP_NAME || "BharatGPilot"
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    res.status(201).json(await registerUser(req.body ?? {}, res));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    res.json(await loginUser(req.body ?? {}, res));
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  await logoutRequest(req, res);
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/github/connect", requireAuth, async (req, res) => {
  try { res.json({ url: await beginGitHubConnect(req, res) }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
app.get("/api/github/oauth/callback", async (req, res) => {
  try { await finishGitHubConnect(req, res); res.redirect("/?github=connected"); }
  catch (error) { res.redirect("/?github=error&message=" + encodeURIComponent(error.message)); }
});
app.get("/api/github/identity", requireAuth, async (req, res) => {
  try { res.json({ github: await getGitHubIdentity(req.user.id) }); }
  catch { res.status(503).json({ error: "Identity service unavailable." }); }
});
app.get("/api/conversations", requireAuth, async (req, res) => {
  try { const result = await query("SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50",[req.user.id]); res.json({ conversations: result.rows }); }
  catch { res.status(503).json({ error: "Conversation service unavailable." }); }
});
app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  try { const result = await query("SELECT m.id,m.role,m.content,m.provider,m.model,m.github_context,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.id=$1 AND c.user_id=$2 ORDER BY m.created_at ASC",[req.params.id,req.user.id]); res.json({ messages: result.rows }); }
  catch { res.status(503).json({ error: "Conversation service unavailable." }); }
});
app.get("/api/pilot/policy", (_req, res) => {
  res.json({ policy: getActionPolicySnapshot() });
});

app.post("/api/pilot/plan", requireAuth, (req, res) => {
  try {
    res.json(createInvestigationPlan(req.body?.request));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/pilot/investigate", requireAuth, async (req, res) => {
  try {
    const plan = createResearchPlan({
      request: req.body?.request,
      repository: req.body?.repository
    });
    const researched = await researchRepository(plan);
    const analyzed = analyzeRepository(researched.plan, researched.inspection);
    res.json({ ...analyzed, inspection: researched.inspection });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/github/repository/:owner/:repo", requireAuth, async (req, res) => {
  try {
    const result = await inspectRepository(req.params.owner + "/" + req.params.repo, undefined, await getGitHubAccessToken(req.user.id));
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/pilot/repository-analysis/:owner/:repo", requireAuth, async (req, res) => {
  try {
    const inspection = await inspectRepository(req.params.owner + "/" + req.params.repo, undefined, await getGitHubAccessToken(req.user.id));
    res.json({ inspection, analysis: analyzeRepositorySignals(inspection) });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/pilot/github-intelligence", requireAuth, async (req, res) => {
  try {
    const repository = req.body?.repository;
    const question = req.body?.question || "";
    res.json(await buildGitHubIntelligence(repository, question, await getGitHubAccessToken(req.user.id)));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/pilot/providers", (_req, res) => {
  res.json({
    providers: getAvailableProviders()
  });
});

app.post("/api/pilot/intent", requireAuth, (req, res) => {
  try {
    res.json({ intent: detectIntent(req.body?.input ?? "") });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/pilot/router", (_req, res) => {
  res.json({ router: getRouterConfig() });
});

app.get("/api/pilot/models", (_req, res) => {
  res.json({
    models: getAvailableModels()
  });
});

app.post("/api/pilot/chat", requireAuth, async (req, res) => {
  try {
    const {
      provider = "auto",
      model,
      messages,
      conversationId
    } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "A non-empty messages array is required."
      });
    }

    if (messages.length > 50) {
      return res.status(400).json({
        error: "Too many messages in one request."
      });
    }

    const validRoles = new Set(["system", "user", "assistant"]);
    const cleanMessages = [];

    for (const message of messages) {
      if (
        !message ||
        !validRoles.has(message.role) ||
        typeof message.content !== "string"
      ) {
        return res.status(400).json({
          error: "Each message must have a valid role and text content."
        });
      }

      if (message.content.length > 50000) {
        return res.status(400).json({
          error: "A message is too long."
        });
      }

      cleanMessages.push({
        role: message.role,
        content: message.content
      });
    }

    const latestUserMessage = [...cleanMessages].reverse().find((message) => message.role === "user");
    const intent = detectIntent(latestUserMessage?.content || "");
    async function saveTurn(answer, provider, model, githubContext) {
      let id = conversationId;
      if (id) {
        const owned = await query("SELECT id FROM conversations WHERE id=$1 AND user_id=$2",[id,req.user.id]);
        if (!owned.rows[0]) id = null;
      }
      if (!id) {
        const created = await query("INSERT INTO conversations (user_id,title) VALUES ($1,$2) RETURNING id",[req.user.id,(latestUserMessage?.content || "New investigation").slice(0,120)]);
        id = created.rows[0].id;
      }
      await query("INSERT INTO messages (conversation_id,role,content) VALUES ($1,$2,$3)",[id,"user",latestUserMessage?.content || ""]);
      await query("INSERT INTO messages (conversation_id,role,content,provider,model,github_context) VALUES ($1,$2,$3,$4,$5,$6)",[id,"assistant",answer,provider,model,githubContext ? JSON.stringify(githubContext) : null]);
      await query("UPDATE conversations SET updated_at=now() WHERE id=$1",[id]);
      return id;
    }
    if (intent.repository) {
      try {
        const intelligence = await buildGitHubIntelligence(
          `${intent.repository.owner}/${intent.repository.repo}`,
          latestUserMessage?.content || "",
          await getGitHubAccessToken(req.user.id)
        );
        const savedConversationId = await saveTurn(intelligence.response?.answer || JSON.stringify(intelligence.brief), "github-intelligence", null, { repository: intelligence.repository, evidence: intelligence.brief.evidenceSummary, sources: intelligence.sources, coverage: intelligence.brief.coverage });
        return res.json({
          conversationId: savedConversationId,
          provider: "github-intelligence",
          model: null,
          answer: intelligence.response?.answer || intelligence.brief,
          routing: { attempts: 0, fallbackUsed: false, latencyMs: 0 },
          intent,
          github: {
            repository: intelligence.repository,
            evidence: intelligence.brief.evidenceSummary,
            sources: intelligence.sources,
            coverage: intelligence.brief.coverage
          }
        });
      } catch (error) {
        console.warn("GitHub intelligence fallback:", error.message);
      }
    }
    let knowledgeResults = [];
    try {
      knowledgeResults = await searchKnowledge(req.user.id, latestUserMessage?.content || "", 5);
    } catch (error) {
      // Knowledge retrieval must not take down ordinary chat if the optional
      // knowledge schema has not been migrated yet or the database is degraded.
      console.warn("Knowledge retrieval unavailable:", error.message);
    }
    const knowledgeContext = buildKnowledgeContext(knowledgeResults);
    const knowledgeInstruction = knowledgeContext.instruction
      ? `\n\n${knowledgeContext.instruction}`
      : "";
    const hasSystemMessage = cleanMessages.some((message) => message.role === "system");
    let enrichedMessages;
    if (hasSystemMessage) {
      const systemIndex = cleanMessages.findIndex((message) => message.role === "system");
      enrichedMessages = cleanMessages.map((message, index) =>
        index === systemIndex
          ? { ...message, content: `${message.content}${knowledgeInstruction}` }
          : message
      );
    } else {
      enrichedMessages = [
        { role: "system", content: `${buildCopilotSystemPrompt(intent)}${knowledgeInstruction}` },
        ...cleanMessages
      ];
    }

    const result = await runModelDetailed({
      provider,
      model,
      messages: enrichedMessages
    });

    const savedConversationId = await saveTurn(result.answer, result.provider, result.model, null);
    res.json({
      conversationId: savedConversationId,
      provider: result.provider,
      model: result.model,
      answer: result.answer,
      routing: {
        attempts: result.attempts,
        fallbackUsed: result.fallbackUsed,
        latencyMs: result.latencyMs
      },
      intent,
      knowledge: {
        retrieval: knowledgeContext.retrieval,
        sources: knowledgeContext.sources
      }
    });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(502).json({
      error: "The AI request failed.",
      details: process.env.NODE_ENV === "development"
        ? error.message
        : undefined
    });
  }
});


app.get("/api/pilot/memory", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    res.json({ memories: await listMemories(req.user.id, limit) });
  } catch (error) {
    res.status(503).json({ error: "Memory service unavailable." });
  }
});

app.post("/api/pilot/memory", requireAuth, async (req, res) => {
  try {
    const { content, category = "general", source = "user" } = req.body ?? {};
    const memory = await createMemory(req.user.id, { content, category, source });
    res.status(201).json({ memory });
  } catch (error) {
    res.status(400).json({ error: error.message || "Invalid memory." });
  }
});

app.delete("/api/pilot/memory/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteMemory(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Memory not found." });
    res.status(204).end();
  } catch {
    res.status(503).json({ error: "Memory service unavailable." });
  }
});

app.get("/api/pilot/knowledge", requireAuth, async (req, res) => {
  try {
    res.json({ documents: await listKnowledgeDocuments(req.user.id) });
  } catch (error) {
    console.error("Knowledge library unavailable:", error.message);
    res.status(503).json({ error: "Knowledge library unavailable." });
  }
});

app.post("/api/pilot/knowledge", requireAuth, async (req, res) => {
  try {
    const document = await addKnowledgeDocument(req.user.id, {
      title: req.body?.title,
      content: req.body?.content,
      sourceName: req.body?.sourceName || ""
    });
    res.status(201).json({ document });
  } catch (error) {
    if (error?.code === "BGP_KNOWLEDGE_INPUT") {
      return res.status(400).json({ error: error.message });
    }
    console.error("Knowledge document save failed:", error.message);
    res.status(503).json({ error: "Knowledge document could not be saved." });
  }
});

app.post("/api/pilot/knowledge/search", requireAuth, async (req, res) => {
  try {
    const results = await searchKnowledge(req.user.id, req.body?.query || "", req.body?.limit);
    const context = buildKnowledgeContext(results);
    res.json({
      retrieval: context.retrieval,
      sources: context.sources,
      results: results.map((result, index) => ({
        citation: `K${index + 1}`,
        title: result.title,
        sourceName: result.source_name || result.title,
        chunkIndex: Number(result.chunk_index) + 1,
        content: result.content,
        score: Number(result.score) || 0
      }))
    });
  } catch (error) {
    console.error("Knowledge search unavailable:", error.message);
    res.status(503).json({ error: "Knowledge search unavailable." });
  }
});

app.delete("/api/pilot/knowledge/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteKnowledgeDocument(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Knowledge document not found." });
    res.status(204).end();
  } catch (error) {
    console.error("Knowledge deletion unavailable:", error.message);
    res.status(503).json({ error: "Knowledge deletion unavailable." });
  }
});

app.get("/api/pilot/automation/status", requireAuth, (_req, res) => {
  res.json({ automation: getAutomationStatus() });
});

app.post("/api/pilot/automation/dispatch", requireAuth, async (req, res) => {
  try {
    const { event, payload = {} } = req.body ?? {};
    const result = await dispatchAutomationEvent({
      userId: req.user.id,
      event,
      payload
    });
    res.status(result.dispatched ? 202 : 200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Automation dispatch failed." });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found." });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"), (error) => {
    if (error) next(error);
  });
});

export default app;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`BharatGPilot running at http://localhost:${PORT}`);
  });
}


