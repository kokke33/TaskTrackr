import { pgTable, text, serial, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// 案件マスタテーブル
export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  projectName: text("project_name").notNull(),
  caseName: text("case_name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 案件と週次報告の関係定義
export const casesRelations = relations(cases, ({ many }) => ({
  weeklyReports: many(weeklyReports),
}));

export const weeklyReports = pgTable("weekly_reports", {
  id: serial("id").primaryKey(),
  reportPeriodStart: date("report_period_start").notNull(),
  reportPeriodEnd: date("report_period_end").notNull(),
  caseId: integer("case_id").notNull(),  // 案件IDを外部キーとして追加
  reporterName: text("reporter_name").notNull(),
  weeklyTasks: text("weekly_tasks").notNull(),
  progressRate: integer("progress_rate").notNull(),
  progressStatus: text("progress_status").notNull(),
  delayIssues: text("delay_issues").notNull(),
  delayDetails: text("delay_details"),
  issues: text("issues").notNull(),
  newRisks: text("new_risks").notNull(),
  riskSummary: text("risk_summary"),
  riskCountermeasures: text("risk_countermeasures"),
  riskLevel: text("risk_level"),
  qualityConcerns: text("quality_concerns").notNull(),
  qualityDetails: text("quality_details"),
  testProgress: text("test_progress"),
  changes: text("changes").notNull(),
  changeDetails: text("change_details"),
  nextWeekPlan: text("next_week_plan").notNull(),
  supportRequests: text("support_requests").notNull(),
  resourceConcerns: text("resource_concerns"),
  resourceDetails: text("resource_details"),
  customerIssues: text("customer_issues"),
  customerDetails: text("customer_details"),
  environmentIssues: text("environment_issues"),
  environmentDetails: text("environment_details"),
  costIssues: text("cost_issues"),
  costDetails: text("cost_details"),
  knowledgeIssues: text("knowledge_issues"),
  knowledgeDetails: text("knowledge_details"),
  trainingIssues: text("training_issues"),
  trainingDetails: text("training_details"),
  urgentIssues: text("urgent_issues"),
  urgentDetails: text("urgent_details"),
  businessOpportunities: text("business_opportunities"),
  businessDetails: text("business_details"),
  aiAnalysis: text("ai_analysis"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 週次報告と案件の関係定義
export const weeklyReportsRelations = relations(weeklyReports, ({ one }) => ({
  case: one(cases, {
    fields: [weeklyReports.caseId],
    references: [cases.id],
  }),
}));

// 案件のスキーマ定義
export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
});

// 週次報告のスキーマ定義（更新）
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({
  id: true,
  createdAt: true,
  aiAnalysis: true,
});

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect;

// ユーザー関連のスキーマは変更なし
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;