import { IAiProvider, AIMessage } from '../ai-providers/iai-provider';
import { aiLogger, generateRequestId } from '../ai-logger';

export async function generateSummary(
  aiProvider: IAiProvider,
  text: string,
  userId?: string
): Promise<string> {
  const requestId = generateRequestId();
  const providerName = aiProvider.provider;

  aiLogger.logDebug(providerName, 'generateSummary', requestId, 'Starting text summarization', { textLength: text.length }, userId);

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

  const response = await aiProvider.generateResponse(messages, userId, { operation: 'summarize', textLength: text.length });

  aiLogger.logDebug(providerName, 'generateSummary', requestId, 'Text summarization completed', { summaryLength: response.content.length }, userId);

  return response.content;
}