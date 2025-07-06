import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AIConfig {
  provider: 'openai' | 'ollama' | 'gemini';
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
}

export const aiConfig: AIConfig = {
  provider: (process.env.AI_PROVIDER as 'openai' | 'ollama' | 'gemini') || 'openai',
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
  
  console.log(`AI Provider: ${aiConfig.provider}`);
  if (aiConfig.provider === 'openai') {
    console.log(`OpenAI Model: ${aiConfig.openai.model}`);
  } else if (aiConfig.provider === 'ollama') {
    console.log(`Ollama Model: ${aiConfig.ollama.model} at ${aiConfig.ollama.baseUrl}`);
  } else if (aiConfig.provider === 'gemini') {
    console.log(`Gemini Model: ${aiConfig.gemini.model}`);
  }
}
