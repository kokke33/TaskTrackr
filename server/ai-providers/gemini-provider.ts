import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { aiConfig } from '../config.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { AIMessage, AIResponse } from './iai-provider.js';
import { BaseProvider } from './base-provider.js';

export class GeminiService extends BaseProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  readonly supportsStreaming: boolean = true;

  constructor(model?: string) {
    super('gemini');
    this.client = new GoogleGenerativeAI(aiConfig.gemini.apiKey);
    this.model = model || aiConfig.gemini.model;
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
    // システムメッセージを最初のユーザーメッセージに統合
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    
    if (systemMessages.length > 0 && nonSystemMessages.length > 0) {
      const systemContent = systemMessages.map(msg => msg.content).join('\n\n');
      const firstUserMessage = nonSystemMessages.find(msg => msg.role === 'user');
      
      if (firstUserMessage) {
        // 最初のユーザーメッセージにシステムメッセージを統合
        const updatedMessages = nonSystemMessages.map((msg, index) => {
          if (msg.role === 'user' && index === nonSystemMessages.findIndex(m => m.role === 'user')) {
            return {
              ...msg,
              content: `${systemContent}\n\n${msg.content}`
            };
          }
          return msg;
        });
        
        return updatedMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
      }
    }
    
    return nonSystemMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  async* generateStreamResponse(messages: AIMessage[], userId?: string, metadata?: Record<string, any>): AsyncIterable<string> {
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
        stream: true,
      }
    };

    aiLogger.logRequest('gemini', 'generateStreamResponse', requestId, requestData, userId, metadata);

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
        generationConfig: {
          temperature: aiConfig.gemini.temperature,
          maxOutputTokens: aiConfig.gemini.maxTokens,
        },
      });

      const geminiMessages = this.messagesToGeminiFormat(messages);
      const result = await model.generateContentStream({
        contents: geminiMessages
      });

      for await (const chunk of result.stream) {
        const content = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          yield content;
        }
      }

      const duration = Date.now() - startTime;
      aiLogger.logDebug('gemini', 'generateStreamResponse', requestId, 'Gemini stream response completed successfully', 
        { duration, model: this.model }, userId);
    } catch (error) {
      const duration = Date.now() - startTime;
      aiLogger.logError('gemini', 'generateStreamResponse', requestId, error as Error, userId, 
        { ...metadata, duration, model: this.model });
      
      throw new Error(`Gemini streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}