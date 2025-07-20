import { type AIProvider } from '@shared/ai-constants';
import { aiConfig, getDynamicAIConfig } from './config.js';
import { type AIMessage, type AIResponse, type IAiProvider } from './ai-providers/iai-provider.js';
import { OpenAIService } from './ai-providers/openai-provider.js';
import { OllamaService } from './ai-providers/ollama-provider.js';
import { GeminiService } from './ai-providers/gemini-provider.js';
import { GroqService } from './ai-providers/groq-provider.js';
import { OpenRouterService } from './ai-providers/openrouter-provider.js';

// Re-export use cases
export { generateSummary } from './use-cases/generate-summary.usecase.js';
export { analyzeTask } from './use-cases/analyze-task.usecase.js';
export { analyzeText } from './use-cases/analyze-text.usecase.js';
export type { AIMessage, AIResponse, IAiProvider };


function createAIServiceWithConfig(config: typeof aiConfig): IAiProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIService();
    case 'ollama':
      return new OllamaService();
    case 'gemini':
      return new GeminiService(config.gemini.model);
    case 'groq':
      return new GroqService(config.groq.model);
    case 'openrouter':
      return new OpenRouterService(config.openrouter.model);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

let aiService: IAiProvider | null = null;
let currentProvider: string | null = null;

export async function getAIService(): Promise<IAiProvider> {
  const dynamicConfig = await getDynamicAIConfig();
  
  if (!aiService || currentProvider !== dynamicConfig.provider) {
    aiService = createAIServiceWithConfig(dynamicConfig);
    currentProvider = dynamicConfig.provider;
  }
  
  return aiService;
}

export function getAIServiceForProvider(provider: AIProvider, groqModel?: string, geminiModel?: string, openrouterModel?: string): IAiProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIService();
    case 'ollama':
      return new OllamaService();
    case 'gemini':
      return new GeminiService(geminiModel);
    case 'groq':
      return new GroqService(groqModel);
    case 'openrouter':
      return new OpenRouterService(openrouterModel);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
