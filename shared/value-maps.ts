/**
 * 週次レポートの各種ステータス値を英語から日本語に変換するマップ
 */

// 進捗状況の変換マップ
export const progressStatusMap = {
  'on-schedule': '予定通り',
  'slightly-delayed': '少し遅れている',
  'severely-delayed': '大幅に遅れている',
  'ahead': '前倒しで進行中'
} as const;

// 品質懸念の変換マップ
export const qualityConcernsMap = {
  'none': 'なし',
  'minor': '軽微な懸念あり',
  'major': '重大な懸念あり'
} as const;

// リスクレベルの変換マップ
export const riskLevelMap = {
  'high': '高',
  'medium': '中',
  'low': '低'
} as const;

// 二進ステータス（存在有無）の変換マップ
export const binaryStatusMap = {
  'exists': 'あり',
  'none': 'なし'
} as const;

// Yes/No形式の変換マップ
export const yesNoMap = {
  'yes': 'あり',
  'no': 'なし'
} as const;

/**
 * 進捗状況を日本語に変換
 */
export function convertProgressStatus(status: string): string {
  return progressStatusMap[status as keyof typeof progressStatusMap] || status;
}

/**
 * 品質懸念を日本語に変換
 */
export function convertQualityConcerns(concerns: string): string {
  return qualityConcernsMap[concerns as keyof typeof qualityConcernsMap] || concerns;
}

/**
 * リスクレベルを日本語に変換
 */
export function convertRiskLevel(level: string): string {
  return riskLevelMap[level as keyof typeof riskLevelMap] || level;
}

/**
 * 二進ステータス（存在有無）を日本語に変換
 */
export function convertBinaryStatus(status: string): string {
  return binaryStatusMap[status as keyof typeof binaryStatusMap] || status;
}

/**
 * Yes/No形式を日本語に変換
 */
export function convertYesNo(value: string): string {
  return yesNoMap[value as keyof typeof yesNoMap] || value;
}

/**
 * 週次レポートの各種フィールドを一括で日本語変換するヘルパー関数
 */
export function convertWeeklyReportValues(report: {
  progressStatus?: string | null;
  qualityConcerns?: string | null;
  riskLevel?: string | null;
  delayIssues?: string | null;
  newRisks?: string | null;
  changes?: string | null;
  resourceConcerns?: string | null;
  customerIssues?: string | null;
  environmentIssues?: string | null;
  costIssues?: string | null;
  knowledgeIssues?: string | null;
  trainingIssues?: string | null;
  urgentIssues?: string | null;
  businessOpportunities?: string | null;
}) {
  return {
    progressStatus: report.progressStatus && report.progressStatus !== null ? convertProgressStatus(report.progressStatus) : undefined,
    qualityConcerns: report.qualityConcerns && report.qualityConcerns !== null ? convertQualityConcerns(report.qualityConcerns) : undefined,
    riskLevel: report.riskLevel && report.riskLevel !== null ? convertRiskLevel(report.riskLevel) : undefined,
    delayIssues: report.delayIssues && report.delayIssues !== null ? convertYesNo(report.delayIssues) : undefined,
    newRisks: report.newRisks && report.newRisks !== null ? convertYesNo(report.newRisks) : undefined,
    changes: report.changes && report.changes !== null ? convertYesNo(report.changes) : undefined,
    resourceConcerns: report.resourceConcerns && report.resourceConcerns !== null ? convertBinaryStatus(report.resourceConcerns) : undefined,
    customerIssues: report.customerIssues && report.customerIssues !== null ? convertBinaryStatus(report.customerIssues) : undefined,
    environmentIssues: report.environmentIssues && report.environmentIssues !== null ? convertBinaryStatus(report.environmentIssues) : undefined,
    costIssues: report.costIssues && report.costIssues !== null ? convertBinaryStatus(report.costIssues) : undefined,
    knowledgeIssues: report.knowledgeIssues && report.knowledgeIssues !== null ? convertBinaryStatus(report.knowledgeIssues) : undefined,
    trainingIssues: report.trainingIssues && report.trainingIssues !== null ? convertBinaryStatus(report.trainingIssues) : undefined,
    urgentIssues: report.urgentIssues && report.urgentIssues !== null ? convertBinaryStatus(report.urgentIssues) : undefined,
    businessOpportunities: report.businessOpportunities && report.businessOpportunities !== null ? convertBinaryStatus(report.businessOpportunities) : undefined,
  };
}