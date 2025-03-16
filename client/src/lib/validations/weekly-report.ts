import { z } from "zod";

export const weeklyReportSchema = z.object({
  reportPeriodStart: z.string().min(1, "開始日を選択してください"),
  reportPeriodEnd: z.string().min(1, "終了日を選択してください"),
  caseId: z.number().min(1, "案件を選択してください"),
  reporterName: z.string().min(1, "報告者名を入力してください"),
  weeklyTasks: z.string().min(1, "今週の作業内容を入力してください"),
  progressRate: z.number().min(0).max(100),
  progressStatus: z.string().min(1, "進捗状況を選択してください"),
  delayIssues: z.string().min(1, "進捗遅延・問題点の有無を選択してください"),
  delayDetails: z.string().optional().default(""),
  issues: z.string().min(1, "課題・問題点を入力してください"),
  newRisks: z.string().min(1, "新たなリスクの有無を選択してください"),
  riskSummary: z.string().optional().default(""),
  riskCountermeasures: z.string().optional().default(""),
  riskLevel: z.string().optional().default(""),
  qualityConcerns: z.string().min(1, "品質懸念事項の有無を選択してください"),
  qualityDetails: z.string().optional().default(""),
  testProgress: z.string().optional().default(""),
  changes: z.string().min(1, "変更の有無を選択してください"),
  changeDetails: z.string().optional().default(""),
  nextWeekPlan: z.string().min(1, "来週の作業予定を入力してください"),
  supportRequests: z.string().min(1, "支援・判断の要望事項を入力してください"),
  resourceConcerns: z.string().optional().default("none"),
  resourceDetails: z.string().optional().default(""),
  customerIssues: z.string().optional().default("none"),
  customerDetails: z.string().optional().default(""),
  environmentIssues: z.string().optional().default("none"),
  environmentDetails: z.string().optional().default(""),
  costIssues: z.string().optional().default("none"),
  costDetails: z.string().optional().default(""),
  knowledgeIssues: z.string().optional().default("none"),
  knowledgeDetails: z.string().optional().default(""),
  trainingIssues: z.string().optional().default("none"),
  trainingDetails: z.string().optional().default(""),
  urgentIssues: z.string().optional().default("none"),
  urgentDetails: z.string().optional().default(""),
  businessOpportunities: z.string().optional().default("none"),
  businessDetails: z.string().optional().default(""),
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