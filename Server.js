
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Configuration ----------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const MODEL_OPTIONS = {
  default: DEFAULT_MODEL,
  claude: process.env.CLAUDE_MODEL || "anthropic/claude-sonnet-4",
  openrouter: DEFAULT_MODEL,
};

const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 20000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ---------- Middleware ----------

app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim())
      : false,
  })
);

app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

// ---------- AI instructions ----------

const SYSTEM_PROMPT = `
You are BharatGPilot, a capable general-purpose AI assistant.

Your identity:
- Name: BharatGPilot
- Designed by Mohit Saha
- Powered by the configured AI model provider

Your capabilities:
- Answer general questions.
- Help with programming and debugging.
- Explain difficult subjects.
- Assist with writing and research.
- Help plan and design websites and applications.
- Analyze text and supported uploaded documents.
- Be clear about uncertainty and limitations.

Rules:
- Be helpful, accurate, and respectful.
- Never invent sources, facts, or tool results.
- Explain when information needs verification.
- Never claim to have accessed files, devices, or services
  unless the connected tools actually provided that access.
- Never reveal private API keys or internal configuration.
`;

// ---------- Helpers ----------

function getModel(selection) {
  return MODEL_OPTIONS[selection] || DEFAULT_MODEL;
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, MAX_MESSAGE_LENGTH),
    }));
}

function extractTextFiles(files) {
  const supported = new Set([
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".js",
    ".ts",
    ".py",
    ".html",
    ".css",
  ]);

  const extracted = [];

  for (const file of files || []) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!supported.has(extension)) {
      extracted.push(
        `[File attached: ${file.originalname}. ` +
        `This file type is not text-extracted by this server.]`
      );
      continue;
    }

    const content = file.buffer.toString("utf8");

    extracted.push(
      `\n\n--- FILE: ${file.originalname} ---\n` +
      content.slice(0, 50000) +
      `\n--- END FILE ---`
    );
  }

  return extracted.join("\n");
}

async function askOpenRouter({
  messages,
  model,
  stream = false,
}) {
  if (!OPENROUTER_API_KEY) {
    const error = new Error(
      "OPENROUTER_API_KEY is not configured on the server."
    );
    error.status = 503;
    throw error;
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.APP_URL || "http://localhost:3000",
        "X-Title": "BharatGPilot",
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
      signal: AbortSignal.timeout(120000),
    }
  );

  if (!response.ok) {
    const error = new Error(
      `AI provider returned HTTP ${response.status}.`
    );
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }

  return response;
}

// ---------- Health check ----------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "BharatGPilot",
    version: "1.0.0",
    providerConfigured: Boolean(OPENROUTER_API_KEY),
  });
});

// ---------- Main chat endpoint ----------
// Compatible with the FormData request from index.html.

app.post(
  "/api/pilot/chat",
  upload.array("files", 5),
  async (req, res) => {
    try {
      const message =
        typeof req.body.message === "string"
          ? req.body.message.trim()
          : "";

      if (!message && !(req.files?.length)) {
        return res.status(400).json({
          error: "Please enter a message or attach a file.",
        });
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(413).json({
          error: "Your message is too long.",
        });
      }

      let history = [];

      try {
        history = JSON.parse(req.body.history || "[]");
      } catch {
        return res.status(400).json({
          error: "Invalid conversation history.",
        });
      }

      const safeHistory = cleanHistory(history);
      const fileText = extractTextFiles(req.files);

      const userContent =
        (message || "Please analyze the attached files.") +
        (fileText ? "\n\nAttached file content:\n" + fileText : "");

      const model = getModel(req.body.model);

      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...safeHistory,
        {
          role: "user",
          content: userContent,
        },
      ];

      const response = await askOpenRouter({
        messages,
        model,
      });

      const data = await response.json();

      const reply =
        data.choices?.[0]?.message?.content;

      if (typeof reply !== "string") {
        return res.status(502).json({
          error: "The AI provider returned an unexpected response.",
        });
      }

      return res.json({
        reply,
        model,
        provider: "OpenRouter",
      });
    } catch (error) {
      console.error("Chat error:", error.message);

      return res.status(error.status || 500).json({
        error:
          error.status === 503
            ? error.message
            : "The AI request failed. Please try again.",
      });
    }
  }
);

// ---------- Streaming chat endpoint ----------
// Optional endpoint for a future streaming frontend.

app.post(
  "/api/pilot/stream",
  upload.array("files", 5),
  async (req, res) => {
    try {
      const message =
        typeof req.body.message === "string"
          ? req.body.message.trim()
          : "";

      if (!message && !(req.files?.length)) {
        return res.status(400).json({
          error: "A message or file is required.",
        });
      }

      let history = [];

      try {
        history = JSON.parse(req.body.history || "[]");
      } catch {
        return res.status(400).json({
          error: "Invalid conversation history.",
        });
      }

      const fileText = extractTextFiles(req.files);
      const safeHistory = cleanHistory(history);

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...safeHistory,
        {
          role: "user",
          content:
            (message || "Analyze the attached files.") +
            (fileText ? "\n\n" + fileText : ""),
        },
      ];

      const model = getModel(req.body.model);

      const upstream = await askOpenRouter({
        messages,
        model,
        stream: true,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } finally {
        res.end();
      }
    } catch (error) {
      console.error("Streaming error:", error.message);

      if (!res.headersSent) {
        res.status(error.status || 500).json({
          error: "Streaming request failed.",
        });
      } else {
        res.end();
      }
    }
  }
);

// ---------- Static frontend ----------

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------- Error handler ----------

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Each uploaded file must be 5 MB or smaller."
        : "Upload limit exceeded.",
    });
  }

  res.status(500).json({
    error: "An unexpected server error occurred.",
  });
});

// ---------- Start server ----------

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`BharatGPilot running at http://localhost:${PORT}`);
  });
}

export default app;

