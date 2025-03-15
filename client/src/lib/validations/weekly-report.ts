import { z } from "zod";

export const weeklyReportSchema = z.object({
  reportPeriodStart: z.string().min(1, "開始日を選択してください"),
  reportPeriodEnd: z.string().min(1, "終了日を選択してください"),
  projectName: z.string().min(1, "プロジェクトを選択してください"),
  otherProject: z.string().optional(),
  reporterName: z.string().min(1, "報告者名を入力してください"),
  weeklyTasks: z.string().min(1, "今週の作業内容を入力してください"),
  progressRate: z.number().min(0).max(100),
  progressStatus: z.string().min(1, "進捗状況を選択してください"),
  delayIssues: z.string().min(1, "進捗遅延・問題点の有無を選択してください"),
  delayDetails: z.string().optional(),
  issues: z.string().min(1, "課題・問題点を入力してください"),
  newRisks: z.string().min(1, "新たなリスクの有無を選択してください"),
  riskSummary: z.string().optional(),
  riskCountermeasures: z.string().optional(),
  riskLevel: z.string().optional(),
  qualityConcerns: z.string().min(1, "品質懸念事項の有無を選択してください"),
  qualityDetails: z.string().optional(),
  testProgress: z.string().optional(),
  changes: z.string().min(1, "変更の有無を選択してください"),
  changeDetails: z.string().optional(),
  nextWeekPlan: z.string().min(1, "来週の作業予定を入力してください"),
  supportRequests: z.string().min(1, "支援・判断の要望事項を入力してください"),
  resourceConcerns: z.string().optional(),
  resourceDetails: z.string().optional(),
  customerIssues: z.string().optional(),
  customerDetails: z.string().optional(),
  environmentIssues: z.string().optional(),
  environmentDetails: z.string().optional(),
  costIssues: z.string().optional(),
  costDetails: z.string().optional(),
  knowledgeIssues: z.string().optional(),
  knowledgeDetails: z.string().optional(),
  trainingIssues: z.string().optional(),
  trainingDetails: z.string().optional(),
  urgentIssues: z.string().optional(),
  urgentDetails: z.string().optional(),
  businessOpportunities: z.string().optional(),
  businessDetails: z.string().optional(),
}).refine(
  (data) => {
    if (data.delayIssues === "yes" && !data.delayDetails) {
      return false;
    }
    if (data.newRisks === "yes" && (!data.riskSummary || !data.riskCountermeasures || !data.riskLevel)) {
      return false;
    }
    if (data.qualityConcerns !== "none" && !data.qualityDetails) {
      return false;
    }
    if (data.changes === "yes" && !data.changeDetails) {
      return false;
    }
    return true;
  },
  {
    message: "必須項目を入力してください",
    path: ["delayDetails"]
  }
);

export type WeeklyReportFormData = z.infer<typeof weeklyReportSchema>;
