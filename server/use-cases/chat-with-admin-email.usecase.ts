import { AIMessage } from '../ai-providers/iai-provider';
import { getAIService } from '../ai-service';
import { aiLogger, generateRequestId } from '../ai-logger';
import { AIProvider } from '../../shared/ai-constants';

export async function chatWithAdminEmail(
  emailContent: string,
  userMessage: string,
  chatHistory: AIMessage[]
): Promise<string | null> {
  const requestId = generateRequestId();
  const operation = 'chatWithAdminEmail';

  const aiService = await getAIService();
  const provider: AIProvider = aiService ? aiService.provider : 'openai'; // aiServiceがnullの場合のデフォルト値を設定

  aiLogger.logDebug(provider, operation, requestId, 'chatWithAdminEmailユースケースを開始します。', { emailContent, userMessage, chatHistory });

  if (!aiService) {
    aiLogger.logError(provider, operation, requestId, new Error('AIサービスが利用できません。'));
    return null;
  }

  // システムプロンプトの構築
  const systemPrompt: AIMessage = {
    role: 'system',
    content: `あなたは管理者確認メールの内容についてユーザーの質問に答えるアシスタントです。
以下のガイドラインに従って回答してください。
- 提供された管理者確認メールの内容のみに基づいて回答してください。
- メールに記載されていない情報については、「メールにはその情報が記載されていません」のように明確に伝えてください。
- 回答は簡潔かつ丁寧な言葉遣いを心がけてください。
- ユーザーの質問に直接的に答えるようにしてください。`
  };

  // ユーザープロンプトの構築
  const userPrompt: AIMessage = {
    role: 'user',
    content: `管理者確認メールの内容:
---
${emailContent}
---

過去の対話履歴:
${chatHistory.map(msg => `${msg.role === 'user' ? 'ユーザー' : 'AI'}: ${msg.content}`).join('\n')}

ユーザーからの現在の質問: ${userMessage}`
  };

  const messages: AIMessage[] = [systemPrompt, ...chatHistory, userPrompt];

  try {
    aiLogger.logDebug(provider, operation, requestId, 'AIサービスにリクエストを送信します。', { messages });
    const response = await aiService.generateResponse(messages);

    if (!response || !response.content) {
      aiLogger.logWarn(provider, operation, requestId, 'AIサービスからの応答が空でした。');
      return null;
    }

    aiLogger.logDebug(provider, operation, requestId, 'AIサービスからの応答を受信しました。', { response });
    return response.content;
  } catch (error: any) {
    aiLogger.logError(provider, operation, requestId, error);
    return null;
  }
}