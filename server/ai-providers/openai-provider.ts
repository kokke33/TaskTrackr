import OpenAI from 'openai';
import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

export class OpenAIService extends BaseProvider {
  private client: OpenAI;

  constructor() {
    super('openai');
    this.client = new OpenAI({
      apiKey: aiConfig.openai.apiKey,
    });
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const headers = {
      'Authorization': `Bearer ${aiConfig.openai.apiKey}`,
      'Content-Type': 'application/json',
    };

    const requestData = {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: this.maskSensitiveHeaders(headers),
      body: {
        model: aiConfig.openai.model,
        messages: messages,
        max_tokens: aiConfig.openai.maxTokens,
        temperature: aiConfig.openai.temperature,
      }
    };

    aiLogger.logRequest('openai', 'generateResponse', requestId, requestData, userId, metadata);

    try {
      const response = await this.client.chat.completions.create({
        model: aiConfig.openai.model,
        messages: messages,
        max_tokens: aiConfig.openai.maxTokens,
        temperature: aiConfig.openai.temperature,
      });

      const duration = Date.now() - startTime;
      const choice = response.choices[0];
      
      if (!choice?.message?.content) {
        throw new Error('No response content from OpenAI');
      }

      const responseData = {
        status: 200,
        headers: {},
        body: {
          id: response.id,
          model: response.model,
          content: choice.message.content,
          usage: response.usage,
          finish_reason: choice.finish_reason,
        },
        duration,
      };

      aiLogger.logResponse('openai', 'generateResponse', requestId, responseData, userId, metadata);

      const result: AIResponse = {
        content: choice.message.content,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        requestId,
        provider: 'openai',
        duration,
      };

      aiLogger.logDebug('openai', 'generateResponse', requestId, 'OpenAI response processed successfully', 
        { tokens: result.usage?.totalTokens, duration }, userId);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('openai', 'generateResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: aiConfig.openai.model });
      
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}