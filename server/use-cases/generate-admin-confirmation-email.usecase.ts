import { getAIService } from '../ai-service.js';
import { aiLogger, generateRequestId } from '../ai-logger.js';
import { ANALYSIS_FIELD_TYPES } from '@shared/ai-constants';
import { analysisPrompts } from '../prompts/analysis-prompts.js';

interface WeeklyReportData {
  reporterName: string;
  weeklyTasks: string;
  progressRate: number;
  progressStatus: string;
  issues: string;
  delayIssues: string;
  delayDetails?: string | null;
  newRisks: string;
  riskSummary?: string | null;
  nextWeekPlan: string;
  supportRequests: string;
  qualityConcerns: string;
  changes: string;
  changeDetails?: string | null;
  resourceConcerns: string | null;
  customerIssues: string | null;
  environmentIssues: string | null;
  costIssues: string | null;
  knowledgeIssues: string | null;
  trainingIssues: string | null;
  urgentIssues: string | null;
  businessOpportunities: string | null;
}

interface CaseData {
  caseName: string;
  projectName: string;
  description?: string | null;
  milestone?: string | null;
}

/**
 * 週次報告の内容に基づいて管理者確認メール文章を自動生成
 */
export async function generateAdminConfirmationEmail(
  weeklyReport: WeeklyReportData,
  caseInfo: CaseData,
  originalData?: WeeklyReportData,
  modifiedBy?: string,
  previousReport?: WeeklyReportData
): Promise<string> {
  const requestId = generateRequestId();
  
  try {
    aiLogger.logDebug('gemini', 'generateAdminConfirmationEmail', requestId, 'Starting admin confirmation email generation');

    // 週次報告の内容から確認すべき項目を抽出（前回レポートとの差分分析も含む）
    const confirmationPoints = extractConfirmationPoints(weeklyReport, originalData, previousReport);
    
    // メール文章生成用の詳細プロンプトを構築
    const systemPrompt = `あなたは経験豊富なプロジェクトマネージャーです。週次報告を確認し、担当者に対して的確で建設的な確認メールを作成してください。

以下の指針に従ってメール文章を作成してください：

1. **具体性**: 抽象的な質問ではなく、具体的な確認項目を提示する
2. **優先度**: 重要度の高い項目から順番に質問する
3. **建設的**: 問題点を指摘するだけでなく、改善に向けた視点を含める
4. **簡潔性**: 必要な情報のみを含め、冗長な表現は避ける
5. **敬意**: 担当者の努力を認めつつ、サポートする姿勢を示す
6. **継続性**: 前回レポートとの変化を踏まえた質問と確認を行う
7. **傾向分析**: 改善傾向や悪化傾向を適切に評価し言及する

メール文章は以下の構造で作成してください：
- 件名: 明確で簡潔
- 宛先: 担当者名
- 挨拶: 簡潔な挨拶
- 確認事項: 番号付きリストで整理（前回からの変化点を優先）
- 回答期限: 具体的な期限と理由
- 結び: サポート的な結びの言葉`;

    const userPrompt = `【プロジェクト情報】
プロジェクト名: ${caseInfo.projectName}
案件名: ${caseInfo.caseName}
担当者: ${weeklyReport.reporterName}
${caseInfo.description ? `案件概要: ${caseInfo.description}` : ''}
${caseInfo.milestone ? `マイルストーン: ${caseInfo.milestone}` : ''}

【週次報告の主要な内容】
■ 今週の作業内容
${weeklyReport.weeklyTasks}

■ 進捗状況 (${weeklyReport.progressRate}%)
${weeklyReport.progressStatus}

■ 課題・問題点
${weeklyReport.issues}

■ 遅延状況
${weeklyReport.delayIssues}
${weeklyReport.delayDetails ? `詳細: ${weeklyReport.delayDetails}` : ''}

■ 新たなリスク
${weeklyReport.newRisks}
${weeklyReport.riskSummary ? `リスク要約: ${weeklyReport.riskSummary}` : ''}

■ 来週の作業予定
${weeklyReport.nextWeekPlan}

■ 支援・判断の要望事項
${weeklyReport.supportRequests}

■ 品質懸念
${weeklyReport.qualityConcerns}

■ 変更内容
${weeklyReport.changes}
${weeklyReport.changeDetails ? `変更詳細: ${weeklyReport.changeDetails}` : ''}

${confirmationPoints.length > 0 ? `
【特に確認が必要な項目】
${confirmationPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}
` : ''}

${originalData ? `
【管理者による修正がある項目】
修正者: ${modifiedBy || '管理者'}
（修正された項目について、担当者への確認や説明が必要な場合は含めてください）
` : ''}

${previousReport ? `
【前回レポートとの比較分析】
■ 進捗率の変化: ${previousReport.progressRate}% → ${weeklyReport.progressRate}%
■ 遅延状況の変化: ${previousReport.delayIssues} → ${weeklyReport.delayIssues}
■ 新たなリスクの変化: ${previousReport.newRisks} → ${weeklyReport.newRisks}
■ 品質懸念の変化: ${previousReport.qualityConcerns} → ${weeklyReport.qualityConcerns}

【前回レポートの主要内容（参考）】
- 進捗状況: ${previousReport.progressStatus}
- 課題・問題: ${previousReport.issues}
- 来週計画: ${previousReport.nextWeekPlan}
- 支援要請: ${previousReport.supportRequests}

上記の前回レポートとの比較を踏まえ、変化の背景や継続課題の進捗について確認してください。
` : ''}

上記の情報をもとに、${weeklyReport.reporterName}さんに送る確認メールを作成してください。マークダウン形式は使用せず、プレーンテキストで構いません。`;

    const aiService = await getAIService();
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ];

    const response = await aiService.generateResponse(messages);
    
    if (!response.content) {
      throw new Error('AI service returned empty response');
    }

    aiLogger.logDebug('gemini', 'generateAdminConfirmationEmail', requestId, 'Admin confirmation email generated successfully');

    return response.content;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    aiLogger.logError('gemini', 'generateAdminConfirmationEmail', requestId, error as Error);
    
    // エラー時のフォールバック: 基本的なテンプレートを返す
    return generateFallbackEmail(weeklyReport, caseInfo);
  }
}

