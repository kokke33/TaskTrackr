// AI設定のバリデーション用ユーティリティ

import {
  AI_PROVIDERS,
  OPENAI_MODELS,
  GROQ_MODELS,
  GEMINI_MODELS,
  OPENROUTER_MODELS,
  isValidAIProvider,
  isValidOpenAIModel,
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

    // OpenAIモデルのバリデーション（カスタムモデル対応）
    if (config.provider === 'openai' && config.openaiModel) {
      if (!config.openaiModel.trim()) {
        return {
          isValid: false,
          error: 'OpenAIモデルが空です。有効なモデルIDを入力してください。'
        };
      }
    }

    // Groqモデルのバリデーション（カスタムモデル対応）
    if (config.provider === 'groq' && config.groqModel) {
      if (!config.groqModel.trim()) {
        return {
          isValid: false,
          error: 'Groqモデルが空です。有効なモデルIDを入力してください。'
        };
      }
    }

    // Geminiモデルのバリデーション（カスタムモデル対応）
    if (config.provider === 'gemini' && config.geminiModel) {
      if (!config.geminiModel.trim()) {
        return {
          isValid: false,
          error: 'Geminiモデルが空です。有効なモデルIDを入力してください。'
        };
      }
    }

    // OpenRouterモデルのバリデーション（カスタムモデル対応）
    if (config.provider === 'openrouter' && config.openrouterModel) {
      if (!config.openrouterModel.trim()) {
        return {
          isValid: false,
          error: 'OpenRouterモデルが空です。有効なモデルIDを入力してください。'
        };
      }
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

  static validateOpenAIModel(model: string): AIValidationResult {
    if (!isValidOpenAIModel(model)) {
      return {
        isValid: false,
        error: `無効なOpenAIモデルです。有効な値: ${OPENAI_MODELS.join(", ")}`
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