import { IAiProvider, AIMessage } from '../ai-providers/iai-provider';
import { aiLogger, generateRequestId } from '../ai-logger';

function cleanThinkTags(content: string): string {
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleaned = cleaned.replace(/```markdown\s*\n([\s\S]*?)\n```/g, '$1');
  cleaned = cleaned.replace(/```\s*\n([\s\S]*?)\n```/g, '$1');
  return cleaned.trim();
}

export async function analyzeTask(
  aiProvider: IAiProvider,
  taskDescription: string,
  userId?: string
): Promise<{
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number;
  tags: string[];
}> {
  const requestId = generateRequestId();
  const providerName = aiProvider.provider;

  aiLogger.logDebug(providerName, 'analyzeTask', requestId, 'Starting task analysis', { taskLength: taskDescription.length }, userId);

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

  const response = await aiProvider.generateResponse(messages, userId, { operation: 'analyzeTask', taskDescription });

  try {
    let analysis;
    if (providerName === 'ollama') {
      const cleanedContent = cleanThinkTags(response.content);
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } else {
      analysis = JSON.parse(response.content);
    }
    
    aiLogger.logDebug(providerName, 'analyzeTask', requestId, 'Task analysis completed', { analysis }, userId);
    return analysis;
  } catch (error) {
    aiLogger.logError(providerName, 'analyzeTask', requestId, error as Error, userId, { taskDescription });
    
    const fallback = {
      priority: 'medium' as const,
      estimatedHours: 4,
      tags: ['general'],
    };
    
    aiLogger.logDebug(providerName, 'analyzeTask', requestId, 'Using fallback analysis result', { fallback }, userId);
    return fallback;
  }
}