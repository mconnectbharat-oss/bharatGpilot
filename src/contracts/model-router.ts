/**
 * Shared TypeScript contracts for BharatGPilot's model router.
 *
 * This file is type-only scaffolding for the incremental migration. It does
 * not change the legacy JavaScript runtime until a migrated module imports it.
 */

export type KnownProvider =
  | "openrouter"
  | "gemini"
  | "groq"
  | "cerebras"
  | "mistral"
  | "nvidia"
  | "cloudflare"
  | "huggingface"
  | "pollinations";

export type ProviderSelection = KnownProvider | "auto";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelRequest {
  provider?: ProviderSelection;
  model?: string;
  messages: ChatMessage[];
}

export interface ProviderFailure {
  provider: KnownProvider;
  message: string;
  status?: number;
  retryable: boolean;
}

export interface DetailedModelResult {
  answer: string;
  provider: KnownProvider;
  model: string;
  fallbackUsed: boolean;
  attempts: number;
  failures: ProviderFailure[];
}

export interface RouterConfiguration {
  order: KnownProvider[];
  configuredProviders: KnownProvider[];
}

export interface ProviderModel {
  id: string;
  provider: KnownProvider;
  capabilities: string[];
  /** Availability is a runtime observation, not a guarantee of free usage. */
  configured: boolean;
}
