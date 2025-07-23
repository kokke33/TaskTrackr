import Groq from 'groq-sdk';
import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

class GroqKeyManager {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private keyLimits: Map<string, {
    remainingRequests: number;
    remainingTokens: number;
    resetTime: Date;
    isBlocked: boolean;
  }> = new Map();

  constructor(keys: string[]) {
    this.apiKeys = keys;
    this.apiKeys.forEach(key => {
      this.keyLimits.set(key, {
        remainingRequests: 1000,
        remainingTokens: 100000,
        resetTime: new Date(),
        isBlocked: false
      });
    });
  }

  getCurrentKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  rotateToNextKey(): string {
    const originalIndex = this.currentKeyIndex;
    let attempts = 0;
    
    do {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
      
      const currentKey = this.apiKeys[this.currentKeyIndex];
      const keyStatus = this.keyLimits.get(currentKey);
      
      if (keyStatus && !keyStatus.isBlocked && keyStatus.remainingRequests > 0) {
        return currentKey;
      }
      
      if (keyStatus && keyStatus.resetTime < new Date()) {
        keyStatus.isBlocked = false;
        keyStatus.remainingRequests = 1000;
        keyStatus.remainingTokens = 100000;
        return currentKey;
      }
      
    } while (attempts < this.apiKeys.length);
    
    this.currentKeyIndex = originalIndex;
    return this.apiKeys[this.currentKeyIndex];
  }

  updateKeyLimits(key: string, headers: Record<string, any>): void {
    const keyStatus = this.keyLimits.get(key);
    if (!keyStatus) return;

    const remainingRequests = parseInt(headers['x-ratelimit-remaining-requests'] || '1000');
    const remainingTokens = parseInt(headers['x-ratelimit-remaining-tokens'] || '100000');
    const resetTime = headers['x-ratelimit-reset-requests'] ? 
      new Date(headers['x-ratelimit-reset-requests']) : 
      new Date(Date.now() + 60000);

    keyStatus.remainingRequests = remainingRequests;
    keyStatus.remainingTokens = remainingTokens;
    keyStatus.resetTime = resetTime;
    keyStatus.isBlocked = remainingRequests <= 0 || remainingTokens <= 0;
  }

  markKeyAsBlocked(key: string, resetTime?: Date): void {
    const keyStatus = this.keyLimits.get(key);
    if (keyStatus) {
      keyStatus.isBlocked = true;
      keyStatus.resetTime = resetTime || new Date(Date.now() + 60000);
    }
  }

  getKeyStatus(): Array<{key: string, status: any}> {
    return this.apiKeys.map(key => ({
      key: key.substring(0, 10) + '...',
      status: this.keyLimits.get(key)
    }));
  }
}

export class GroqService extends BaseProvider {
  private client: Groq;
  private keyManager: GroqKeyManager;
  private model: string;
  readonly supportsStreaming: boolean = true;

  constructor(model?: string) {
    super('groq');
    
    const apiKeys = aiConfig.groq.apiKeys.length > 0 ? aiConfig.groq.apiKeys : [aiConfig.groq.apiKey];
    this.keyManager = new GroqKeyManager(apiKeys);
    
    this.model = model || aiConfig.groq.model;
    
    this.client = new Groq({
      apiKey: this.keyManager.getCurrentKey(),
    });
  }

  private getMaxTokensForModel(model: string): number {
    const modelLimits: Record<string, number> = {
      'meta-llama/llama-4-scout-17b-16e-instruct': 8192,
      'qwen/qwen3-32b': 32768,
      'default': Math.min(aiConfig.groq.maxTokens, 8192)
    };
    
    return modelLimits[model] || modelLimits['default'];
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const currentKey = this.keyManager.getCurrentKey();
      
      const headers = {
        'Authorization': `Bearer ${currentKey}`,
        'Content-Type': 'application/json',
      };

      const maxTokens = this.getMaxTokensForModel(this.model);
      
      const requestData = {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        method: 'POST',
        headers: this.maskSensitiveHeaders(headers),
        body: {
          model: this.model,
          messages: messages,
          max_tokens: maxTokens,
          temperature: aiConfig.groq.temperature,
        }
      };

      aiLogger.logRequest('groq', 'generateResponse', requestId, requestData, userId, metadata);

      try {
        this.client = new Groq({
          apiKey: currentKey,
        });

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: messages,
          max_tokens: maxTokens,
          temperature: aiConfig.groq.temperature,
        });

