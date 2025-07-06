import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { aiConfig } from './config.js';
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

// Groq implementation
export class GroqService extends AIService {
  private client: Groq;

  constructor() {
    super('groq');
    this.client = new Groq({
      apiKey: aiConfig.groq.apiKey,
    });
  }

  async generateResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): Promise<AIResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const requestData = {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.groq.apiKey}`,
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
        { tokens: result.usage?.totalTokens, duration }, userId);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('groq', 'generateResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: aiConfig.groq.model });
      
      throw new Error(`Groq API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

export function getAIService(): AIService {
  if (!aiService) {
    aiService = createAIService();
  }
  return aiService;
}
