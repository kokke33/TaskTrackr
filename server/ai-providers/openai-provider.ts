import OpenAI from 'openai';
import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

export class OpenAIService extends BaseProvider {
  private client: OpenAI;
  private model: string;
  readonly supportsStreaming: boolean = true;

  constructor(model?: string) {
    super('openai');
    this.client = new OpenAI({
      apiKey: aiConfig.openai.apiKey,
    });
    this.model = model || aiConfig.openai.model;
  }

  private getTokensParamName(): 'max_tokens' | 'max_completion_tokens' {
    // GPT-4o, GPT-5シリーズは max_completion_tokens を使用
    if (this.model.includes('gpt-4o') || this.model.includes('gpt-5')) {
      return 'max_completion_tokens';
    }
    // その他のモデル（GPT-3.5など）は max_tokens を使用
    return 'max_tokens';
  }

  private supportsCustomTemperature(): boolean {
    // GPT-5シリーズは temperature のカスタム値をサポートしない（デフォルト値1のみ）
    if (this.model.includes('gpt-5')) {
      return false;
    }
    // その他のモデルは temperature のカスタム値をサポート
    return true;
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const headers = {
      'Authorization': `Bearer ${aiConfig.openai.apiKey}`,
      'Content-Type': 'application/json',
    };

    const tokensParam = this.getTokensParamName();
    const supportsTemperature = this.supportsCustomTemperature();
    
    const requestBody: any = {
      model: this.model,
      messages: messages,
      [tokensParam]: aiConfig.openai.maxTokens,
    };
    
    if (supportsTemperature) {
      requestBody.temperature = aiConfig.openai.temperature;
    }

    const requestData = {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: this.maskSensitiveHeaders(headers),
      body: requestBody
    };

    aiLogger.logRequest('openai', 'generateResponse', requestId, requestData, userId, metadata);

    try {
      const apiParams: any = {
        model: this.model,
        messages: messages,
        [tokensParam]: aiConfig.openai.maxTokens,
      };

      if (supportsTemperature) {
        apiParams.temperature = aiConfig.openai.temperature;
      }

      const response = await this.client.chat.completions.create(apiParams);

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
        { ...metadata, duration, model: this.model });
      
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async* generateStreamResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): AsyncIterable<string> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const tokensParam = this.getTokensParamName();
    const supportsTemperature = this.supportsCustomTemperature();

    const streamBody: any = {
      model: this.model,
      messages: messages,
      [tokensParam]: aiConfig.openai.maxTokens,
      stream: true,
    };

    if (supportsTemperature) {
      streamBody.temperature = aiConfig.openai.temperature;
    }

    const requestData = {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: this.maskSensitiveHeaders({
        'Authorization': `Bearer ${aiConfig.openai.apiKey}`,
        'Content-Type': 'application/json',
      }),
      body: streamBody
    };

    aiLogger.logRequest('openai', 'generateStreamResponse', requestId, requestData, userId, metadata);

    try {
      const streamParams: any = {
        model: this.model,
        messages: messages,
        stream: true,
        [tokensParam]: aiConfig.openai.maxTokens,
      };

      if (supportsTemperature) {
        streamParams.temperature = aiConfig.openai.temperature;
      }

      const stream = await this.client.chat.completions.create(streamParams) as any;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      const duration = Date.now() - startTime;
      aiLogger.logDebug('openai', 'generateStreamResponse', requestId, 'OpenAI stream response completed successfully', 
        { duration }, userId);
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('openai', 'generateStreamResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model });
      
      throw new Error(`OpenAI streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}