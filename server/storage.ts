import { cases, weeklyReports, projects, users, managerMeetings, weeklyReportMeetings, systemSettings, type User, type InsertUser, type WeeklyReport, type InsertWeeklyReport, type Case, type InsertCase, type Project, type InsertProject, type ManagerMeeting, type InsertManagerMeeting, type WeeklyReportMeeting, type InsertWeeklyReportMeeting, type SystemSetting, type InsertSystemSetting } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, inArray, or, ne, sql, gte, lte, lt } from "drizzle-orm";

// データベース操作のリトライ機能
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Neon特有の接続エラーかチェック
      const isConnectionError = 
        error.message?.includes('Connection terminated unexpectedly') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`🔄 データベース接続エラー (試行 ${attempt}/${maxRetries}): ${error.message}`);
        console.log(`${delayMs * attempt}ms後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      
      // リトライしないエラーまたは最大試行回数に達した場合
      throw error;
    }
  }
  
  throw lastError;
}

// 検索用の型定義
type SearchResult = {
  id: number;
  type: 'project' | 'case' | 'report';
  title: string;
  description: string;
  content?: string;
  projectName?: string;
  caseName?: string;
  date?: string;
  match?: {
    field: string;
    text: string;
    highlight: [number, number][];
  }[];
  link: string;
};

type SearchSuggestion = {
  id: number;
  type: 'project' | 'case' | 'report';
  title: string;
  description?: string;
  link: string;
};

// 週次報告一覧用の軽量型定義
type WeeklyReportSummary = {
  id: number;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  reporterName: string;
  progressRate: number;
  progressStatus: string;
  projectName: string;
  caseName: string;
  createdAt: Date;
  caseId: number;
};

// プロジェクト一覧用の軽量型定義
type ProjectSummary = {
  id: number;
  name: string;
  overview: string | null;
  organization: string | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
};

export interface IStorage {
  // ユーザー関連
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User>;

  // プロジェクト関連
  createProject(projectData: InsertProject): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectByName(name: string): Promise<Project | undefined>;
  getAllProjects(includeDeleted?: boolean): Promise<Project[]>;
  getAllProjectsForList(includeDeleted?: boolean): Promise<ProjectSummary[]>;
  updateProject(id: number, projectData: InsertProject): Promise<Project>;
  deleteProject(id: number): Promise<Project>;

  restoreProject(id: number): Promise<Project>;

  // 案件関連
  createCase(caseData: InsertCase): Promise<Case>;
  getCase(id: number): Promise<Case | undefined>;
  getAllCases(includeDeleted?: boolean): Promise<Case[]>;
  getCasesByProject(projectName: string): Promise<Case[]>;
  getRecentlyUpdatedCases(limit?: number): Promise<Case[]>;
  updateCase(id: number, caseData: InsertCase): Promise<Case>;

  // 週次報告関連
  createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport>;
  getWeeklyReport(id: number): Promise<WeeklyReport | undefined>;
  getAllWeeklyReports(): Promise<WeeklyReport[]>;
  getAllWeeklyReportsForList(limit?: number): Promise<WeeklyReportSummary[]>; // 新規追加
  updateWeeklyReport(id: number, report: InsertWeeklyReport): Promise<WeeklyReport>;
  updateAIAnalysis(id: number, analysis: string): Promise<WeeklyReport>;
  getLatestReportByCase(caseId: number, excludeId?: number): Promise<WeeklyReport | undefined>;
  getPreviousReportByCase(caseId: number, beforeDate: string, excludeId?: number): Promise<WeeklyReport | undefined>;
  getWeeklyReportsByCase(caseId: number): Promise<WeeklyReport[]>;
  getWeeklyReportsByCases(caseIds: number[], startDate?: Date, endDate?: Date): Promise<WeeklyReport[]>;
  getRecentWeeklyReports(limit?: number): Promise<WeeklyReport[]>;

  // 検索関連
  search(query: string, type?: string): Promise<{ total: number, results: SearchResult[] }>;
  getSearchSuggestions(query: string): Promise<SearchSuggestion[]>;

  // マネージャ定例議事録関連
  createManagerMeeting(meetingData: InsertManagerMeeting): Promise<ManagerMeeting>;
  getManagerMeeting(id: number): Promise<ManagerMeeting | undefined>;
  getManagerMeetingsByProject(projectId: number, yearMonth?: string): Promise<ManagerMeeting[]>;
  updateManagerMeeting(id: number, meetingData: InsertManagerMeeting): Promise<ManagerMeeting>;
  deleteManagerMeeting(id: number): Promise<ManagerMeeting>;
  getAvailableMonths(projectId: number): Promise<string[]>;


}

export class DatabaseStorage implements IStorage {
  // ユーザー関連のメソッド
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // 検索関連のメソッド
  async search(query: string, type?: string): Promise<{ total: number, results: SearchResult[] }> {
    if (!query || query.trim() === '') {
      return { total: 0, results: [] };
    }

    // 全角スペースを半角に変換し、複数のスペースを単一のスペースに置換
    const normalizedQuery = query.trim().replace(/　/g, ' ').replace(/\s+/g, ' ');

    // 検索キーワードを分割
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 0);
    if (keywords.length === 0) {
      return { total: 0, results: [] };
    }

    const results: SearchResult[] = [];

    // プロジェクトの検索
    if (!type || type === 'project') {
      const projectResults = await this.searchProjects(keywords);
      results.push(...projectResults);
    }

    // 案件の検索
    if (!type || type === 'case') {
      const caseResults = await this.searchCases(keywords);
      results.push(...caseResults);
    }

    // 週次報告の検索
    if (!type || type === 'report') {
      const reportResults = await this.searchWeeklyReports(keywords);
      results.push(...reportResults);
    }

    // 結果を更新日時（作成日、更新日、レポート期間終了日など）の降順でソート
    results.sort((a, b) => {
      // プロジェクトと案件はcreatedAt/updatedAtの比較
      if ((a.type === 'project' || a.type === 'case') && (b.type === 'project' || b.type === 'case')) {
        // 日付文字列がない場合は現在の値を維持
        return 0;
      }

      // reportの場合は、dateプロパティ（reportPeriodEndの日付文字列）を比較
      if (a.type === 'report' && b.type === 'report') {
        if (a.date && b.date) {
          // 日付文字列を日付オブジェクトに変換して比較（降順）
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
      }

      // レポートはプロジェクトや案件よりも新しい（上位に表示）
      if (a.type === 'report' && b.type !== 'report') {
        return -1;
      }
      if (a.type !== 'report' && b.type === 'report') {
        return 1;
      }

      return 0;
    });

    return {
      total: results.length,
      results
    };
  }

  // 検索候補を取得するメソッド
  async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    if (!query || query.trim() === '') {
      return [];
    }

    // 全角スペースを半角に変換し、複数のスペースを単一のスペースに置換
    const normalizedQuery = query.trim().replace(/　/g, ' ').replace(/\s+/g, ' ');

    // 検索キーワードを分割
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 0);
    if (keywords.length === 0) {
      return [];
    }

    const suggestions: SearchSuggestion[] = [];
    const limit = 3; // 各カテゴリの最大表示数

    // プロジェクトの候補を取得
    const projectSuggestions = await this.getProjectSuggestions(keywords, limit);
    suggestions.push(...projectSuggestions);

    // 案件の候補を取得
    const caseSuggestions = await this.getCaseSuggestions(keywords, limit);
    suggestions.push(...caseSuggestions);

    // 週次報告の候補を取得
    const reportSuggestions = await this.getReportSuggestions(keywords, limit);
    suggestions.push(...reportSuggestions);

    // 最大10件に制限
    // 検索候補も更新日が新しい順（週次報告の場合はレポート期間終了日が新しい順）でソート
    suggestions.sort((a, b) => {
      // レポートはより新しい項目として常に優先
      if (a.type === 'report' && b.type !== 'report') {
        return -1;
      }
      if (a.type !== 'report' && b.type === 'report') {
        return 1;
      }

      // 同じタイプ内では、タイトルの日付情報（レポートの場合）や名前の順
      if (a.type === 'report' && b.type === 'report') {
        // レポートタイトルから日付を抽出して比較（降順）
        const aMatch = a.title.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
        const bMatch = b.title.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);

        if (aMatch && bMatch) {
          return new Date(bMatch[1]).getTime() - new Date(aMatch[1]).getTime();
        }
      }

      return 0;
    });

    return suggestions.slice(0, 10);
  }

  // プロジェクトを検索
  private async searchProjects(keywords: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 複数キーワードを含むSQL検索条件を構築
    const conditions = keywords.map(keyword => {
      const likePattern = `%${keyword}%`;
      return or(
        sql`lower(${projects.name}) like lower(${likePattern})`,
        sql`lower(${projects.overview}) like lower(${likePattern})`,
        sql`lower(${projects.organization}) like lower(${likePattern})`,
        sql`lower(${projects.personnel}) like lower(${likePattern})`,
        sql`lower(${projects.progress}) like lower(${likePattern})`,
        sql`lower(${projects.businessDetails}) like lower(${likePattern})`,
        sql`lower(${projects.issues}) like lower(${likePattern})`
      );
    });

    // 削除されていないプロジェクトのみ検索（最大20件）
    const foundProjects = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.isDeleted, false),
        ...conditions
      ))
      .limit(20);

    // 検索結果をフォーマット
    for (const project of foundProjects) {
      const matchFields: {
        field: string;
        text: string;
        highlight: [number, number][];
      }[] = [];

      // タイトルのマッチ
      if (this.containsAnyKeyword(project.name, keywords)) {
        matchFields.push({
          field: 'title',
          text: project.name,
          highlight: this.getHighlightPositions(project.name, keywords)
        });
      }

      // 概要のマッチ
      if (project.overview && this.containsAnyKeyword(project.overview, keywords)) {
        matchFields.push({
          field: 'description',
          text: this.truncateText(project.overview, 150),
          highlight: this.getHighlightPositions(this.truncateText(project.overview, 150), keywords)
        });
      }

      // 進捗情報のマッチ
      if (project.progress && this.containsAnyKeyword(project.progress, keywords)) {
        matchFields.push({
          field: 'content',
          text: this.truncateText(project.progress, 150),
          highlight: this.getHighlightPositions(this.truncateText(project.progress, 150), keywords)
        });
      }

      results.push({
        id: project.id,
        type: 'project',
        title: project.name,
        description: project.overview || '',
        match: matchFields,
        link: `/project/${project.id}`
      });
    }

    return results;
  }

  // 案件を検索
  private async searchCases(keywords: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 複数キーワードを含むSQL検索条件を構築
    const conditions = keywords.map(keyword => {
      const likePattern = `%${keyword}%`;
      return or(
        sql`lower(${cases.caseName}) like lower(${likePattern})`,
        sql`lower(${cases.description}) like lower(${likePattern})`,
        sql`lower(${cases.milestone}) like lower(${likePattern})`,
        sql`lower(${cases.projectName}) like lower(${likePattern})`
      );
    });

    // 削除されていない案件のみ検索（最大20件）
    const foundCases = await db
      .select()
      .from(cases)
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ))
      .limit(20);

    // 検索結果をフォーマット
    for (const case_ of foundCases) {
      const matchFields: {
        field: string;
        text: string;
        highlight: [number, number][];
      }[] = [];

      // タイトルのマッチ
      if (this.containsAnyKeyword(case_.caseName, keywords)) {
        matchFields.push({
          field: 'title',
          text: case_.caseName,
          highlight: this.getHighlightPositions(case_.caseName, keywords)
        });
      }

      // 説明のマッチ
      if (case_.description && this.containsAnyKeyword(case_.description, keywords)) {
        matchFields.push({
          field: 'description',
          text: this.truncateText(case_.description, 150),
          highlight: this.getHighlightPositions(this.truncateText(case_.description, 150), keywords)
        });
      }

      // マイルストーンのマッチ
      if (case_.milestone && this.containsAnyKeyword(case_.milestone, keywords)) {
        matchFields.push({
          field: 'milestone',
          text: this.truncateText(case_.milestone, 150),
          highlight: this.getHighlightPositions(this.truncateText(case_.milestone, 150), keywords)
        });
      }

      results.push({
        id: case_.id,
        type: 'case',
        title: case_.caseName,
        description: case_.description || '',
        projectName: case_.projectName,
        match: matchFields,
        link: `/case/view/${case_.id}`
      });
    }

    return results;
  }

  // 週次報告を検索（検索用に軽量化）
  private async searchWeeklyReports(keywords: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 複数キーワードを含むSQL検索条件を構築
    const conditions = keywords.map(keyword => {
      const likePattern = `%${keyword}%`;
      return or(
        sql`lower(${weeklyReports.reporterName}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.weeklyTasks}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.delayDetails}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.issues}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.riskSummary}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.riskCountermeasures}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.qualityDetails}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.testProgress}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.changeDetails}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.nextWeekPlan}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.supportRequests}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.aiAnalysis}) like lower(${likePattern})`
      );
    });

    // 検索結果を軽量化するため、必要最小限のフィールドのみ選択
    const foundReports = await db
      .select({
        id: weeklyReports.id,
        reportPeriodStart: weeklyReports.reportPeriodStart,
        reportPeriodEnd: weeklyReports.reportPeriodEnd,
        reporterName: weeklyReports.reporterName,
        weeklyTasks: weeklyReports.weeklyTasks,
        issues: weeklyReports.issues,
        aiAnalysis: weeklyReports.aiAnalysis,
        caseName: cases.caseName,
        projectName: cases.projectName
      })
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ))
      .limit(20); // 検索結果を最大20件に制限

    // 検索結果をフォーマット
    for (const report of foundReports) {
      const matchFields: {
        field: string;
        text: string;
        highlight: [number, number][];
      }[] = [];

      // 週次タスクのマッチ
      if (report.weeklyTasks && this.containsAnyKeyword(report.weeklyTasks, keywords)) {
        matchFields.push({
          field: 'content',
          text: this.truncateText(report.weeklyTasks, 150),
          highlight: this.getHighlightPositions(this.truncateText(report.weeklyTasks, 150), keywords)
        });
      }

      // 課題・問題点のマッチ
      if (report.issues && this.containsAnyKeyword(report.issues, keywords)) {
        matchFields.push({
          field: 'content',
          text: this.truncateText(report.issues, 150),
          highlight: this.getHighlightPositions(this.truncateText(report.issues, 150), keywords)
        });
      }

      // AIレポート分析のマッチ
      if (report.aiAnalysis && this.containsAnyKeyword(report.aiAnalysis, keywords)) {
        matchFields.push({
          field: 'content',
          text: this.truncateText(report.aiAnalysis, 150),
          highlight: this.getHighlightPositions(this.truncateText(report.aiAnalysis, 150), keywords)
        });
      }

      results.push({
        id: report.id,
        type: 'report',
        title: `${report.reportPeriodStart} 〜 ${report.reportPeriodEnd} レポート`,
        description: report.weeklyTasks || '',
        projectName: report.projectName,
        caseName: report.caseName,
        date: new Date(report.reportPeriodEnd).toLocaleDateString(),
        match: matchFields,
        link: `/reports/${report.id}`
      });
    }

    return results;
  }

  // プロジェクトの検索候補を取得
  private async getProjectSuggestions(keywords: string[], limit: number): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // 複数キーワードを含むSQL検索条件を構築
    const conditions = keywords.map(keyword => {
      const likePattern = `%${keyword}%`;
      return or(
        sql`lower(${projects.name}) like lower(${likePattern})`,
        sql`lower(${projects.overview}) like lower(${likePattern})`
      );
    });

    // 削除されていないプロジェクトのみ検索
    const foundProjects = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.isDeleted, false),
        ...conditions
      ))
      .limit(limit);

    // 検索結果をフォーマット
    for (const project of foundProjects) {
      suggestions.push({
        id: project.id,
        type: 'project',
        title: project.name,
        description: project.overview || '',
        link: `/project/${project.id}`
      });
    }

    return suggestions;
  }

  // 案件の検索候補を取得
  private async getCaseSuggestions(keywords: string[], limit: number): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // 複数キーワードを含むSQL検索条件を構築
    const conditions = keywords.map(keyword => {
      const likePattern = `%${keyword}%`;
      return or(
        sql`lower(${cases.caseName}) like lower(${likePattern})`,
        sql`lower(${cases.description}) like lower(${likePattern})`
      );
    });

    // 削除されていない案件のみ検索
    const foundCases = await db
      .select()
      .from(cases)
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ))
      .limit(limit);

    // 検索結果をフォーマット
    for (const case_ of foundCases) {
      suggestions.push({
        id: case_.id,
        type: 'case',
        title: case_.caseName,
        description: `${case_.projectName} / ${case_.description || '説明なし'}`,
        link: `/case/view/${case_.id}`
      });
    }

    return suggestions;
  }

  // 週次報告の検索候補を取得（軽量版）
  private async getReportSuggestions(keywords: string[], limit: number): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // 複数キーワードを含むSQL検索条件を構築
    const conditions = keywords.map(keyword => {
      const likePattern = `%${keyword}%`;
      return or(
        sql`lower(${weeklyReports.weeklyTasks}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.issues}) like lower(${likePattern})`,
        sql`lower(${weeklyReports.nextWeekPlan}) like lower(${likePattern})`
      );
    });

    // 検索候補用に必要最小限のフィールドのみ選択
    const foundReports = await db
      .select({
        id: weeklyReports.id,
        reportPeriodStart: weeklyReports.reportPeriodStart,
        reportPeriodEnd: weeklyReports.reportPeriodEnd,
        caseName: cases.caseName,
        projectName: cases.projectName
      })
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ))
      .orderBy(desc(weeklyReports.createdAt))
      .limit(limit);

    // 検索結果をフォーマット
    for (const report of foundReports) {
      const startDate = new Date(report.reportPeriodStart).toLocaleDateString();
      const endDate = new Date(report.reportPeriodEnd).toLocaleDateString();

      suggestions.push({
        id: report.id,
        type: 'report',
        title: `${startDate} 〜 ${endDate} レポート`,
        description: `${report.projectName} / ${report.caseName}`,
        link: `/reports/${report.id}`
      });
    }

    return suggestions;
  }

  // テキストを指定した長さに切り詰める
  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength) + '...';
  }

  // テキストが指定したキーワードのいずれかを含むかチェック
  private containsAnyKeyword(text: string, keywords: string[]): boolean {
    if (!text) return false;

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  // テキスト内のキーワードの位置を検出
  private getHighlightPositions(text: string, keywords: string[]): [number, number][] {
    if (!text) return [];

    const positions: [number, number][] = [];
    const lowerText = text.toLowerCase();

    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      let index = 0;

      while ((index = lowerText.indexOf(lowerKeyword, index)) !== -1) {
        positions.push([index, index + keyword.length]);
        index += keyword.length;
      }
    });

    // 位置をマージして重複を解消
    return this.mergeOverlappingPositions(positions);
  }

  // 重複する位置をマージ
  private mergeOverlappingPositions(positions: [number, number][]): [number, number][] {
    if (positions.length <= 1) return positions;

    // 開始位置でソート
    positions.sort((a, b) => a[0] - b[0]);

    const merged: [number, number][] = [];
    let current = positions[0];

    for (let i = 1; i < positions.length; i++) {
      const [start, end] = positions[i];

      // 現在の範囲と重複する場合はマージ
      if (start <= current[1]) {
        current[1] = Math.max(current[1], end);
      } else {
        // 重複しない場合は現在の範囲を保存して新しい範囲に移動
        merged.push(current);
        current = positions[i];
      }
    }

    merged.push(current);
    return merged;
  }
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

  async getAllProjectsForList(includeDeleted: boolean = false): Promise<ProjectSummary[]> {
    console.log(`[DEBUG] Using optimized getAllProjectsForList method`);
    
    const query = db
      .select({
        id: projects.id,
        name: projects.name,
        overview: projects.overview,
        organization: projects.organization,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        isDeleted: projects.isDeleted
      })
      .from(projects);

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

    // プロジェクトの削除時に、関連する案件も削除フラグを立てる
    await db
      .update(cases)
      .set({ 
        isDeleted: true
      })
      .where(eq(cases.projectName, deleted.name));

    return deleted;
  }


  async restoreProject(id: number): Promise<Project> {
    const [restored] = await db
      .update(projects)
      .set({ 
        isDeleted: false,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id))
      .returning();

    // プロジェクトの復活時に、関連する案件も復活させる
    await db
      .update(cases)
      .set({ 
        isDeleted: false
      })
      .where(eq(cases.projectName, restored.name));

    return restored;
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
    return withRetry(async () => {
      const query = db.select().from(cases);

      if (!includeDeleted) {
        query.where(eq(cases.isDeleted, false));
      }

      return await query.orderBy(desc(cases.createdAt));
    });
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

  async getRecentlyUpdatedCases(limit: number = 20): Promise<Case[]> {
    return await db
      .select()
      .from(cases)
      .where(eq(cases.isDeleted, false))
      .orderBy(desc(cases.createdAt))
      .limit(limit);
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

  // 【新規追加】週次報告一覧用の軽量メソッド（パフォーマンス最適化版）
  async getAllWeeklyReportsForList(limit: number = 50): Promise<WeeklyReportSummary[]> {
    console.log(`[DEBUG] Using optimized getAllWeeklyReportsForList method with limit: ${limit}`);
    
    const result = await db
      .select({
        id: weeklyReports.id,
        reportPeriodStart: weeklyReports.reportPeriodStart,
        reportPeriodEnd: weeklyReports.reportPeriodEnd,
        reporterName: weeklyReports.reporterName,
        progressRate: weeklyReports.progressRate,
        progressStatus: weeklyReports.progressStatus,
        createdAt: weeklyReports.createdAt,
        caseId: weeklyReports.caseId,
        // 案件情報（最小限）
        projectName: cases.projectName,
        caseName: cases.caseName
      })
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(eq(cases.isDeleted, false))
      .orderBy(desc(weeklyReports.reportPeriodStart))
      .limit(Math.min(limit, 100)); // 最大100件まで制限

    console.log(`[DEBUG] Retrieved ${result.length} weekly reports for list view`);
    return result;
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

  async deleteWeeklyReport(id: number): Promise<WeeklyReport> {
    return withRetry(async () => {
      const [deleted] = await db
        .delete(weeklyReports)
        .where(eq(weeklyReports.id, id))
        .returning();
      return deleted;
    });
  }

  async getLatestReportByCase(caseId: number, excludeId?: number): Promise<WeeklyReport | undefined> {
    return await withRetry(async () => {
      // 事前に案件が削除済みかチェック
      const [caseInfo] = await db
        .select()
        .from(cases)
        .where(eq(cases.id, caseId));

      // 削除済みの案件の場合はundefinedを返す
      if (caseInfo && caseInfo.isDeleted) {
        return undefined;
      }

      // 除外IDが指定されている場合はそれを除外
      let whereConditions = [eq(weeklyReports.caseId, caseId)];
      if (excludeId) {
        whereConditions.push(ne(weeklyReports.id, excludeId));
      }

      const query = db
        .select()
        .from(weeklyReports)
        .where(and(...whereConditions));

      const [report] = await query.orderBy(desc(weeklyReports.reportPeriodStart));

      return report;
    });
  }

  async getPreviousReportByCase(caseId: number, beforeDate: string, excludeId?: number): Promise<WeeklyReport | undefined> {
    return await withRetry(async () => {
      console.log("getPreviousReportByCase開始:", { caseId, beforeDate, excludeId });
      
      // 事前に案件が削除済みかチェック
      const [caseInfo] = await db
        .select()
        .from(cases)
        .where(eq(cases.id, caseId));

      console.log("案件情報:", { found: !!caseInfo, isDeleted: caseInfo?.isDeleted });

      // 削除済みの案件の場合はundefinedを返す
      if (caseInfo && caseInfo.isDeleted) {
        console.log("削除済み案件のため処理を終了");
        return undefined;
      }

      // デバッグ: この案件のすべての報告を確認
      const allReports = await db
        .select({
          id: weeklyReports.id,
          reportPeriodStart: weeklyReports.reportPeriodStart,
          reportPeriodEnd: weeklyReports.reportPeriodEnd
        })
        .from(weeklyReports)
        .where(eq(weeklyReports.caseId, caseId))
        .orderBy(desc(weeklyReports.reportPeriodStart));
      
      console.log("この案件のすべての報告:", allReports);

      // 指定された日付より前の報告を取得
      let whereConditions = [
        eq(weeklyReports.caseId, caseId),
        lt(weeklyReports.reportPeriodStart, beforeDate)
      ];
      if (excludeId) {
        whereConditions.push(ne(weeklyReports.id, excludeId));
      }

      console.log("検索条件:", {
        caseId,
        beforeDate,
        excludeId,
        sqlCondition: `caseId=${caseId} AND reportPeriodStart<'${beforeDate}'${excludeId ? ` AND id!=${excludeId}` : ''}`
      });

      const query = db
        .select()
        .from(weeklyReports)
        .where(and(...whereConditions));

      const results = await query.orderBy(desc(weeklyReports.reportPeriodStart));
      const [report] = results;

      console.log("検索結果:", {
        foundCount: results.length,
        firstResult: report ? {
          id: report.id,
          reportPeriod: `${report.reportPeriodStart} - ${report.reportPeriodEnd}`
        } : null
      });

      return report;
    });
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

  async getWeeklyReportsByCases(caseIds: number[], startDate?: Date, endDate?: Date): Promise<WeeklyReport[]> {
    if (caseIds.length === 0) {
      return [];
    }

    // WHERE条件を構築
    const conditions = [
      inArray(weeklyReports.caseId, caseIds),
      eq(cases.isDeleted, false)
    ];

    // 日付範囲でフィルタリング
    if (startDate && endDate) {
      conditions.push(
        gte(weeklyReports.reportPeriodEnd, startDate.toISOString().split('T')[0]),
        lte(weeklyReports.reportPeriodEnd, endDate.toISOString().split('T')[0])
      );
    }

    const result = await db
      .select()
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(and(...conditions))
      .orderBy(desc(weeklyReports.reportPeriodStart));
    
    // 週次報告のデータのみを返す（JOINしたcasesデータは除く）
    return result.map(item => item.weekly_reports);
  }

  async getRecentWeeklyReports(limit: number = 20): Promise<WeeklyReport[]> {
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
      .orderBy(desc(weeklyReports.createdAt))
      .limit(limit);

    return result as unknown as WeeklyReport[];
  }

  // マネージャ定例議事録関連のメソッド
  async createManagerMeeting(meetingData: InsertManagerMeeting): Promise<ManagerMeeting> {
    const [meeting] = await db
      .insert(managerMeetings)
      .values(meetingData)
      .returning();
    return meeting;
  }

  async getManagerMeeting(id: number): Promise<ManagerMeeting | undefined> {
    const [meeting] = await db
      .select()
      .from(managerMeetings)
      .where(eq(managerMeetings.id, id));
    return meeting;
  }

  async getManagerMeetingsByProject(projectId: number, yearMonth?: string): Promise<ManagerMeeting[]> {
    const whereConditions = yearMonth 
      ? and(
          eq(managerMeetings.projectId, projectId),
          eq(managerMeetings.yearMonth, yearMonth)
        )
      : eq(managerMeetings.projectId, projectId);

    return await db
      .select()
      .from(managerMeetings)
      .where(whereConditions)
      .orderBy(desc(managerMeetings.meetingDate));
  }

  async updateManagerMeeting(id: number, meetingData: InsertManagerMeeting): Promise<ManagerMeeting> {
    const [updated] = await db
      .update(managerMeetings)
      .set({ ...meetingData, updatedAt: new Date() })
      .where(eq(managerMeetings.id, id))
      .returning();
    return updated;
  }

  async deleteManagerMeeting(id: number): Promise<ManagerMeeting> {
    const [deleted] = await db
      .delete(managerMeetings)
      .where(eq(managerMeetings.id, id))
      .returning();
    return deleted;
  }

  // プロジェクトの利用可能月を取得
  async getAvailableMonths(projectId: number): Promise<string[]> {
    try {
      const result = await db
        .selectDistinct({
          yearMonth: managerMeetings.yearMonth
        })
        .from(managerMeetings)
        .where(eq(managerMeetings.projectId, projectId))
        .orderBy(desc(managerMeetings.yearMonth));

      console.log(`[DEBUG] Available months query result for project ${projectId}:`, result); // 追加
      return result.map(row => row.yearMonth).filter(Boolean);
    } catch (error) {
      console.error("Error fetching available months:", error);
      return [];
    }
  }

  // 週次報告会議関連のメソッド
  async createWeeklyReportMeeting(meetingData: InsertWeeklyReportMeeting): Promise<WeeklyReportMeeting> {
    const [meeting] = await db
      .insert(weeklyReportMeetings)
      .values(meetingData)
      .returning();
    return meeting;
  }

  async upsertWeeklyReportMeeting(meetingData: InsertWeeklyReportMeeting): Promise<WeeklyReportMeeting> {
    const [meeting] = await db
      .insert(weeklyReportMeetings)
      .values(meetingData)
      .onConflictDoUpdate({
        target: weeklyReportMeetings.weeklyReportId,
        set: {
          meetingDate: meetingData.meetingDate,
          title: meetingData.title,
          content: meetingData.content,
          modifiedBy: meetingData.modifiedBy,
          originalData: meetingData.originalData,
          modifiedData: meetingData.modifiedData,
          createdAt: new Date(), // 最新の更新時刻を記録
        }
      })
      .returning();
    return meeting;
  }

  async getWeeklyReportMeeting(id: number): Promise<WeeklyReportMeeting | undefined> {
    const [meeting] = await db
      .select()
      .from(weeklyReportMeetings)
      .where(eq(weeklyReportMeetings.id, id));
    return meeting;
  }

  async getWeeklyReportMeetingsByReportId(weeklyReportId: number): Promise<WeeklyReportMeeting[]> {
    return await db
      .select()
      .from(weeklyReportMeetings)
      .where(eq(weeklyReportMeetings.weeklyReportId, weeklyReportId))
      .orderBy(desc(weeklyReportMeetings.createdAt));
  }

  async updateWeeklyReportMeeting(id: number, meetingData: Partial<InsertWeeklyReportMeeting>): Promise<WeeklyReportMeeting> {
    const [updated] = await db
      .update(weeklyReportMeetings)
      .set(meetingData)
      .where(eq(weeklyReportMeetings.id, id))
      .returning();
    return updated;
  }

  async deleteWeeklyReportMeeting(id: number): Promise<WeeklyReportMeeting> {
    const [deleted] = await db
      .delete(weeklyReportMeetings)
      .where(eq(weeklyReportMeetings.id, id))
      .returning();
    return deleted;
  }

  // システム設定の取得
  async getSystemSetting(key: string): Promise<SystemSetting | null> {
    return await withRetry(async () => {
      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key));
      return setting || null;
    });
  }

  // 全システム設定の取得
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await withRetry(async () => {
      return await db
        .select()
        .from(systemSettings)
        .orderBy(systemSettings.key);
    });
  }

  // リアルタイム分析用AI設定の取得
  async getRealtimeAnalysisConfig(): Promise<{
    provider: string;
    groqModel?: string;
  }> {
    return await withRetry(async () => {
      const provider = await this.getSystemSetting('REALTIME_AI_PROVIDER') || { value: 'gemini' };
      const groqModel = await this.getSystemSetting('REALTIME_GROQ_MODEL') || { value: 'qwen/qwen3-32b' };

      return {
        provider: provider.value,
        groqModel: groqModel.value,
      };
    });
  }

  // システム設定の更新または作成
  async setSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
    return await withRetry(async () => {
      const [setting] = await db
        .insert(systemSettings)
        .values({
          key,
          value,
          description,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value,
            description,
            updatedAt: new Date(),
          },
        })
        .returning();
      return setting;
    });
  }

  // システム設定の削除
  async deleteSystemSetting(key: string): Promise<SystemSetting | null> {
    return await withRetry(async () => {
      const [deleted] = await db
        .delete(systemSettings)
        .where(eq(systemSettings.key, key))
        .returning();
      return deleted || null;
    });
  }


}

export const storage = new DatabaseStorage();
