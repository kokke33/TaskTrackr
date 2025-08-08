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
export { analyzeTextStream } from './use-cases/analyze-text-stream.usecase.js';
export { generateAdminConfirmationEmail } from './use-cases/generate-admin-confirmation-email.usecase.js';
export type { AIMessage, AIResponse, IAiProvider };

// ストリーミング応答を生成する新しい関数
export async function generateResponseStream(
  messages: AIMessage[],
  userId?: string,
  metadata?: Record<string, any>
): Promise<AsyncIterable<string>> {
  const aiService = await getAIService();
  if (aiService.supportsStreaming && aiService.generateStreamResponse) {
    return aiService.generateStreamResponse(messages, userId, metadata);
  } else {
    // ストリーミングがサポートされていない場合、通常の応答を返す
    const response = await aiService.generateResponse(messages, userId, metadata);
    return (async function* () { yield response.content; })();
  }
}

function createAIServiceWithConfig(config: typeof aiConfig): IAiProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIService(config.openai.model);
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

export function getAIServiceForProvider(provider: AIProvider, groqModel?: string, geminiModel?: string, openrouterModel?: string, openaiModel?: string): IAiProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIService(openaiModel);
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
