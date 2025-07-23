import { type AIProvider } from '@shared/ai-constants';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  requestId?: string;
  provider?: string;
  duration?: number;
}

export interface IAiProvider {
  readonly provider: AIProvider;
  generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse>;
  generateStreamResponse?(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): AsyncIterable<string>;
  supportsStreaming?: boolean;
  cleanThinkTags(content: string): string;
}