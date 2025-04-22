import { cases, weeklyReports, type WeeklyReport, type InsertWeeklyReport, type Case, type InsertCase } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";

export interface IStorage {
  // 案件関連
  createCase(caseData: InsertCase): Promise<Case>;
  getCase(id: number): Promise<Case | undefined>;
  getAllCases(): Promise<Case[]>;
  getCasesByProject(projectName: string): Promise<Case[]>;
  updateCase(id: number, caseData: InsertCase): Promise<Case>;

  // 週次報告関連
  createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport>;
  getWeeklyReport(id: number): Promise<WeeklyReport | undefined>;
  getAllWeeklyReports(): Promise<WeeklyReport[]>;
  updateWeeklyReport(id: number, report: InsertWeeklyReport): Promise<WeeklyReport>;
  updateAIAnalysis(id: number, analysis: string): Promise<WeeklyReport>;
  getLatestReportByCase(caseId: number): Promise<WeeklyReport | undefined>;
  getWeeklyReportsByCase(caseId: number): Promise<WeeklyReport[]>;
}

export class DatabaseStorage implements IStorage {
  // 案件関連のメソッド
  async createCase(caseData: InsertCase): Promise<Case> {
    const [newCase] = await db.insert(cases).values(caseData).returning();
    return newCase;
  }

  async getCase(id: number): Promise<Case | undefined> {
    const [foundCase] = await db.select().from(cases).where(eq(cases.id, id));
    return foundCase;
  }

  async getAllCases(): Promise<Case[]> {
    return await db
      .select()
      .from(cases)
      .where(eq(cases.isDeleted, false))
      .orderBy(desc(cases.createdAt));
  }

  async getCasesByProject(projectName: string): Promise<Case[]> {
    return await db
      .select()
      .from(cases)
      .where(and(
        eq(cases.projectName, projectName),
        eq(cases.isDeleted, false)
      ))
      .orderBy(desc(cases.createdAt));
  }

  async updateCase(id: number, caseData: InsertCase): Promise<Case> {
    const [updated] = await db
      .update(cases)
      .set(caseData)
      .where(eq(cases.id, id))
      .returning();
    return updated;
  }

  // 週次報告関連のメソッド
  async createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport> {
    const [weeklyReport] = await db.insert(weeklyReports).values(report).returning();
    return weeklyReport;
  }

  async getWeeklyReport(id: number): Promise<WeeklyReport | undefined> {
    const [report] = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id));
    return report;
  }

  async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    // 削除されていない案件の週次報告のみを取得
    // まず削除されていない案件のIDを取得
    const activeCases = await db
      .select({ id: cases.id })
      .from(cases)
      .where(eq(cases.isDeleted, false));
    
    const activeCaseIds = activeCases.map(c => c.id);
    
    if (activeCaseIds.length === 0) {
      return [];
    }
    
    // 削除されていない案件に関する週次報告のみを取得
    const reports = await db
      .select()
      .from(weeklyReports)
      .where(
        activeCaseIds.length === 1 
          ? eq(weeklyReports.caseId, activeCaseIds[0])
          : inArray(weeklyReports.caseId, activeCaseIds)
      )
      .orderBy(desc(weeklyReports.reportPeriodStart));
    
    return reports;
  }

  async updateWeeklyReport(id: number, report: InsertWeeklyReport): Promise<WeeklyReport> {
    const [updated] = await db
      .update(weeklyReports)
      .set(report)
      .where(eq(weeklyReports.id, id))
      .returning();
    return updated;
  }

  async updateAIAnalysis(id: number, analysis: string): Promise<WeeklyReport> {
    const [updated] = await db
      .update(weeklyReports)
      .set({ aiAnalysis: analysis })
      .where(eq(weeklyReports.id, id))
      .returning();
    return updated;
  }

  async getLatestReportByCase(caseId: number): Promise<WeeklyReport | undefined> {
    const [report] = await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.caseId, caseId))
      .orderBy(desc(weeklyReports.reportPeriodEnd))
      .limit(1);

    return report;
  }

  async getWeeklyReportsByCase(caseId: number): Promise<WeeklyReport[]> {
    return await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.caseId, caseId))
      .orderBy(desc(weeklyReports.reportPeriodStart));
  }
}

export const storage = new DatabaseStorage();