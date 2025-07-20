// AI設定の共有定数
// この定数を変更することで、サーバー・クライアント両方の設定が更新されます

// AIプロバイダー
export const AI_PROVIDERS = ["openai", "ollama", "gemini", "groq", "openrouter"] as const;
export type AIProvider = typeof AI_PROVIDERS[number];

// Groqモデル
export const GROQ_MODELS = [
  "qwen/qwen3-32b", 
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.3-70b-versatile",
  "moonshotai/kimi-k2-instruct",
  "deepseek-r1-distill-llama-70b"
] as const;
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
  GROQ_MODEL: "llama-3.3-70b-versatile" as GroqModel,
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
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (最新・推奨)" },
  { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill Llama 70B" },
  { value: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick 17B (128E)" },
  { value: "qwen/qwen3-32b", label: "Qwen3 32B" },
  { value: "moonshotai/kimi-k2-instruct", label: "Moonshot Kimi K2 Instruct" },
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

// 分析フィールドのキー
export const ANALYSIS_FIELD_TYPES = {
  weeklyTasks: "今週の作業内容",
  delayDetails: "遅延・問題点の詳細",
  issues: "課題・問題点",
  riskAnalysis: "新たなリスク（総合分析）",
  riskCountermeasures: "リスク対策",
  qualityAnalysis: "品質（総合分析）",
  changeDetails: "変更内容の詳細",
  nextWeekPlan: "来週の作業予定",
  supportRequests: "支援・判断の要望事項",
  resourceConcerns: "リソース懸念事項",
  customerConcerns: "顧客懸念事項",
  environmentConcerns: "環境懸念事項",
  costConcerns: "コスト懸念事項",
  knowledgeConcerns: "知識・スキル懸念事項",
  trainingConcerns: "教育懸念事項",
  urgentIssues: "緊急課題の詳細",
  businessOpportunities: "営業チャンス・顧客ニーズ",
} as const;

export type AnalysisFieldType = typeof ANALYSIS_FIELD_TYPES[keyof typeof ANALYSIS_FIELD_TYPES];

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