import { IAiProvider, AIMessage } from '../ai-providers/iai-provider';
import { aiLogger, generateRequestId } from '../ai-logger';
import { analysisPrompts, basePromptTemplate } from '../prompts/analysis-prompts';

export async function* analyzeTextStream(
  aiProvider: IAiProvider,
  content: string,
  fieldType: string,
  originalContent?: string,
  previousReportContent?: string,
  userId?: string
): AsyncIterable<string> {
  const requestId = generateRequestId();
  const providerName = aiProvider.provider;

  aiLogger.logDebug(providerName, 'analyzeTextStream', requestId, 'Starting text analysis stream', { textLength: content.length, fieldType, provider: providerName }, userId);

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
      週次報告の内容を分析して、適切な記載レベルの報告になるように修正例を提供してください。`
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    if (aiProvider.supportsStreaming && aiProvider.generateStreamResponse) {
      // ストリーミング対応プロバイダーの場合
      aiLogger.logDebug(providerName, 'analyzeTextStream', requestId, 'Using streaming response', { provider: providerName }, userId);
      
      let fullContent = '';
      for await (const chunk of aiProvider.generateStreamResponse(messages, userId, { 
        endpoint: 'analyzeTextStream',
        fieldType,
        contentLength: content.length
      })) {
        fullContent += chunk;
        yield chunk;
      }
      
      // 最終的なクリーンアップされたコンテンツをログに記録
      const cleanedContent = aiProvider.cleanThinkTags ? aiProvider.cleanThinkTags(fullContent) : fullContent;
      aiLogger.logDebug(providerName, 'analyzeTextStream', requestId, 'Stream analysis completed successfully', 
        { contentLength: cleanedContent.length, provider: providerName }, userId);
    } else {
      // 非ストリーミングプロバイダーの場合：一括で送信
      aiLogger.logDebug(providerName, 'analyzeTextStream', requestId, 'Using non-streaming fallback', { provider: providerName }, userId);
      
      const response = await aiProvider.generateResponse(messages, userId, { 
        endpoint: 'analyzeTextStream',
        fieldType,
        contentLength: content.length
      });
      
      const cleanedContent = aiProvider.cleanThinkTags ? aiProvider.cleanThinkTags(response.content) : response.content;
      yield cleanedContent;
      
      aiLogger.logDebug(providerName, 'analyzeTextStream', requestId, 'Non-streaming analysis completed successfully', 
        { contentLength: cleanedContent.length, provider: providerName }, userId);
    }
  } catch (error) {
    aiLogger.logError(providerName, 'analyzeTextStream', requestId, error as Error, userId, { 
      fieldType,
      contentLength: content.length
    });
    throw error;
  }
}