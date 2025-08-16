import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

export class ClaudeService extends BaseProvider {
  private model: string;
  readonly supportsStreaming: boolean = true;

  constructor(model?: string) {
    super('claude');
    this.model = model || aiConfig.claude.model;
    console.log('[CLAUDE-DEBUG] Constructor - model param:', model, 'config model:', aiConfig.claude.model, 'final model:', this.model);
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const headers = {
      'x-api-key': aiConfig.claude.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };

    const claudeMessages = this.messagesToClaudeFormat(messages);
    const systemMessage = this.extractSystemMessage(messages);

    const requestBody: any = {
      model: this.model,
      max_tokens: aiConfig.claude.maxTokens,
      temperature: aiConfig.claude.temperature,
      messages: claudeMessages,
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    const requestData = {
      endpoint: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: this.maskSensitiveHeaders(headers),
      body: requestBody
    };

    aiLogger.logRequest('claude', 'generateResponse', requestId, requestData, userId, metadata);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        throw new Error('No response content from Claude');
      }

      // Claude APIは content 配列の中に text が含まれる
      const content = data.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('');

      if (!content) {
        throw new Error('No text content from Claude');
      }

      const responseData = {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: {
          id: data.id,
          model: data.model,
          content: content,
          usage: data.usage,
          stop_reason: data.stop_reason,
        },
        duration,
      };

      aiLogger.logResponse('claude', 'generateResponse', requestId, responseData, userId, metadata);

      const result: AIResponse = {
        content: content,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
        requestId,
        provider: 'claude',
        duration,
      };

      aiLogger.logDebug('claude', 'generateResponse', requestId, 'Claude response processed successfully', 
        { tokens: result.usage?.totalTokens, duration, model: this.model }, userId);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('claude', 'generateResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model });
      
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async* generateStreamResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): AsyncIterable<string> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const headers = {
      'x-api-key': aiConfig.claude.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };

    const claudeMessages = this.messagesToClaudeFormat(messages);
    const systemMessage = this.extractSystemMessage(messages);

    const requestBody: any = {
      model: this.model,
      max_tokens: aiConfig.claude.maxTokens,
      temperature: aiConfig.claude.temperature,
      messages: claudeMessages,
      stream: true,
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    const requestData = {
      endpoint: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: this.maskSensitiveHeaders(headers),
      body: requestBody
    };

    aiLogger.logRequest('claude', 'generateStreamResponse', requestId, requestData, userId, metadata);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                break;
              }
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  yield parsed.delta.text;
                }
              } catch (parseError) {
                // JSONパースエラーは無視（不完全なチャンクの可能性）
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const duration = Date.now() - startTime;
      aiLogger.logDebug('claude', 'generateStreamResponse', requestId, 'Claude stream response completed successfully', 
        { duration, model: this.model }, userId);
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('claude', 'generateStreamResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model });
      
      throw new Error(`Claude streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private messagesToClaudeFormat(messages: AIMessage[]): any[] {
    // system メッセージを除外
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
  }

  private extractSystemMessage(messages: AIMessage[]): string | null {
    const systemMessages = messages.filter(msg => msg.role === 'system');
    if (systemMessages.length === 0) {
      return null;
    }
    return systemMessages.map(msg => msg.content).join('\n\n');
  }

  protected maskSensitiveHeaders(headers: Record<string, any>): Record<string, any> {
    const masked = super.maskSensitiveHeaders(headers);
    
    // Claude APIキーのマスキングパターンを追加
    for (const key of Object.keys(masked)) {
      if (key.toLowerCase().includes('x-api-key')) {
        if (typeof masked[key] === 'string') {
          masked[key] = masked[key].replace(/sk-ant-[a-zA-Z0-9\-_]{95}/g, 'sk-ant-***MASKED***');
        }
      }
    }
    
    return masked;
  }
}