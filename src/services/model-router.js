
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

function getConfig(providerName) {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }

  const apiKey = process.env[provider.key];
  const model = process.env[provider.model];

  if (!apiKey || apiKey.startsWith("your_")) {
    throw new Error(`Missing API key for ${providerName}`);
  }

  if (!model || model.startsWith("your_")) {
    throw new Error(`Missing model ID for ${providerName}`);
  }

  const baseUrl = provider.base
    ? process.env[provider.base] || provider.defaultBase
    : null;

  return { ...provider, apiKey, model, baseUrl };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Provider request failed (${response.status})`;
    throw new Error(message);
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
  const prompt = messages
    .map((message) => `${message.role}: ${message.content ?? ""}`)
    .join("\n");

  const response = await fetch(
    `https://router.huggingface.co/v1/chat/completions`,
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

export async function runModel({ provider, messages }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages are required");
  }

  const config = getConfig(provider);

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
      model: process.env[provider.model]
    }));
}
