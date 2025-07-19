// AI設定管理のユーティリティクラス

import { type AIProviderConfig, type AISettingType } from "@shared/ai-types";
import { DEFAULT_VALUES } from "@shared/ai-constants";
import { AIConfigValidator } from "@shared/ai-validation";

export class AISettingsManager {
  /**
   * 設定タイプに応じたキープレフィックスを取得
   */
  static getKeyPrefix(type: AISettingType): string {
    switch (type) {
      case 'basic':
        return 'AI_';
      case 'realtime':
        return 'REALTIME_';
      case 'trial':
        return '';
      default:
        throw new Error(`Unknown setting type: ${type}`);
    }
  }

  /**
   * 設定タイプに応じたAPIエンドポイントを取得
   */
  static getApiEndpoint(type: AISettingType): string {
    switch (type) {
      case 'basic':
      case 'realtime':
        return '/api/settings';
      case 'trial':
        return '/api/session-ai-settings';
      default:
        throw new Error(`Unknown setting type: ${type}`);
    }
  }

  /**
   * 設定タイプに応じた説明を取得
   */
  static getDescription(type: AISettingType, key: string): string {
    const descriptions = {
      basic: {
        provider: '基本AIサービスプロバイダー (openai, ollama, gemini, groq, openrouter)',
        groqModel: '基本AI設定用Groqモデル',
        geminiModel: '基本AI設定用Geminiモデル',
        openrouterModel: '基本AI設定用OpenRouterモデル',
      },
      realtime: {
        provider: 'リアルタイム分析用AIプロバイダー (openai, ollama, gemini, groq, openrouter)',
        groqModel: 'リアルタイム分析用Groqモデル',
        geminiModel: 'リアルタイム分析用Geminiモデル',
        openrouterModel: 'リアルタイム分析用OpenRouterモデル',
      },
      trial: {
        provider: 'お試し用AIプロバイダー',
        groqModel: 'お試し用Groqモデル',
        geminiModel: 'お試し用Geminiモデル',
        openrouterModel: 'お試し用OpenRouterモデル',
      },
    };

    return descriptions[type][key as keyof typeof descriptions[typeof type]] || '';
  }

  /**
   * デフォルト設定を取得
   */
  static getDefaultConfig(): AIProviderConfig {
    return {
      provider: DEFAULT_VALUES.AI_PROVIDER,
      groqModel: DEFAULT_VALUES.GROQ_MODEL,
      geminiModel: DEFAULT_VALUES.GEMINI_MODEL,
      openrouterModel: DEFAULT_VALUES.OPENROUTER_MODEL,
    };
  }

  /**
   * システム設定を更新（基本AI設定・リアルタイム分析設定用）
   */
  static async updateSystemSettings(
    type: 'basic' | 'realtime',
    config: AIProviderConfig
  ): Promise<void> {
    const prefix = this.getKeyPrefix(type);

    // プロバイダーを更新
    await this.updateSystemSetting(
      `${prefix}PROVIDER`,
      config.provider,
      this.getDescription(type, 'provider')
    );

    // Groqモデルを更新
    if (config.provider === 'groq' && config.groqModel) {
      await this.updateSystemSetting(
        `${prefix}GROQ_MODEL`,
        config.groqModel,
        this.getDescription(type, 'groqModel')
      );
    }

    // Geminiモデルを更新
    if (config.provider === 'gemini' && config.geminiModel) {
      await this.updateSystemSetting(
        `${prefix}GEMINI_MODEL`,
        config.geminiModel,
        this.getDescription(type, 'geminiModel')
      );
    }

    // OpenRouterモデルを更新
    if (config.provider === 'openrouter' && config.openrouterModel) {
      await this.updateSystemSetting(
        `${prefix}OPENROUTER_MODEL`,
        config.openrouterModel,
        this.getDescription(type, 'openrouterModel')
      );
    }
  }

  /**
   * セッション設定を更新（お試し設定用）
   */
  static async updateSessionSettings(config: AIProviderConfig): Promise<void> {
    const body: any = { realtimeProvider: config.provider };

    if (config.provider === 'groq' && config.groqModel) {
      body.groqModel = config.groqModel;
    }
    if (config.provider === 'gemini' && config.geminiModel) {
      body.geminiModel = config.geminiModel;
    }
    if (config.provider === 'openrouter' && config.openrouterModel) {
      body.openrouterModel = config.openrouterModel;
    }

    const response = await fetch('/api/session-ai-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // JSON解析に失敗した場合はそのまま
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * 設定をクリア（お試し設定用）
   */
  static async clearSessionSettings(): Promise<void> {
    const response = await fetch('/api/session-ai-settings', {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('セッション設定のクリアに失敗しました');
    }
  }

  /**
   * 設定の検証
   */
  static validateConfig(config: AIProviderConfig): { isValid: boolean; error?: string } {
    return AIConfigValidator.validateProviderSettings(config);
  }

  /**
   * システム設定の個別更新（内部メソッド）
   */
  private static async updateSystemSetting(
    key: string,
    value: string,
    description?: string
  ): Promise<void> {
    const response = await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ value, description }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // JSON解析に失敗した場合はそのまま
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * 設定値からAIProviderConfigを構築
   */
  static buildConfigFromSettings(
    provider: string,
    groqModel?: string,
    geminiModel?: string,
    openrouterModel?: string
  ): AIProviderConfig {
    const defaults = this.getDefaultConfig();
    
    return {
      provider: provider as any || defaults.provider,
      groqModel: groqModel as any || defaults.groqModel,
      geminiModel: geminiModel as any || defaults.geminiModel,
      openrouterModel: openrouterModel as any || defaults.openrouterModel,
    };
  }

  /**
   * AIProviderConfigから個別値を抽出
   */
  static extractConfigValues(config: AIProviderConfig) {
    return {
      provider: config.provider,
      groqModel: config.groqModel,
      geminiModel: config.geminiModel,
      openrouterModel: config.openrouterModel,
    };
  }
}