/**
 * 週次報告から確認すべきポイントを抽出（前回レポートとの差分分析も含む）
 */
function extractConfirmationPoints(weeklyReport: WeeklyReportData, originalData?: WeeklyReportData, previousReport?: WeeklyReportData): string[] {
  const points: string[] = [];

  // 前回レポートとの差分分析
  if (previousReport) {
    // 進捗率の変化分析
    const progressDiff = weeklyReport.progressRate - previousReport.progressRate;
    if (progressDiff < -5) {
      points.push(`進捗悪化: 前回${previousReport.progressRate}%から${weeklyReport.progressRate}%に低下（${Math.abs(progressDiff)}%減少）`);
    } else if (progressDiff > 10) {
      points.push(`進捗向上: 前回${previousReport.progressRate}%から${weeklyReport.progressRate}%に改善（${progressDiff}%向上）`);
    }

    // 課題・問題点の変化分析
    if (weeklyReport.issues !== previousReport.issues) {
      if (weeklyReport.issues.length > previousReport.issues.length + 50) {
        points.push(`課題増加: 前回レポートから課題内容が大幅に増加しています`);
      } else if (weeklyReport.issues.length < previousReport.issues.length - 50) {
        points.push(`課題解決: 前回レポートから課題内容が減少しており、解決状況を確認`);
      }
    }

    // 遅延状況の変化分析
    if (weeklyReport.delayIssues !== previousReport.delayIssues) {
      if (weeklyReport.delayIssues !== 'no' && previousReport.delayIssues === 'no') {
        points.push(`新規遅延: 前回は遅延なしでしたが、今回遅延が発生しています`);
      } else if (weeklyReport.delayIssues === 'no' && previousReport.delayIssues !== 'no') {
        points.push(`遅延解消: 前回の遅延が解消されたことを確認`);
      }
    }

    // 新たなリスクの変化分析
    if (weeklyReport.newRisks !== previousReport.newRisks) {
      if (weeklyReport.newRisks !== 'no' && previousReport.newRisks === 'no') {
        points.push(`新規リスク発生: 前回はリスクなしでしたが、今回新たなリスクが発生`);
      }
    }

    // 品質懸念の変化分析
    if (weeklyReport.qualityConcerns !== previousReport.qualityConcerns) {
      if (weeklyReport.qualityConcerns !== 'none' && previousReport.qualityConcerns === 'none') {
        points.push(`品質懸念発生: 前回は品質懸念なしでしたが、今回懸念が発生`);
      } else if (weeklyReport.qualityConcerns === 'none' && previousReport.qualityConcerns !== 'none') {
        points.push(`品質懸念解消: 前回の品質懸念が解消されたことを確認`);
      }
    }

    // 支援要請の変化分析
    const prevSupportEmpty = !previousReport.supportRequests || previousReport.supportRequests.trim() === '';
    const currSupportEmpty = !weeklyReport.supportRequests || weeklyReport.supportRequests.trim() === '';
    if (!currSupportEmpty && prevSupportEmpty) {
      points.push(`新規支援要請: 前回は支援要請なしでしたが、今回要請が発生`);
    }
  }

  // 現在のレポート内容から抽出される確認ポイント
  // 遅延がある場合
  if (weeklyReport.delayIssues !== 'no' && weeklyReport.delayDetails) {
    points.push(`遅延問題: ${weeklyReport.delayDetails}`);
  }

  // 新たなリスクがある場合
  if (weeklyReport.newRisks !== 'no' && weeklyReport.riskSummary) {
    points.push(`新規リスク: ${weeklyReport.riskSummary}`);
  }

  // 支援要請がある場合
  if (weeklyReport.supportRequests && weeklyReport.supportRequests.trim() !== '') {
    points.push(`支援要請: ${weeklyReport.supportRequests}`);
  }

  // 品質懸念がある場合
  if (weeklyReport.qualityConcerns !== 'none') {
    points.push(`品質懸念: ${weeklyReport.qualityConcerns}`);
  }

  // 進捗率が低い場合 (50%未満)
  if (weeklyReport.progressRate < 50) {
    points.push(`進捗状況: 進捗率${weeklyReport.progressRate}%の詳細確認`);
  }

  // 変更がある場合
  if (weeklyReport.changes !== 'no' && weeklyReport.changeDetails) {
    points.push(`変更内容: ${weeklyReport.changeDetails}`);
  }

  // 緊急課題がある場合
  if (weeklyReport.urgentIssues !== 'none') {
    points.push(`緊急課題: ${weeklyReport.urgentIssues}`);
  }

  return points;
}

/**
 * エラー時のフォールバックメール生成
 */
function generateFallbackEmail(weeklyReport: WeeklyReportData, caseInfo: CaseData): string {
  return `件名: 週次報告について確認事項があります

${weeklyReport.reporterName}さん
お疲れ様です。

週次報告を確認させていただき、以下の点について教えてください。

■確認事項
1. 今週の作業進捗について詳細を確認したいと思います
2. 課題や問題点について、対応状況はいかがでしょうか
3. 来週の作業予定で懸念される点があれば教えてください

■回答期限
金曜日17時まで（週末の対応計画を立てるため）

ご不明な点があれば、いつでもお声がけください。
よろしくお願いいたします。`;
}