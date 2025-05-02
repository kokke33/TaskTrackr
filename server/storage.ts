import { cases, weeklyReports, projects, type WeeklyReport, type InsertWeeklyReport, type Case, type InsertCase, type Project, type InsertProject } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, inArray, or, ne, sql } from "drizzle-orm";

export interface IStorage {
  // プロジェクト関連
  createProject(projectData: InsertProject): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectByName(name: string): Promise<Project | undefined>;
  getAllProjects(includeDeleted?: boolean): Promise<Project[]>;
  updateProject(id: number, projectData: InsertProject): Promise<Project>;
  deleteProject(id: number): Promise<Project>;
  
  // 案件関連
  createCase(caseData: InsertCase): Promise<Case>;
  getCase(id: number): Promise<Case | undefined>;
  getAllCases(includeDeleted?: boolean): Promise<Case[]>;
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
  // プロジェクト関連のメソッド
  async createProject(projectData: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values({
      ...projectData,
      updatedAt: new Date()
    }).returning();
    return newProject;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectByName(name: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.name, name));
    return project;
  }

  async getAllProjects(includeDeleted: boolean = false): Promise<Project[]> {
    const query = db.select().from(projects);
    
    if (!includeDeleted) {
      query.where(eq(projects.isDeleted, false));
    }
    
    return await query.orderBy(desc(projects.updatedAt));
  }

  async updateProject(id: number, projectData: InsertProject): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({
        ...projectData,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number): Promise<Project> {
    const [deleted] = await db
      .update(projects)
      .set({ 
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id))
      .returning();
    return deleted;
  }
  
  // 案件関連のメソッド
  async createCase(caseData: InsertCase): Promise<Case> {
    const [newCase] = await db.insert(cases).values(caseData).returning();
    return newCase;
  }

  async getCase(id: number): Promise<Case | undefined> {
    const [foundCase] = await db.select().from(cases).where(eq(cases.id, id));
    return foundCase;
  }

  async getAllCases(includeDeleted: boolean = false): Promise<Case[]> {
    const query = db.select().from(cases);
    
    if (!includeDeleted) {
      query.where(eq(cases.isDeleted, false));
    }
    
    return await query.orderBy(desc(cases.createdAt));
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
    // JOINを使って削除されていない案件の週次報告のみを取得
    const result = await db
      .select({
        id: weeklyReports.id,
        reportPeriodStart: weeklyReports.reportPeriodStart,
        reportPeriodEnd: weeklyReports.reportPeriodEnd,
        caseId: weeklyReports.caseId,
        reporterName: weeklyReports.reporterName,
        weeklyTasks: weeklyReports.weeklyTasks,
        progressRate: weeklyReports.progressRate,
        progressStatus: weeklyReports.progressStatus,
        delayIssues: weeklyReports.delayIssues,
        delayDetails: weeklyReports.delayDetails,
        issues: weeklyReports.issues,
        newRisks: weeklyReports.newRisks,
        riskSummary: weeklyReports.riskSummary,
        riskCountermeasures: weeklyReports.riskCountermeasures,
        riskLevel: weeklyReports.riskLevel,
        qualityConcerns: weeklyReports.qualityConcerns,
        qualityDetails: weeklyReports.qualityDetails,
        testProgress: weeklyReports.testProgress,
        changes: weeklyReports.changes,
        changeDetails: weeklyReports.changeDetails,
        nextWeekPlan: weeklyReports.nextWeekPlan,
        supportRequests: weeklyReports.supportRequests,
        resourceConcerns: weeklyReports.resourceConcerns,
        resourceDetails: weeklyReports.resourceDetails,
        customerIssues: weeklyReports.customerIssues,
        customerDetails: weeklyReports.customerDetails,
        environmentIssues: weeklyReports.environmentIssues,
        environmentDetails: weeklyReports.environmentDetails,
        costIssues: weeklyReports.costIssues,
        costDetails: weeklyReports.costDetails,
        knowledgeIssues: weeklyReports.knowledgeIssues,
        knowledgeDetails: weeklyReports.knowledgeDetails,
        trainingIssues: weeklyReports.trainingIssues,
        trainingDetails: weeklyReports.trainingDetails,
        urgentIssues: weeklyReports.urgentIssues,
        urgentDetails: weeklyReports.urgentDetails,
        businessOpportunities: weeklyReports.businessOpportunities,
        businessDetails: weeklyReports.businessDetails,
        aiAnalysis: weeklyReports.aiAnalysis,
        createdAt: weeklyReports.createdAt,
        // 検索と表示のための案件のプロパティ
        projectName: cases.projectName,
        caseName: cases.caseName
      })
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(eq(cases.isDeleted, false))
      .orderBy(desc(weeklyReports.reportPeriodStart));
    
    return result as unknown as WeeklyReport[];
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
    // 事前に案件が削除済みかチェック
    const [caseInfo] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, caseId));
    
    // 削除済みの案件の場合はundefinedを返す
    if (caseInfo && caseInfo.isDeleted) {
      return undefined;
    }
    
    const [report] = await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.caseId, caseId))
      .orderBy(desc(weeklyReports.reportPeriodEnd))
      .limit(1);

    return report;
  }

  async getWeeklyReportsByCase(caseId: number): Promise<WeeklyReport[]> {
    // 事前に案件が削除済みかチェック
    const [caseInfo] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, caseId));
    
    // 削除済みの案件の場合は空の配列を返す
    if (caseInfo && caseInfo.isDeleted) {
      return [];
    }

    return await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.caseId, caseId))
      .orderBy(desc(weeklyReports.reportPeriodStart));
  }
}

export const storage = new DatabaseStorage();