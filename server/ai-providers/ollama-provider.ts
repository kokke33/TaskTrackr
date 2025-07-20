import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

export class OllamaService extends BaseProvider {
  private baseUrl: string;
  private model: string;

  constructor() {
    super('ollama');
    this.baseUrl = aiConfig.ollama.baseUrl;
    this.model = aiConfig.ollama.model;
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const prompt = this.messagesToPrompt(messages);
    const endpoint = `${this.baseUrl}api/generate`;
    
    const requestData = {
      endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: aiConfig.ollama.temperature,
          num_predict: aiConfig.ollama.maxTokens,
        },
      }
    };

    aiLogger.logRequest('ollama', 'generateResponse', requestId, requestData, userId, metadata);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData.body),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.response) {
        throw new Error('No response content from Ollama');
      }

      const cleanedResponse = this.cleanThinkTags(data.response);

      const responseData = {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: {
          model: data.model,
          content: cleanedResponse,
          done: data.done,
          eval_count: data.eval_count,
          prompt_eval_count: data.prompt_eval_count,
          total_duration: data.total_duration,
        },
        duration,
      };

      aiLogger.logResponse('ollama', 'generateResponse', requestId, responseData, userId, metadata);

      const result: AIResponse = {
        content: cleanedResponse,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        requestId,
        provider: 'ollama',
        duration,
      };

      aiLogger.logDebug('ollama', 'generateResponse', requestId, 'Ollama response processed successfully', 
        { tokens: result.usage?.totalTokens, duration, model: this.model }, userId);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('ollama', 'generateResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model, baseUrl: this.baseUrl });
      
      throw new Error(`Ollama API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private messagesToPrompt(messages: AIMessage[]): string {
    return messages
      .map(msg => {
        switch (msg.role) {
          case 'system':
            return `<|system|>\n${msg.content}\n`;
          case 'user':
            return `<|user|>\n${msg.content}\n`;
          case 'assistant':
            return `<|assistant|>\n${msg.content}\n`;
          default:
            return `${msg.content}\n`;
        }
      })
      .join('') + '<|assistant|>\n';
  }
}