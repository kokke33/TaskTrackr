import { IAiProvider, AIMessage } from '../ai-providers/iai-provider';
import { aiLogger, generateRequestId } from '../ai-logger';
import { analysisPrompts, basePromptTemplate } from '../prompts/analysis-prompts';

export async function analyzeText(
  aiProvider: IAiProvider,
  content: string,
  fieldType: string,
  originalContent?: string,
  previousReportContent?: string,
  userId?: string
): Promise<string> {
  const requestId = generateRequestId();
  const providerName = aiProvider.provider;

  aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Starting text analysis', { textLength: content.length, fieldType, provider: providerName }, userId);

  // 変更点や前回報告との比較を構築
  let changeAnalysis = "";
  if (originalContent && originalContent !== content) {
    changeAnalysis = `\n\n【元の内容からの変更点】\n元の内容:\n${originalContent}\n\n現在の内容:\n${content}`;
  }
  
  let isContentUnchangedMessage = "";
  if (previousReportContent && previousReportContent.trim() !== "") {
    const normalizedPrevious = previousReportContent.trim().replace(/\s+/g, ' ');
    const normalizedCurrent = content.trim().replace(/\s+/g, ' ');
    if (normalizedPrevious === normalizedCurrent) {
      isContentUnchangedMessage = "\n\n⚠️ 前回報告から内容が変更されていません。レイアウトを維持しつつ、最新の状況を反映した内容に更新してください。";
      changeAnalysis += `\n\n【前回報告との比較】\n前回報告の内容:\n${previousReportContent}\n\n⚠️ 重要: 前回報告と全く同じ内容です。進捗や状況に変化がない場合でも、現在の状況を改めて記載することが重要です。`;
    } else {
      changeAnalysis += `\n\n【前回報告との比較】\n前回報告の内容:\n${previousReportContent}`;
    }
  }

  const layoutRequirements = analysisPrompts[fieldType] || "";

  const prompt = basePromptTemplate
    .replace('{{fieldName}}', fieldType)
    .replace('{{content}}', content)
    .replace('{{changeAnalysis}}', changeAnalysis)
    .replace('{{layoutRequirements}}', layoutRequirements ? `\n${layoutRequirements}`: '')
    .replace('{{isContentUnchanged}}', isContentUnchangedMessage);

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `あなたは損害保険システム開発のプロジェクトマネージャーのアシスタントです。
      週次報告の内容を分析して、適切な記載レベルの報告になるように修正例を提供してください。

重要な指摘がある場合は以下の形式で700文字以内で返してください。：
**📝修正例**: [元のテキストの問題部分を具体的に書き直した例。実際にコピー&ペーストで使用できる形で提示してください]

注意事項：
- 修正例のみを回答してください。フィードバックやアドバイスは不要です。
- 修正例では、元のテキストから改善が必要な部分を抜粋し、具体的な数値や表現を使用して実際に書き直してください
- 修正例は即座に適用可能で、報告品質向上につながる実践的な内容にしてください
`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  try {
    const response = await aiProvider.generateResponse(messages, userId, { operation: 'analyzeText', text: content });
    
    const cleanedContent = response.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Text analysis completed', { analysisLength: cleanedContent.length }, userId);
    return cleanedContent;
  } catch (error) {
    aiLogger.logError(providerName, 'analyzeText', requestId, error as Error, userId, { text: content });
    
    const fallback = "申し訳ございませんが、現在AI分析サービスに接続できません。しばらく後に再度お試しください。";
    
    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Using fallback analysis result', { fallback }, userId);
    return fallback;
  }
}

