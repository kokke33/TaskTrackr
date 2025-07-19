// AI設定のバリデーション用ユーティリティ

import {
  AI_PROVIDERS,
  GROQ_MODELS,
  GEMINI_MODELS,
  OPENROUTER_MODELS,
  isValidAIProvider,
  isValidGroqModel,
  isValidGeminiModel,
  isValidOpenRouterModel,
} from './ai-constants';
import { type AIProviderConfig, type AIValidationResult } from './ai-types';

export class AIConfigValidator {
  /**
   * AIプロバイダー設定の総合バリデーション
   */
  static validateProviderSettings(config: AIProviderConfig): AIValidationResult {
    // プロバイダーのバリデーション
    if (!isValidAIProvider(config.provider)) {
      return {
        isValid: false,
        error: `無効なAIプロバイダーです。有効な値: ${AI_PROVIDERS.join(", ")}`
      };
    }

    // Groqモデルのバリデーション
    if (config.provider === 'groq' && config.groqModel && !isValidGroqModel(config.groqModel)) {
      return {
        isValid: false,
        error: `無効なGroqモデルです。有効な値: ${GROQ_MODELS.join(", ")}`
      };
    }

    // Geminiモデルのバリデーション
    if (config.provider === 'gemini' && config.geminiModel && !isValidGeminiModel(config.geminiModel)) {
      return {
        isValid: false,
        error: `無効なGeminiモデルです。有効な値: ${GEMINI_MODELS.join(", ")}`
      };
    }

    // OpenRouterモデルのバリデーション
    if (config.provider === 'openrouter' && config.openrouterModel && !isValidOpenRouterModel(config.openrouterModel)) {
      return {
        isValid: false,
        error: `無効なOpenRouterモデルです。有効な値: ${OPENROUTER_MODELS.join(", ")}`
      };
    }

    return { isValid: true };
  }

  /**
   * 個別項目のバリデーション
   */
  static validateProvider(provider: string): AIValidationResult {
    if (!isValidAIProvider(provider)) {
      return {
        isValid: false,
        error: `無効なAIプロバイダーです。有効な値: ${AI_PROVIDERS.join(", ")}`
      };
    }
    return { isValid: true };
  }

  static validateGroqModel(model: string): AIValidationResult {
    if (!isValidGroqModel(model)) {
      return {
        isValid: false,
        error: `無効なGroqモデルです。有効な値: ${GROQ_MODELS.join(", ")}`
      };
    }
    return { isValid: true };
  }

  static validateGeminiModel(model: string): AIValidationResult {
    if (!isValidGeminiModel(model)) {
      return {
        isValid: false,
        error: `無効なGeminiモデルです。有効な値: ${GEMINI_MODELS.join(", ")}`
      };
    }
    return { isValid: true };
  }

  static validateOpenRouterModel(model: string): AIValidationResult {
    if (!isValidOpenRouterModel(model)) {
      return {
        isValid: false,
        error: `無効なOpenRouterモデルです。有効な値: ${OPENROUTER_MODELS.join(", ")}`
      };
    }
    return { isValid: true };
  }
}