import { pgTable, text, serial, integer, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ユーザーテーブル
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// プロジェクトテーブル
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  overview: text("overview"),
  organization: text("organization"), // 体制と関係者
  personnel: text("personnel"), // 要員・契約情報
  progress: text("progress"), // 現状の進捗・スケジュール
  businessDetails: text("business_details"), // 業務・システム内容
  issues: text("issues"), // 課題・リスク・懸念点
  documents: text("documents"), // ドキュメント・ナレッジ
  handoverNotes: text("handover_notes"), // 引き継ぎ時の優先確認事項
  remarks: text("remarks"), // その他特記事項
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 案件マスタテーブル
export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  projectName: text("project_name").notNull(),
  caseName: text("case_name").notNull(),
  description: text("description"),
  milestone: text("milestone"),
  includeProgressAnalysis: boolean("include_progress_analysis").notNull().default(true),
  weeklyMeetingDay: text("weekly_meeting_day"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 管理者確認メールテーブル
export const adminConfirmationEmails = pgTable("admin_confirmation_emails", {
  id: serial("id").primaryKey(),
  weeklyReportId: integer("weekly_report_id").unique(), // 週次報告との関連付け
  content: text("content").notNull(), // メール全文
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI対話履歴テーブル
export const chatHistories = pgTable("chat_histories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  emailId: text("email_id").notNull(), // 管理者確認メールのID
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// プロジェクトと案件の関係定義
export const projectsRelations = relations(projects, ({ many }) => ({
  cases: many(cases),
  managerMeetings: many(managerMeetings),
}));

// 案件と週次報告の関係定義
export const casesRelations = relations(cases, ({ many, one }) => ({
  weeklyReports: many(weeklyReports),
  project: one(projects),
}));

export const weeklyReports = pgTable("weekly_reports", {
  id: serial("id").primaryKey(),
  reportPeriodStart: date("report_period_start").notNull(),
  reportPeriodEnd: date("report_period_end").notNull(),
  caseId: integer("case_id").notNull(),
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
  adminConfirmationEmail: text("admin_confirmation_email"), // 管理者がリーダーに確認するためのメール文章
  aiAnalysis: text("ai_analysis"),
  version: integer("version").notNull().default(1), // 楽観的ロック用バージョン番号
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// マネージャ定例議事録テーブル
export const managerMeetings = pgTable("manager_meetings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  meetingDate: date("meeting_date").notNull(),
  yearMonth: text("year_month").notNull(), // 'YYYY-MM'形式
  title: text("title").notNull(),
  content: text("content").notNull(), // メインの議事録内容
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 週次報告会議議事録テーブル
export const weeklyReportMeetings = pgTable("weekly_report_meetings", {
  id: serial("id").primaryKey(),
  weeklyReportId: integer("weekly_report_id").notNull().unique(), // 週次報告IDをユニークに設定
  meetingDate: date("meeting_date").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(), // AI生成された修正履歴議事録
  modifiedBy: text("modified_by").notNull(), // 修正者名
  originalData: jsonb("original_data").notNull(), // 修正前データ（JSON形式）
  modifiedData: jsonb("modified_data").notNull(), // 修正後データ（JSON形式）
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// システム設定テーブル
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 月次報告書テーブル
export const monthlyReports = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  projectName: text("project_name").notNull(),
  yearMonth: text("year_month").notNull(), // YYYY-MM 形式
  caseIds: text("case_ids"), // カンマ区切りの案件ID一覧（NULL可：全案件対象の場合）
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  content: text("content").notNull(), // AI生成されたMarkdown内容
  aiProvider: text("ai_provider"), // 生成時に使用したAIプロバイダー
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});



// 週次報告と案件の関係定義
export const weeklyReportsRelations = relations(weeklyReports, ({ one, many }) => ({
  case: one(cases, {
    fields: [weeklyReports.caseId],
    references: [cases.id],
  }),
  meetings: many(weeklyReportMeetings),
}));

// マネージャ定例議事録とプロジェクトの関係定義
export const managerMeetingsRelations = relations(managerMeetings, ({ one }) => ({
  project: one(projects, {
    fields: [managerMeetings.projectId],
    references: [projects.id],
  }),
}));

// 週次報告会議議事録と週次報告の関係定義
export const weeklyReportMeetingsRelations = relations(weeklyReportMeetings, ({ one }) => ({
  weeklyReport: one(weeklyReports, {
    fields: [weeklyReportMeetings.weeklyReportId],
    references: [weeklyReports.id],
  }),
}));

// スキーマ定義
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
});

export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  aiAnalysis: true,
});

export const insertManagerMeetingSchema = createInsertSchema(managerMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyReportMeetingSchema = createInsertSchema(weeklyReportMeetings).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



// 型定義
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect & {
  projectName?: string;
  caseName?: string;
};
export type InsertManagerMeeting = z.infer<typeof insertManagerMeetingSchema>;
export type ManagerMeeting = typeof managerMeetings.$inferSelect;
export type InsertWeeklyReportMeeting = z.infer<typeof insertWeeklyReportMeetingSchema>;
export type WeeklyReportMeeting = typeof weeklyReportMeetings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;
export type MonthlyReport = typeof monthlyReports.$inferSelect;

export const insertAdminConfirmationEmailSchema = createInsertSchema(adminConfirmationEmails).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminConfirmationEmail = z.infer<typeof insertAdminConfirmationEmailSchema>;
export type AdminConfirmationEmail = typeof adminConfirmationEmails.$inferSelect;

export const insertChatHistorySchema = createInsertSchema(chatHistories).omit({
  id: true,
  timestamp: true,
});
export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;
export type ChatHistory = typeof chatHistories.$inferSelect;
