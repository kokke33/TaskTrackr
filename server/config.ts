import dotenv from 'dotenv';
import { storage } from './storage';

// Load environment variables
dotenv.config();

export interface AIConfig {
  provider: 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter' | 'claude';
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  ollama: {
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  gemini: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  groq: {
    apiKey: string;
    apiKeys: string[];
    model: string;
    maxTokens: number;
    temperature: number;
  };
  openrouter: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  claude: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
}

export const aiConfig: AIConfig = {
  provider: (process.env.AI_PROVIDER as 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter' | 'claude') || 'openai',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://172.20.100.49:11434/',
    model: process.env.OLLAMA_MODEL || 'llama2',
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    apiKeys: process.env.GROQ_API_KEYS ? 
      process.env.GROQ_API_KEYS.split(',').map(key => key.trim()).filter(key => key) : 
      (process.env.GROQ_API_KEY ? [process.env.GROQ_API_KEY] : []),
    model: process.env.GROQ_MODEL || 'llama3-70b-8192',
    maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.GROQ_TEMPERATURE || '0.7'),
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-0',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7'),
  },
};

// Validation function
export function validateAIConfig(): void {
  if (aiConfig.provider === 'openai' && !aiConfig.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
  }
  
  if (aiConfig.provider === 'ollama' && !aiConfig.ollama.baseUrl) {
    throw new Error('OLLAMA_BASE_URL is required when using Ollama provider');
  }
  
  if (aiConfig.provider === 'gemini' && !aiConfig.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is required when using Gemini provider');
  }
  
  if (aiConfig.provider === 'groq' && (!aiConfig.groq.apiKey && aiConfig.groq.apiKeys.length === 0)) {
    throw new Error('GROQ_API_KEY or GROQ_API_KEYS is required when using Groq provider');
  }
  
  if (aiConfig.provider === 'openrouter' && !aiConfig.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY is required when using OpenRouter provider');
  }
  
  if (aiConfig.provider === 'claude' && !aiConfig.claude.apiKey) {
    throw new Error('CLAUDE_API_KEY is required when using Claude provider');
  }
  
  console.log(`AI Provider: ${aiConfig.provider}`);
  if (aiConfig.provider === 'openai') {
    console.log(`OpenAI Model: ${aiConfig.openai.model}`);
  } else if (aiConfig.provider === 'ollama') {
    console.log(`Ollama Model: ${aiConfig.ollama.model} at ${aiConfig.ollama.baseUrl}`);
  } else if (aiConfig.provider === 'gemini') {
    console.log(`Gemini Model: ${aiConfig.gemini.model}`);
  } else if (aiConfig.provider === 'groq') {
    console.log(`Groq Model: ${aiConfig.groq.model}`);
  } else if (aiConfig.provider === 'openrouter') {
    console.log(`OpenRouter Model: ${aiConfig.openrouter.model}`);
  } else if (aiConfig.provider === 'claude') {
    console.log(`Claude Model: ${aiConfig.claude.model}`);
  }
}

// 動的にAI設定を読み込む関数
export async function getDynamicAIConfig(): Promise<AIConfig> {
  try {
    // データベースからAI_PROVIDERを取得
    const providerSetting = await storage.getSystemSetting('AI_PROVIDER');
    
    if (providerSetting && providerSetting.value) {
      const dynamicProvider = providerSetting.value as 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter' | 'claude';
      
      // 設定をコピーしてプロバイダーを更新
      const dynamicConfig: AIConfig = {
        ...aiConfig,
        provider: dynamicProvider,
      };
      
      // Groqの場合はモデルもデータベースから取得
      if (dynamicProvider === 'groq') {
        const groqModelSetting = await storage.getSystemSetting('AI_GROQ_MODEL');
        if (groqModelSetting && groqModelSetting.value) {
          dynamicConfig.groq.model = groqModelSetting.value;
        }
      }
      
      // Geminiの場合はモデルもデータベースから取得
      if (dynamicProvider === 'gemini') {
        const geminiModelSetting = await storage.getSystemSetting('AI_GEMINI_MODEL');
        if (geminiModelSetting && geminiModelSetting.value) {
          dynamicConfig.gemini.model = geminiModelSetting.value;
        }
      }
      
      // OpenAIの場合はモデルもデータベースから取得
      if (dynamicProvider === 'openai') {
        const openaiModelSetting = await storage.getSystemSetting('AI_OPENAI_MODEL');
        if (openaiModelSetting && openaiModelSetting.value) {
          dynamicConfig.openai.model = openaiModelSetting.value;
        }
      }
      
      // OpenRouterの場合はモデルもデータベースから取得
      if (dynamicProvider === 'openrouter') {
        const openrouterModelSetting = await storage.getSystemSetting('AI_OPENROUTER_MODEL');
        console.log('[AI-CONFIG-DEBUG] OpenRouter model from DB:', openrouterModelSetting?.value);
        if (openrouterModelSetting && openrouterModelSetting.value) {
          dynamicConfig.openrouter.model = openrouterModelSetting.value;
          console.log('[AI-CONFIG-DEBUG] OpenRouter model updated to:', dynamicConfig.openrouter.model);
        }
      }
      
      // Claudeの場合はモデルもデータベースから取得
      if (dynamicProvider === 'claude') {
        const claudeModelSetting = await storage.getSystemSetting('AI_CLAUDE_MODEL');
        console.log('[AI-CONFIG-DEBUG] Claude model from DB:', claudeModelSetting?.value);
        if (claudeModelSetting && claudeModelSetting.value) {
          dynamicConfig.claude.model = claudeModelSetting.value;
          console.log('[AI-CONFIG-DEBUG] Claude model updated to:', dynamicConfig.claude.model);
        }
      }
      
      console.log('[AI-CONFIG-DEBUG] Final dynamic config:', {
        provider: dynamicConfig.provider,
        openrouterModel: dynamicConfig.openrouter.model,
        claudeModel: dynamicConfig.claude.model
      });
      return dynamicConfig;
    }
    
    // データベースに設定がない場合は環境変数の設定を使用
    return aiConfig;
  } catch (error) {
    console.error('Error loading dynamic AI config:', error);
    // エラーの場合は環境変数の設定を使用
    return aiConfig;
  }
}

// AI設定を更新する関数
export async function updateAIProvider(provider: 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter' | 'claude'): Promise<void> {
  try {
    await storage.setSystemSetting('AI_PROVIDER', provider, 'AIサービスプロバイダー');
    console.log(`AI Provider updated to: ${provider}`);
  } catch (error) {
    console.error('Error updating AI provider:', error);
    throw error;
  }
}
