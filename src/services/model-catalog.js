/**
 * BharatGPilot model catalog.
 *
 * This file describes selectable models/capabilities only.
 * API credentials belong in deployment environment variables, never here.
 */

export const MODEL_CATALOG = {
  openrouter: {
    env: "OPENROUTER_MODEL",
    models: [
      "openrouter/free",
      "nvidia/nemotron-3-ultra:free",
      "poolside/laguna-s-2.1:free",
      "nvidia/nemotron-3.5-lightning:free",
      "inclusionai/ling-3.0-flash-sante:free",
      "nvidia/nemotron-3-super:free",
      "thinking-machines/inkling:free",
      "cohere/north-mini-code:free",
      "thinking-machines/inkling-small:free",
      "poolside/laguna-xs-2.1:free",
      "apodex/apodex-1.1-mini:free"
    ],
    capabilities: ["chat", "coding", "reasoning"]
  },

  gemini: {
    env: "GEMINI_MODEL",
    models: [
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash-lite"
    ],
    capabilities: ["chat", "coding", "reasoning", "vision"]
  },

  groq: {
    env: "GROQ_MODEL",
    models: ["llama-3.1-70b-versatile"],
    capabilities: ["chat", "coding", "reasoning"]
  },

  mistral: {
    env: "MISTRAL_MODEL",
    models: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "codestral-latest",
      "ministral-8b-latest",
      "ministral-3b-latest",
      "pixtral-12b-latest",
      "mistral-embed",
      "mistral-moderation-latest",
      "open-mistral-7b",
      "open-mixtral-8x7b",
      "open-mixtral-8x22b"
    ],
    capabilities: ["chat", "coding", "vision", "embedding", "moderation"]
  },

  cloudflare: {
    env: "CLOUDFLARE_MODEL",
    models: [
      "@cf/meta/llama-3.2-3b-instruct",
      "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
      "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      "@cf/meta/llama-3.2-11b-vision-instruct",
      "@cf/cloudflare/clef-flash"
    ],
    capabilities: ["chat", "coding", "reasoning", "vision"]
  },

  huggingface: {
    env: "HUGGINGFACE_MODEL",
    models: [
      "mistralai/Mistral-7B-Instruct-v0.1",
      "Qwen/Qwen2.5-7B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "black-forest-labs/FLUX.1-schnell",
      "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
      "meta-llama/Llama-3.3-70B-Instruct",
      "google/gemma-2-9b-it"
    ],
    capabilities: ["chat", "coding", "reasoning", "image"]
  },

  nvidia: {
    env: "NVIDIA_MODEL",
    models: [
      "nvidia/glm-5-3",
      "nvidia/glm-5-3-flash",
      "nvidia/kimi-k3",
      "nvidia/nemotron-parse-2.0",
      "nvidia/riva-translate-4b-instruct-v2",
      "nvidia/ising-calibration-1.5-31b"
    ],
    capabilities: ["chat", "coding", "reasoning", "translation"]
  },

  pollinations: {
    env: "POLLINATIONS_MODEL",
    models: [
      "openai/gpt-5.4-nano",
      "pollinations/kimi",
      "pollinations/kimi-k2.6",
      "pollinations/gemini-search",
      "pollinations/deepseek",
      "pollinations/glm",
      "pollinations/claude-fast",
      "pollinations/claude-large",
      "flux"
    ],
    capabilities: ["chat", "reasoning", "search", "image"]
  }
};

export function getModelCatalog() {
  return Object.entries(MODEL_CATALOG).map(([provider, config]) => ({
    provider,
    env: config.env,
    models: config.models,
    capabilities: config.capabilities
  }));
}

export function isKnownModel(provider, model) {
  return Boolean(MODEL_CATALOG[provider]?.models.includes(model));
}
