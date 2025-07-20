import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

export class OpenRouterService extends BaseProvider {
  private model: string;

  constructor(model?: string) {
    super('openrouter');
    this.model = model || aiConfig.openrouter.model;
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const headers = {
      'Authorization': `Bearer ${aiConfig.openrouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tasktrackr.local',
      'X-Title': 'TaskTrackr',
    };

    const requestData = {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: this.maskSensitiveHeaders(headers),
      body: {
        model: this.model,
        messages: messages,
        max_tokens: aiConfig.openrouter.maxTokens,
        temperature: aiConfig.openrouter.temperature,
      }
    };

    aiLogger.logRequest('openrouter', 'generateResponse', requestId, requestData, userId, metadata);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData.body),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice?.message?.content) {
        throw new Error('No response content from OpenRouter');
      }

      const responseData = {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: {
          id: data.id,
          model: data.model,
          content: choice.message.content,
          usage: data.usage,
          finish_reason: choice.finish_reason,
        },
        duration,
      };

      aiLogger.logResponse('openrouter', 'generateResponse', requestId, responseData, userId, metadata);

      const result: AIResponse = {
        content: choice.message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        requestId,
        provider: 'openrouter',
        duration,
      };

      aiLogger.logDebug('openrouter', 'generateResponse', requestId, 'OpenRouter response processed successfully', 
        { tokens: result.usage?.totalTokens, duration, model: this.model }, userId);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('openrouter', 'generateResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model });
      
      throw new Error(`OpenRouter API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}