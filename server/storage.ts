import { cases, weeklyReports, projects, users, type User, type InsertUser, type WeeklyReport, type InsertWeeklyReport, type Case, type InsertCase, type Project, type InsertProject } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, inArray, or, ne, sql } from "drizzle-orm";

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
  updateWeeklyReport(id: number, report: InsertWeeklyReport): Promise<WeeklyReport>;
  updateAIAnalysis(id: number, analysis: string): Promise<WeeklyReport>;
  getLatestReportByCase(caseId: number): Promise<WeeklyReport | undefined>;
  getWeeklyReportsByCase(caseId: number): Promise<WeeklyReport[]>;
  getRecentWeeklyReports(limit?: number): Promise<WeeklyReport[]>;

  // 検索関連
  search(query: string, type?: string): Promise<{ total: number, results: SearchResult[] }>;
  getSearchSuggestions(query: string): Promise<SearchSuggestion[]>;
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

    // 削除されていないプロジェクトのみ検索
    const foundProjects = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.isDeleted, false),
        ...conditions
      ));

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

    // 削除されていない案件のみ検索
    const foundCases = await db
      .select()
      .from(cases)
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ));

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

  // 週次報告を検索
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

    // 関連する案件のJOINクエリを作成
    const foundReports = await db
      .select({
        report: weeklyReports,
        caseName: cases.caseName,
        projectName: cases.projectName
      })
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ));

    // 検索結果をフォーマット
    for (const { report, caseName, projectName } of foundReports) {
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
        projectName,
        caseName,
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

  // 週次報告の検索候補を取得
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

    // 関連する案件のJOINクエリを作成（最新の報告を先に表示）
    const foundReports = await db
      .select({
        report: weeklyReports,
        caseName: cases.caseName,
        projectName: cases.projectName
      })
      .from(weeklyReports)
      .innerJoin(cases, eq(weeklyReports.caseId, cases.id))
      .where(and(
        eq(cases.isDeleted, false),
        ...conditions
      ))
      .orderBy(desc(weeklyReports.reportPeriodEnd))
      .limit(limit);

    // 検索結果をフォーマット
    for (const { report, caseName, projectName } of foundReports) {
      const startDate = new Date(report.reportPeriodStart).toLocaleDateString();
      const endDate = new Date(report.reportPeriodEnd).toLocaleDateString();

      suggestions.push({
        id: report.id,
        type: 'report',
        title: `${startDate} 〜 ${endDate} レポート`,
        description: `${projectName} / ${caseName}`,
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


  async restoreProject(id: number): Promise<Project> {
    const [restored] = await db
      .update(projects)
      .set({ 
        isDeleted: false,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id))
      .returning();
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

  async getRecentlyUpdatedCases(limit: number = 20): Promise<Case[]> {
    return await db
      .select()
      .from(cases)
      .where(eq(cases.isDeleted, false))
      .orderBy(desc(cases.createdAt))
      .limit(limit);
  }

  async getRecentWeeklyReports(limit: number = 20): Promise<WeeklyReport[]> {
    // JOINを使って初めから関連する案件情報も取得する
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
        issues: weeklyReports.issues,
        createdAt: weeklyReports.createdAt,
        // 案件情報
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
      .orderBy(desc(weeklyReports.reportPeriodEnd))
      .limit(limit);

    return result as unknown as WeeklyReport[];
  }
}

export const storage = new DatabaseStorage();