        const duration = Date.now() - startTime;
        const choice = response.choices[0];
        
        if (!choice?.message?.content) {
          throw new Error('No response content from Groq');
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

        aiLogger.logResponse('groq', 'generateResponse', requestId, responseData, userId, metadata);

        const result: AIResponse = {
          content: choice.message.content,
          usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          } : undefined,
          requestId,
          provider: 'groq',
          duration,
        };

        aiLogger.logDebug('groq', 'generateResponse', requestId, 'Groq response processed successfully', 
          { tokens: result.usage?.totalTokens, duration, maxTokens, model: this.model, keyUsed: currentKey.substring(0, 10) + '...' }, userId);

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        if (error?.status === 429 || error?.message?.includes('rate limit') || error?.message?.includes('429')) {
          aiLogger.logDebug('groq', 'generateResponse', requestId, 'Rate limit hit, attempting key rotation', 
            { attempt: attempt + 1, maxRetries, currentKey: currentKey.substring(0, 10) + '...' }, userId);
          
          this.keyManager.markKeyAsBlocked(currentKey);
          
          const nextKey = this.keyManager.rotateToNextKey();
          
          if (nextKey === currentKey) {
            aiLogger.logDebug('groq', 'generateResponse', requestId, 'No available keys, waiting before retry', 
              { attempt: attempt + 1, maxRetries }, userId);
            
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
          } else {
            aiLogger.logDebug('groq', 'generateResponse', requestId, 'Rotated to next key', 
              { nextKey: nextKey.substring(0, 10) + '...' }, userId);
            
            if (attempt < maxRetries - 1) {
              continue;
            }
          }
        }
        
        if (attempt === maxRetries - 1) {
          aiLogger.logError('groq', 'generateResponse', requestId, error as Error, userId, 
            { ...metadata, duration, model: this.model, attempt: attempt + 1 });
          
          throw new Error(`Groq API error after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  async* generateStreamResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): AsyncIterable<string> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const maxRetries = 3;

    const requestData = {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      method: 'POST',
      headers: this.maskSensitiveHeaders({
        'Authorization': `Bearer ${this.keyManager.getCurrentKey()}`,
        'Content-Type': 'application/json',
      }),
      body: {
        model: this.model,
        messages: messages,
        temperature: aiConfig.groq.temperature,
        stream: true,
      }
    };

    aiLogger.logRequest('groq', 'generateStreamResponse', requestId, requestData, userId, metadata);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const currentKey = this.keyManager.getCurrentKey();

      try {
        this.client = new Groq({
          apiKey: currentKey,
        });

        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages: messages,
          temperature: aiConfig.groq.temperature,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }

        const duration = Date.now() - startTime;
        aiLogger.logDebug('groq', 'generateStreamResponse', requestId, 'Groq stream response completed successfully', 
          { duration, model: this.model, keyUsed: currentKey.substring(0, 10) + '...' }, userId);
        return;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        if (error?.status === 429 || error?.message?.includes('rate limit') || error?.message?.includes('429')) {
          aiLogger.logDebug('groq', 'generateStreamResponse', requestId, 'Rate limit hit, attempting key rotation', 
            { attempt: attempt + 1, maxRetries, currentKey: currentKey.substring(0, 10) + '...' }, userId);
          
          this.keyManager.markKeyAsBlocked(currentKey);
          
          const nextKey = this.keyManager.rotateToNextKey();
          
          if (nextKey === currentKey) {
            aiLogger.logDebug('groq', 'generateStreamResponse', requestId, 'No available keys, waiting before retry', 
              { attempt: attempt + 1, maxRetries }, userId);
            
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
          } else {
            aiLogger.logDebug('groq', 'generateStreamResponse', requestId, 'Rotated to next key', 
              { nextKey: nextKey.substring(0, 10) + '...' }, userId);
            
            if (attempt < maxRetries - 1) {
              continue;
            }
          }
        }
        
        if (attempt === maxRetries - 1) {
          aiLogger.logError('groq', 'generateStreamResponse', requestId, error as Error, userId, 
            { ...metadata, duration, model: this.model, attempt: attempt + 1 });
          
          throw new Error(`Groq streaming API error after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}