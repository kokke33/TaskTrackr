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

  aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Starting two-stage text analysis', { textLength: content.length, fieldType, provider: providerName }, userId);

  try {
    // ========== 第1段階: 詳細分析 ==========
    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Starting stage 1: Detailed analysis', { stage: 1 }, userId);
    
    const firstStageResult = await performFirstStageAnalysis(
      aiProvider, content, fieldType, originalContent, previousReportContent, userId, requestId
    );

    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Stage 1 completed', { 
      stage: 1, 
      resultLength: firstStageResult.length,
      firstStagePreview: firstStageResult.substring(0, 100) + '...'
    }, userId);

    // ========== 第2段階: エグゼクティブサマリ生成 ==========
    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Starting stage 2: Executive summary generation', { stage: 2 }, userId);

    const executiveSummary = await generateExecutiveSummary(
      aiProvider, firstStageResult, content, fieldType, userId, requestId
    );

    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Two-stage analysis completed successfully', { 
      stage: 2,
      finalResultLength: executiveSummary.length 
    }, userId);

    return executiveSummary;

  } catch (error) {
    aiLogger.logError(providerName, 'analyzeText', requestId, error as Error, userId, { text: content });
    
    const fallback = "申し訳ございませんが、現在AI分析サービスに接続できません。しばらく後に再度お試しください。";
    
    aiLogger.logDebug(providerName, 'analyzeText', requestId, 'Using fallback analysis result', { fallback }, userId);
    return fallback;
  }
}

// 第1段階: 詳細分析（従来のロジック）
async function performFirstStageAnalysis(
  aiProvider: IAiProvider,
  content: string,
  fieldType: string,
  originalContent?: string,
  previousReportContent?: string,
  userId?: string,
  requestId?: string
): Promise<string> {
  const providerName = aiProvider.provider;

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

  const response = await aiProvider.generateResponse(messages, userId, { operation: 'analyzeText-stage1', text: content });
  return response.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// 第2段階: エグゼクティブサマリ生成
async function generateExecutiveSummary(
  aiProvider: IAiProvider,
  firstStageResult: string,
  originalContent: string,
  fieldType: string,
  userId?: string,
  requestId?: string
): Promise<string> {
  const executiveSummaryPrompt = `あなたはシステムエンジニア兼プロジェクトマネジャーです。
以下の週次報告分析結果を基に、A4一枚に凝縮したエグゼクティブサマリを作成してください。

【要件】
- 冗長な言い回しを排し、多彩な語彙で構成
- マークダウン形式で章立てを明確に
- 箇条書きリストを随所に配置
- 末尾に5問のFAQを設け
- 全体を洗練された日本語でまとめる

【分析対象フィールド】: ${fieldType}

【第1段階分析結果】:
${firstStageResult}

【週次報告原文】:
${originalContent}

上記の情報を基に、経営層・管理層向けの戦略的なエグゼクティブサマリを作成してください。`;

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `あなたはシステムエンジニア兼プロジェクトマネージャーの視点で、週次報告を経営層向けのエグゼクティブサマリに変換する専門家です。

出力形式の例:
# 週次報告エグゼクティブサマリ

## プロジェクト状況概要
- 基本情報のハイライト

## 重要な進捗・成果  
- 今週の主要成果
- 進捗率・状況

## 課題・リスク分析
- 重要な課題
- リスクレベルと対策

## アクションプラン
- 来週の重要予定
- 支援要請事項

## FAQ（よくある質問）
**Q1: プロジェクトの全体的な健全性は？**
A1: [分析結果に基づく回答]

**Q2: 最も重要な課題は何？**
A2: [分析結果に基づく回答]

**Q3: スケジュール遵守は可能？**
A3: [分析結果に基づく回答]

**Q4: 追加リソースは必要？**
A4: [分析結果に基づく回答]

**Q5: 次のマイルストーンへの影響は？**
A5: [分析結果に基づく回答]`
    },
    {
      role: 'user',
      content: executiveSummaryPrompt
    }
  ];

  const response = await aiProvider.generateResponse(messages, userId, { 
    operation: 'analyzeText-stage2-executiveSummary', 
    fieldType,
    originalTextLength: originalContent.length,
    firstStageLength: firstStageResult.length
  });

  return response.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}