// AI設定関連の共通型定義

import { type AIProvider, type OpenAIModel, type GroqModel, type GeminiModel, type OpenRouterModel } from './ai-constants';

export interface AIProviderConfig {
  provider: AIProvider;
  openaiModel?: OpenAIModel;
  groqModel?: GroqModel;
  geminiModel?: GeminiModel;
  openrouterModel?: OpenRouterModel;
}

export type AISettingType = 'basic' | 'realtime' | 'trial';

export interface AISettingEndpoints {
  basic: {
    provider: 'AI_PROVIDER';
    openaiModel: 'AI_OPENAI_MODEL';
    groqModel: 'AI_GROQ_MODEL';
    geminiModel: 'AI_GEMINI_MODEL';
    openrouterModel: 'AI_OPENROUTER_MODEL';
  };
  realtime: {
    provider: 'REALTIME_PROVIDER';
    openaiModel: 'REALTIME_OPENAI_MODEL';
    groqModel: 'REALTIME_GROQ_MODEL';
    geminiModel: 'REALTIME_GEMINI_MODEL';
    openrouterModel: 'REALTIME_OPENROUTER_MODEL';
  };
}

export interface AIValidationResult {
  isValid: boolean;
  error?: string;
}