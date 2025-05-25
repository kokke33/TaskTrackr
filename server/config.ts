import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AIConfig {
  provider: 'openai' | 'ollama';
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
}

export const aiConfig: AIConfig = {
  provider: (process.env.AI_PROVIDER as 'openai' | 'ollama') || 'openai',
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
};

// Validation function
export function validateAIConfig(): void {
  if (aiConfig.provider === 'openai' && !aiConfig.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
  }
  
  if (aiConfig.provider === 'ollama' && !aiConfig.ollama.baseUrl) {
    throw new Error('OLLAMA_BASE_URL is required when using Ollama provider');
  }
  
  console.log(`AI Provider: ${aiConfig.provider}`);
  if (aiConfig.provider === 'openai') {
    console.log(`OpenAI Model: ${aiConfig.openai.model}`);
  } else {
    console.log(`Ollama Model: ${aiConfig.ollama.model} at ${aiConfig.ollama.baseUrl}`);
  }
}
