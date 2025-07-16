import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { aiConfig, getDynamicAIConfig } from './config.js';
import { aiLogger, generateRequestId } from './ai-logger.js';

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

// Abstract AI service interface
export abstract class AIService {
  protected readonly provider: 'openai' | 'ollama' | 'gemini' | 'groq';

  constructor(provider: 'openai' | 'ollama' | 'gemini' | 'groq') {
    this.provider = provider;
  }

  abstract generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse>;
  
  protected cleanThinkTags(content: string): string {
    // Remove <think>...</think> tags and their content - default implementation
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    // Remove markdown code blocks (```markdown ... ```)
    cleaned = cleaned.replace(/```markdown\s*\n([\s\S]*?)\n```/g, '$1');
    cleaned = cleaned.replace(/```\s*\n([\s\S]*?)\n```/g, '$1');
    
    return cleaned.trim();
  }
  
  async generateSummary(text: string, userId?: string): Promise<string> {
    const requestId = generateRequestId();
    
    aiLogger.logDebug(this.provider, 'generateSummary', requestId, 'Starting text summarization', { textLength: text.length }, userId);
    
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'あなたは日本のシステムエンジニアです。以下のテキストを簡潔に要約してください。',
      },
      {
        role: 'user',
        content: `以下のテキストを要約してください:\n\n${text}`,
      },
    ];

    const response = await this.generateResponse(messages, userId, { operation: 'summarize', textLength: text.length });
    
    aiLogger.logDebug(this.provider, 'generateSummary', requestId, 'Text summarization completed', { summaryLength: response.content.length }, userId);
    
    return response.content;
  }

  async analyzeTask(taskDescription: string, userId?: string): Promise<{
    priority: 'low' | 'medium' | 'high';
    estimatedHours: number;
    tags: string[];
  }> {
    const requestId = generateRequestId();
    
    aiLogger.logDebug(this.provider, 'analyzeTask', requestId, 'Starting task analysis', { taskLength: taskDescription.length }, userId);
    
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `あなたは損害保険システム開発のプロジェクトマネージャーです。タスクの優先度、見積もり時間、タグを分析してください。
        
        レスポンスは以下のJSON形式で返してください：
        {
          "priority": "low" | "medium" | "high",
          "estimatedHours": number,
          "tags": ["tag1", "tag2", ...]
        }`,
      },
      {
        role: 'user',
        content: `以下のタスクを分析してください:\n\n${taskDescription}`,
      },
    ];

    const response = await this.generateResponse(messages, userId, { operation: 'analyzeTask', taskDescription });
    
    try {
      let analysis;
      if (this.provider === 'ollama') {
        // Clean the response first, then extract JSON
        const cleanedContent = this.cleanThinkTags(response.content);
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } else {
        analysis = JSON.parse(response.content);
      }
      
      aiLogger.logDebug(this.provider, 'analyzeTask', requestId, 'Task analysis completed', { analysis }, userId);
      return analysis;
    } catch (error) {
      aiLogger.logError(this.provider, 'analyzeTask', requestId, error as Error, userId, { taskDescription });
      
      // Fallback response
      const fallback = {
        priority: 'medium' as const,
        estimatedHours: 4,
        tags: ['general'],
      };
      
      aiLogger.logDebug(this.provider, 'analyzeTask', requestId, 'Using fallback analysis result', { fallback }, userId);
      return fallback;
    }
  }

  async analyzeText(text: string, userId?: string): Promise<string> {
    const requestId = generateRequestId();
    
    // リアルタイム分析用の設定を使用
    const { storage } = await import('./storage');
    const realtimeConfig = await storage.getRealtimeAnalysisConfig();
    
    // リアルタイム分析専用のAIサービスを作成
    let realtimeService: AIService;
    switch (realtimeConfig.provider) {
      case 'groq':
        realtimeService = new GroqService();
        break;
      case 'openai':
        realtimeService = new OpenAIService();
        break;
      case 'gemini':
        realtimeService = new GeminiService();
        break;
      case 'ollama':
        realtimeService = new OllamaService();
        break;
      default:
        realtimeService = this; // フォールバック
    }
    
    aiLogger.logDebug(realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq', 'analyzeText', requestId, 'Starting text analysis with realtime provider', { textLength: text.length, realtimeProvider: realtimeConfig.provider }, userId);
    
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `あなたは損害保険システム開発のプロジェクトマネージャーのアシスタントです。週次報告の内容を分析して、適切な記載レベルの報告になるように簡潔なフィードバックを提供してください。

重要な指摘がある場合は以下の形式で500文字以内で返してください。その際は、前回の内容を考慮してください：
**⚠️指摘**: [具体的な問題点]
**💡提案**: [改善案]
注意：ただし報告者がやる気を無くさないように褒めるスタンスでフィードバックを行ってください。
`,
      },
      {
        role: 'user',
        content: text,
      },
    ];
    
    try {
      const response = await realtimeService.generateResponse(messages, userId, { operation: 'analyzeText', text, realtimeConfig });
      
      const cleanedContent = this.cleanThinkTags(response.content);
      aiLogger.logDebug(realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq', 'analyzeText', requestId, 'Text analysis completed', { analysisLength: cleanedContent.length }, userId);
      return cleanedContent;
    } catch (error) {
      aiLogger.logError(realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq', 'analyzeText', requestId, error as Error, userId, { text });
      
      // Fallback response
      const fallback = "申し訳ございませんが、現在AI分析サービスに接続できません。しばらく後に再度お試しください。";
      
      aiLogger.logDebug(realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq', 'analyzeText', requestId, 'Using fallback analysis result', { fallback }, userId);
      return fallback;
    }
  }
}

// OpenAI implementation
export class OpenAIService extends AIService {
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

    const requestData = {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: aiConfig.openai.model,
        messages: messages,
        max_tokens: aiConfig.openai.maxTokens,
        temperature: aiConfig.openai.temperature,
      }
    };

    // Log request
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

      // Log response
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

// Ollama implementation
export class OllamaService extends AIService {
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

    // Convert messages to Ollama format
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

    // Log request
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

      // Remove <think> tags and their content from the response
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

      // Log response
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

// Gemini implementation
export class GeminiService extends AIService {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    super('gemini');
    this.client = new GoogleGenerativeAI(aiConfig.gemini.apiKey);
    this.model = aiConfig.gemini.model;
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const requestData = {
      endpoint: 'https://generativelanguage.googleapis.com/v1/models/' + this.model,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        model: this.model,
        contents: this.messagesToGeminiFormat(messages),
        generationConfig: {
          temperature: aiConfig.gemini.temperature,
          maxOutputTokens: aiConfig.gemini.maxTokens,
        },
      }
    };

    // Log request
    aiLogger.logRequest('gemini', 'generateResponse', requestId, requestData, userId, metadata);

    try {
      const model = this.client.getGenerativeModel({ 
        model: this.model,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      // Convert messages to Gemini format
      const prompt = this.messagesToPrompt(messages);
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: aiConfig.gemini.temperature,
          maxOutputTokens: aiConfig.gemini.maxTokens,
        },
      });

      const duration = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error('No response content from Gemini');
      }

      const responseData = {
        status: 200,
        headers: {},
        body: {
          model: this.model,
          content: text,
          usage: response.usageMetadata,
        },
        duration,
      };

      // Log response
      aiLogger.logResponse('gemini', 'generateResponse', requestId, responseData, userId, metadata);

      const aiResponse: AIResponse = {
        content: text,
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        } : undefined,
        requestId,
        provider: 'gemini',
        duration,
      };

      aiLogger.logDebug('gemini', 'generateResponse', requestId, 'Gemini response processed successfully', 
        { tokens: aiResponse.usage?.totalTokens, duration }, userId);

      return aiResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('gemini', 'generateResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model });
      
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private messagesToPrompt(messages: AIMessage[]): string {
    return messages
      .map(msg => {
        switch (msg.role) {
          case 'system':
            return `システム: ${msg.content}`;
          case 'user':
            return `ユーザー: ${msg.content}`;
          case 'assistant':
            return `アシスタント: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join('\n\n');
  }

  private messagesToGeminiFormat(messages: AIMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }
}

// Groq Key Manager for Rate Limit Rotation
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
    // Initialize key limits
    this.apiKeys.forEach(key => {
      this.keyLimits.set(key, {
        remainingRequests: 1000, // Default values
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
      
      // Check if key is available
      if (keyStatus && !keyStatus.isBlocked && keyStatus.remainingRequests > 0) {
        return currentKey;
      }
      
      // Check if reset time has passed
      if (keyStatus && keyStatus.resetTime < new Date()) {
        keyStatus.isBlocked = false;
        keyStatus.remainingRequests = 1000; // Reset to default
        keyStatus.remainingTokens = 100000;
        return currentKey;
      }
      
    } while (attempts < this.apiKeys.length);
    
    // If no keys are available, return the original key (will fail with 429)
    this.currentKeyIndex = originalIndex;
    return this.apiKeys[this.currentKeyIndex];
  }

  updateKeyLimits(key: string, headers: Record<string, any>): void {
    const keyStatus = this.keyLimits.get(key);
    if (!keyStatus) return;

    // Parse rate limit headers
    const remainingRequests = parseInt(headers['x-ratelimit-remaining-requests'] || '1000');
    const remainingTokens = parseInt(headers['x-ratelimit-remaining-tokens'] || '100000');
    const resetTime = headers['x-ratelimit-reset-requests'] ? 
      new Date(headers['x-ratelimit-reset-requests']) : 
      new Date(Date.now() + 60000); // Default 1 minute

    keyStatus.remainingRequests = remainingRequests;
    keyStatus.remainingTokens = remainingTokens;
    keyStatus.resetTime = resetTime;
    keyStatus.isBlocked = remainingRequests <= 0 || remainingTokens <= 0;
  }

  markKeyAsBlocked(key: string, resetTime?: Date): void {
    const keyStatus = this.keyLimits.get(key);
    if (keyStatus) {
      keyStatus.isBlocked = true;
      keyStatus.resetTime = resetTime || new Date(Date.now() + 60000); // Default 1 minute
    }
  }

  getKeyStatus(): Array<{key: string, status: any}> {
    return this.apiKeys.map(key => ({
      key: key.substring(0, 10) + '...',
      status: this.keyLimits.get(key)
    }));
  }
}

// Groq implementation
export class GroqService extends AIService {
  private client: Groq;
  private keyManager: GroqKeyManager;

  constructor() {
    super('groq');
    
    // Initialize key manager with multiple API keys
    const apiKeys = aiConfig.groq.apiKeys.length > 0 ? aiConfig.groq.apiKeys : [aiConfig.groq.apiKey];
    this.keyManager = new GroqKeyManager(apiKeys);
    
    this.client = new Groq({
      apiKey: this.keyManager.getCurrentKey(),
    });
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const currentKey = this.keyManager.getCurrentKey();
      
      const requestData = {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          model: aiConfig.groq.model,
          messages: messages,
          max_tokens: aiConfig.groq.maxTokens,
          temperature: aiConfig.groq.temperature,
        }
      };

      // Log request
      aiLogger.logRequest('groq', 'generateResponse', requestId, requestData, userId, metadata);

      try {
        // Update client with current key
        this.client = new Groq({
          apiKey: currentKey,
        });

        const response = await this.client.chat.completions.create({
          model: aiConfig.groq.model,
          messages: messages,
          max_tokens: aiConfig.groq.maxTokens,
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

        // Log response
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
          { tokens: result.usage?.totalTokens, duration, keyUsed: currentKey.substring(0, 10) + '...' }, userId);

        return result;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Check if it's a rate limit error (429)
        if (error?.status === 429 || error?.message?.includes('rate limit') || error?.message?.includes('429')) {
          aiLogger.logDebug('groq', 'generateResponse', requestId, 'Rate limit hit, attempting key rotation', 
            { attempt: attempt + 1, maxRetries, currentKey: currentKey.substring(0, 10) + '...' }, userId);
          
          // Mark current key as blocked
          this.keyManager.markKeyAsBlocked(currentKey);
          
          // Try to rotate to next key
          const nextKey = this.keyManager.rotateToNextKey();
          
          if (nextKey === currentKey) {
            // No more keys available, wait and try again
            aiLogger.logDebug('groq', 'generateResponse', requestId, 'No available keys, waiting before retry', 
              { attempt: attempt + 1, maxRetries }, userId);
            
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // exponential backoff
              continue;
            }
          } else {
            aiLogger.logDebug('groq', 'generateResponse', requestId, 'Rotated to next key', 
              { nextKey: nextKey.substring(0, 10) + '...' }, userId);
            
            if (attempt < maxRetries - 1) {
              continue; // Try again with new key
            }
          }
        }
        
        // If this is the last attempt or not a rate limit error, throw
        if (attempt === maxRetries - 1) {
          aiLogger.logError('groq', 'generateResponse', requestId, error as Error, userId, 
            { ...metadata, duration, model: aiConfig.groq.model, attempt: attempt + 1 });
          
          throw new Error(`Groq API error after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}

// Factory function to create the appropriate AI service
export function createAIService(): AIService {
  switch (aiConfig.provider) {
    case 'openai':
      return new OpenAIService();
    case 'ollama':
      return new OllamaService();
    case 'gemini':
      return new GeminiService();
    case 'groq':
      return new GroqService();
    default:
      throw new Error(`Unsupported AI provider: ${aiConfig.provider}`);
  }
}

// Singleton instance
let aiService: AIService | null = null;
let currentProvider: string | null = null;

export function getAIService(): AIService {
  if (!aiService) {
    aiService = createAIService();
    currentProvider = aiConfig.provider;
  }
  return aiService;
}

// 動的設定に対応したAIサービス取得関数
export async function getAIServiceDynamic(): Promise<AIService> {
  const dynamicConfig = await getDynamicAIConfig();
  
  // プロバイダーが変わった場合は新しいサービスを作成
  if (!aiService || currentProvider !== dynamicConfig.provider) {
    aiService = createAIServiceWithConfig(dynamicConfig);
    currentProvider = dynamicConfig.provider;
  }
  
  return aiService;
}

// 設定を指定してAIサービスを作成する関数
function createAIServiceWithConfig(config: typeof aiConfig): AIService {
  switch (config.provider) {
    case 'openai':
      return new OpenAIService();
    case 'ollama':
      return new OllamaService();
    case 'gemini':
      return new GeminiService();
    case 'groq':
      return new GroqService();
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}
