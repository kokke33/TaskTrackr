import { type AIProvider } from '@shared/ai-constants';
import { IAiProvider, AIMessage, AIResponse } from './iai-provider';

export abstract class BaseProvider implements IAiProvider {
  readonly provider: AIProvider;
  readonly supportsStreaming: boolean = false;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  abstract generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse>;

  async* generateStreamResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): AsyncIterable<string> {
    // デフォルトでは非ストリーミング：一括で取得して一度に返す
    const response = await this.generateResponse(messages, userId, metadata);
    yield response.content;
  }

  cleanThinkTags(content: string): string {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    cleaned = cleaned.replace(/```markdown\s*\n([\s\S]*?)\n```/g, '$1');
    cleaned = cleaned.replace(/```\s*\n([\s\S]*?)\n```/g, '$1');
    return cleaned.trim();
  }

  protected maskSensitiveHeaders(headers: Record<string, any>): Record<string, any> {
    const masked = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'api-key', 'openai-api-key', 'gemini-api-key', 'groq-api-key'];
    
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        if (typeof masked[key] === 'string') {
          masked[key] = masked[key]
            .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***MASKED***')
            .replace(/gsk_[a-zA-Z0-9]{20,}/g, 'gsk_***MASKED***')
            .replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, 'AIzaSy***MASKED***')
            .replace(/sk-or-[a-zA-Z0-9]{20,}/g, 'sk-or-***MASKED***')
            .replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, 'Bearer ***MASKED***');
        }
      }
    }
    return masked;
  }
  
}