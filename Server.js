
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runModel,
  getAvailableProviders
} from "./src/services/model-router.js";
import {
  registerUser,
  loginUser,
  logoutRequest,
  requireAuth
} from "./src/security/auth.js";
import { getActionPolicySnapshot } from "./src/core/permissions.js";
import { createInvestigationPlan } from "./src/core/orchestrator.js";
import { createResearchPlan } from "./src/core/planner.js";
import { researchRepository } from "./src/core/researcher.js";
import { inspectRepository } from "./src/github/repository-intelligence.js";
import { analyzeRepositorySignals } from "./src/github/repository-analysis.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000"
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: process.env.APP_NAME || "BharatGPilot"
  });
});

app.post("/api/auth/register", (req, res) => {
  try {
    res.status(201).json(registerUser(req.body ?? {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    res.json(loginUser(req.body ?? {}));
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  logoutRequest(req);
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
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
    const result = await researchRepository(plan);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/github/repository/:owner/:repo", requireAuth, async (req, res) => {
  try {
    const result = await inspectRepository(req.params.owner + "/" + req.params.repo);
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/pilot/repository-analysis/:owner/:repo", requireAuth, async (req, res) => {
  try {
    const inspection = await inspectRepository(req.params.owner + "/" + req.params.repo);
    res.json({ inspection, analysis: analyzeRepositorySignals(inspection) });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/pilot/providers", (_req, res) => {
  res.json({
    providers: getAvailableProviders()
  });
});

app.post("/api/pilot/chat", async (req, res) => {
  try {
    const { provider = "openrouter", messages } = req.body ?? {};

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

    const answer = await runModel({
      provider,
      messages: cleanMessages
    });

    res.json({
      provider,
      answer
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


