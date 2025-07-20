// AI設定の共有定数
// この定数を変更することで、サーバー・クライアント両方の設定が更新されます

// AIプロバイダー
export const AI_PROVIDERS = ["openai", "ollama", "gemini", "groq", "openrouter"] as const;
export type AIProvider = typeof AI_PROVIDERS[number];

// Groqモデル
export const GROQ_MODELS = ["qwen/qwen3-32b", "meta-llama/llama-4-scout-17b-16e-instruct"] as const;
export type GroqModel = typeof GROQ_MODELS[number];

// Geminiモデル
export const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"] as const;
export type GeminiModel = typeof GEMINI_MODELS[number];

// OpenRouterモデル
export const OPENROUTER_MODELS = [
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-sonnet-4",
  "google/gemini-2.0-flash-001",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro"
] as const;
export type OpenRouterModel = typeof OPENROUTER_MODELS[number];

// デフォルト値
export const DEFAULT_VALUES = {
  AI_PROVIDER: "gemini" as AIProvider,
  REALTIME_PROVIDER: "gemini" as AIProvider,
  GROQ_MODEL: "qwen/qwen3-32b" as GroqModel,
  GEMINI_MODEL: "gemini-2.5-flash" as GeminiModel,
  OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet" as OpenRouterModel,
} as const;

// UI表示用のプロバイダー選択肢（ラベル付き）
export const AI_PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "ollama", label: "Ollama (ローカル)" },
  { value: "gemini", label: "Google Gemini" },
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
] as const;

// UI表示用のGroqモデル選択肢（ラベル付き）
export const GROQ_MODEL_OPTIONS = [
  { value: "qwen/qwen3-32b", label: "Qwen3 32B (推奨)" },
  { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
] as const;

// UI表示用のGeminiモデル選択肢（ラベル付き）
export const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (推奨)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

// UI表示用のOpenRouterモデル選択肢（ラベル付き）
export const OPENROUTER_MODEL_OPTIONS = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (推奨)" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

// バリデーション用ヘルパー関数
export const isValidAIProvider = (value: string): value is AIProvider => {
  return AI_PROVIDERS.includes(value as AIProvider);
};

export const isValidGroqModel = (value: string): value is GroqModel => {
  return GROQ_MODELS.includes(value as GroqModel);
};

export const isValidGeminiModel = (value: string): value is GeminiModel => {
  return GEMINI_MODELS.includes(value as GeminiModel);
};

export const isValidOpenRouterModel = (value: string): value is OpenRouterModel => {
  return OPENROUTER_MODELS.includes(value as OpenRouterModel);
};