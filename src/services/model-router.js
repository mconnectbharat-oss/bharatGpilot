import { MODEL_CATALOG, getModelCatalog, isKnownModel } from "./model-catalog.js";

const DEFAULT_ROUTER_ORDER = ["openrouter","gemini","groq","cerebras","mistral","nvidia","cloudflare","huggingface","pollinations"];
const TRANSIENT_STATUS = new Set([408,409,425,429,500,502,503,504]);
const configured = (value) => Boolean(value && !String(value).startsWith("your_"));
function routerOrder() {
  const custom = String(process.env.MODEL_ROUTER_ORDER || "").split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  return [...new Set(custom.length ? custom : DEFAULT_ROUTER_ORDER)].filter((name) => providers[name]);
}

const providers = {
  openrouter: {
    key: "OPENROUTER_API_KEY",
    base: "OPENROUTER_BASE_URL",
    model: "OPENROUTER_MODEL",
    defaultBase: "https://openrouter.ai/api/v1",
    format: "openai"
  },
  groq: {
    key: "GROQ_API_KEY",
    base: "GROQ_BASE_URL",
    model: "GROQ_MODEL",
    defaultBase: "https://api.groq.com/openai/v1",
    format: "openai"
  },
  cerebras: {
    key: "CEREBRAS_API_KEY",
    base: "CEREBRAS_BASE_URL",
    model: "CEREBRAS_MODEL",
    defaultBase: "https://api.cerebras.ai/v1",
    format: "openai"
  },
  mistral: {
    key: "MISTRAL_API_KEY",
    base: "MISTRAL_BASE_URL",
    model: "MISTRAL_MODEL",
    defaultBase: "https://api.mistral.ai/v1",
    format: "openai"
  },
  nvidia: {
    key: "NVIDIA_API_KEY",
    base: "NVIDIA_BASE_URL",
    model: "NVIDIA_MODEL",
    defaultBase: "https://integrate.api.nvidia.com/v1",
    format: "openai"
  },
  gemini: {
    key: "GEMINI_API_KEY",
    model: "GEMINI_MODEL",
    format: "gemini"
  },
  huggingface: {
    key: "HUGGINGFACE_API_KEY",
    model: "HUGGINGFACE_MODEL",
    format: "huggingface"
  },
  cloudflare: {
    key: "CLOUDFLARE_API_TOKEN",
    model: "CLOUDFLARE_MODEL",
    format: "cloudflare"
  },
  pollinations: {
    key: "POLLINATIONS_API_KEY",
    model: "POLLINATIONS_MODEL",
    format: "pollinations"
  }
};

function getConfig(providerName, requestedModel) {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }

  const apiKey = process.env[provider.key];
  const configuredModel = process.env[provider.model];
  const model = requestedModel || configuredModel;

  if (!configured(apiKey)) {
    throw new Error(`Missing API key for ${providerName}`);
  }

  if (!configured(model)) {
    throw new Error(`Missing model ID for ${providerName}`);
  }

  // Known models are documented in the catalog. Unknown models remain
  // selectable so newly released provider models do not require a code deploy.
  const catalog = MODEL_CATALOG[providerName];
  const known = isKnownModel(providerName, model);

  const baseUrl = provider.base
    ? process.env[provider.base] || provider.defaultBase
    : null;

  return { ...provider, apiKey, model, baseUrl, known, capabilities: catalog?.capabilities || [] };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `Provider request failed (${response.status})`);
    error.status = response.status;
    error.retryable = TRANSIENT_STATUS.has(response.status) || response.status >= 500;
    throw error;
  }
  return data;
}

async function callOpenAICompatible(config, messages) {
  const response = await fetch(
    `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages
      })
    }
  );

  const data = await readResponse(response);
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(config, messages) {
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content ?? "") }]
    }));

  const systemInstruction = messages.find(
    (message) => message.role === "system"
  );

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(config.model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": config.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } }
        : {}),
      contents
    })
  });

  const data = await readResponse(response);
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("") ?? "";
}

async function callHuggingFace(config, messages) {
  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages
      })
    }
  );

  const data = await readResponse(response);
  return data.choices?.[0]?.message?.content ?? "";
}

async function callCloudflare(config, messages) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId || accountId.startsWith("your_")) {
    throw new Error("Missing Cloudflare account ID");
  }

  const url =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${encodeURIComponent(accountId)}/ai/run/` +
    `${encodeURIComponent(config.model)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messages })
  });

  const data = await readResponse(response);
  return data.result?.response ??
    data.result?.output_text ??
    JSON.stringify(data.result ?? data);
}

async function callPollinations(config, messages) {
  const response = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages
    })
  });

  const data = await readResponse(response);
  return data.choices?.[0]?.message?.content ?? "";
}

async function execute(config, messages) {
  switch (config.format) {
    case "openai":
      return callOpenAICompatible(config, messages);
    case "gemini":
      return callGemini(config, messages);
    case "huggingface":
      return callHuggingFace(config, messages);
    case "cloudflare":
      return callCloudflare(config, messages);
    case "pollinations":
      return callPollinations(config, messages);
    default:
      throw new Error("Provider implementation is not available");
  }
}

function resolveCandidates({ provider = "auto", model } = {}) {
  if (provider !== "auto") return [{ provider, model }];
  return routerOrder()
    .filter((name) => configured(process.env[providers[name].key]) && configured(model || process.env[providers[name].model]))
    .map((name) => ({ provider: name, model }));
}

export async function runModelDetailed({ provider = "auto", model, messages } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("Messages are required");
  const candidates = resolveCandidates({ provider, model });
  if (!candidates.length) throw new Error("No configured AI provider is available.");
  const failures = [];
  for (const candidate of candidates) {
    try {
      const config = getConfig(candidate.provider, candidate.model);
      const started = Date.now();
      const answer = await execute(config, messages);
      if (!String(answer).trim()) throw new Error("Provider returned an empty response.");
      return { answer, provider: candidate.provider, model: config.model, latencyMs: Date.now() - started, attempts: failures.length + 1, fallbackUsed: failures.length > 0, failures };
    } catch (error) {
      failures.push({ provider: candidate.provider, model: candidate.model || null, status: error.status || null, retryable: Boolean(error.retryable), message: error.message });
      if (provider !== "auto") break;
    }
  }
  const error = new Error("All configured AI providers failed.");
  error.failures = failures;
  throw error;
}

export async function runModel(args) {
  return (await runModelDetailed(args)).answer;
}

export function getAvailableProviders() {
  return Object.entries(providers)
    .filter(([name, provider]) => {
      const key = process.env[provider.key];
      const model = process.env[provider.model];
      return Boolean(
        key && model &&
        !key.startsWith("your_") &&
        !model.startsWith("your_")
      );
    })
    .map(([name, provider]) => ({
      id: name,
      model: process.env[provider.model],
      knownModel: isKnownModel(name, process.env[provider.model]),
      capabilities: MODEL_CATALOG[name]?.capabilities || []
    }));
}

export function getAvailableModels() {
  return getModelCatalog().map((entry) => ({
    ...entry,
    configuredModel: process.env[providers[entry.provider]?.model] || null,
    configured: Boolean(
      process.env[providers[entry.provider]?.key] &&
      !process.env[providers[entry.provider]?.key]?.startsWith("your_")
    )
  }));
}


export function getRouterConfig() {
  return {
    mode: "automatic-failover",
    order: routerOrder(),
    configuredProviders: getAvailableProviders().map((provider) => provider.id)
  };
}
