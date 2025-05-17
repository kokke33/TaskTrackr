import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWeeklyReportSchema, insertCaseSchema, insertProjectSchema } from "@shared/schema";
import OpenAI from "openai";
import passport from "passport";
import { isAuthenticated, isAdmin } from "./auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // 検索API
  app.get('/api/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      const type = req.query.type as string | undefined;
      
      if (!query || query.trim() === '') {
        return res.json({ total: 0, results: [] });
      }
      
      const searchResults = await storage.search(query, type);
      return res.json(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({ error: '検索中にエラーが発生しました' });
    }
  });
  
  // 検索サジェストAPI
  app.get('/api/search/suggest', async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query || query.trim() === '') {
        return res.json([]);
      }
      
      const suggestions = await storage.getSearchSuggestions(query);
      return res.json(suggestions);
    } catch (error) {
      console.error('Search suggestion error:', error);
      return res.status(500).json({ error: 'サジェスト取得中にエラーが発生しました' });
    }
  });
  // 認証関連のエンドポイント
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // ログのデバッグ情報を出力
    if (req.user) {
      console.log("Login success - user info:", {
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin
      });
    }
    
    // ユーザー情報と成功メッセージを返す
    res.json({ 
      message: "ログイン成功",
      user: req.user
    });
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "ログアウト成功" });
    });
  });

  app.get("/api/check-auth", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      // セッションに保存されているユーザー情報をログ出力
      const user = req.user as { id: number, username: string, isAdmin?: boolean };
      console.log("Check-auth - authenticated user info:", {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      });
      
      // 明確に管理者フラグを含めて返す
      res.json({ 
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          isAdmin: !!user.isAdmin // booleanとして確実に返す
        }
      });
    } else {
      console.log("Check-auth - not authenticated");
      res.status(401).json({
        authenticated: false,
        message: "認証されていません。再度ログインしてください。",
      });
    }
  });

  // 認証が必要なエンドポイントにミドルウェアを適用
  app.use("/api/projects", isAuthenticated);
  app.use("/api/cases", isAuthenticated);
  app.use("/api/weekly-reports", isAuthenticated);

  // プロジェクト関連のエンドポイント
  app.post("/api/projects", isAdmin, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(projectData);
      res.json(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "無効なプロジェクトデータです" });
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const projects = await storage.getAllProjects(includeDeleted);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "プロジェクト一覧の取得に失敗しました" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`[DEBUG] GET /api/projects/${id} - Query params:`, req.query);
      console.log(`[DEBUG] User:`, req.user);
      
      const project = await storage.getProject(id);
      if (!project) {
        res.status(404).json({ message: "プロジェクトが見つかりません" });
        return;
      }
      
      // 編集用データは管理者のみに提供し、一般ユーザーには表示用データのみ提供
      const user = req.user as { id: number, username: string, isAdmin?: boolean };
      if (req.query.edit === "true") {
        console.log(`[DEBUG] Edit mode requested. User isAdmin:`, user?.isAdmin);
        if (!user?.isAdmin) {
          console.log(`[DEBUG] Access denied: non-admin user tried to access edit mode`);
          return res.status(403).json({ message: "プロジェクト編集は管理者のみ許可されています" });
        }
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "プロジェクトの取得に失敗しました" });
    }
  });

  app.get("/api/projects/by-name/:name", async (req, res) => {
    try {
      const name = req.params.name;
      console.log(`[DEBUG] GET /api/projects/by-name/${name} - Query params:`, req.query);
      console.log(`[DEBUG] User:`, req.user);
      
      const project = await storage.getProjectByName(name);
      if (!project) {
        res.status(404).json({ message: "プロジェクトが見つかりません" });
        return;
      }
      
      // 編集用データは管理者のみに提供し、一般ユーザーには表示用データのみ提供
      const user = req.user as { id: number, username: string, isAdmin?: boolean };
      if (req.query.edit === "true") {
        console.log(`[DEBUG] Edit mode requested by name. User isAdmin:`, user?.isAdmin);
        if (!user?.isAdmin) {
          console.log(`[DEBUG] Access denied: non-admin user tried to access edit mode`);
          return res.status(403).json({ message: "プロジェクト編集は管理者のみ許可されています" });
        }
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project by name:", error);
      res.status(500).json({ message: "プロジェクトの取得に失敗しました" });
    }
  });

  app.put("/api/projects/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        res.status(404).json({ message: "プロジェクトが見つかりません" });
        return;
      }
      const projectData = insertProjectSchema.parse(req.body);
      const updatedProject = await storage.updateProject(id, projectData);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "プロジェクトの更新に失敗しました" });
    }
  });
  
  // 最近更新された週次報告一覧を取得
  app.get("/api/recent-reports", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const recentReports = await storage.getRecentWeeklyReports(limit);
      res.json(recentReports);
    } catch (error) {
      console.error("Error fetching recent reports:", error);
      res.status(500).json({ message: "最近の週次報告一覧の取得に失敗しました" });
    }
  });

  app.delete("/api/projects/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        res.status(404).json({ message: "プロジェクトが見つかりません" });
        return;
      }
      
      const deletedProject = await storage.deleteProject(id);
      res.json(deletedProject);
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "プロジェクトの削除に失敗しました" });
    }
  });
  
  // プロジェクト復活のエンドポイント
  app.post("/api/projects/:id/restore", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        res.status(404).json({ message: "プロジェクトが見つかりません" });
        return;
      }
      
      // プロジェクトが削除されていない場合
      if (!existingProject.isDeleted) {
        return res.status(400).json({ message: "このプロジェクトは削除されていません" });
      }
      
      const restoredProject = await storage.restoreProject(id);
      res.json(restoredProject);
    } catch (error) {
      console.error("Error restoring project:", error);
      res.status(500).json({ message: "プロジェクトの復元に失敗しました" });
    }
  });

  // 案件関連のエンドポイント
  app.post("/api/cases", isAdmin, async (req, res) => {
    try {
      const caseData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(caseData);
      res.json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(400).json({ message: "無効なケースデータです" });
    }
  });

  app.get("/api/cases", async (req, res) => {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const cases = await storage.getAllCases(includeDeleted);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  app.get("/api/cases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const foundCase = await storage.getCase(id);
      if (!foundCase) {
        res.status(404).json({ message: "Case not found" });
        return;
      }
      res.json(foundCase);
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  app.put("/api/cases/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingCase = await storage.getCase(id);
      if (!existingCase) {
        res.status(404).json({ message: "Case not found" });
        return;
      }
      const caseData = insertCaseSchema.parse(req.body);
      const updatedCase = await storage.updateCase(id, caseData);
      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(400).json({ message: "Failed to update case" });
    }
  });
  
  // マイルストーン更新専用の簡易エンドポイント
  app.patch("/api/cases/:id/milestone", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingCase = await storage.getCase(id);
      if (!existingCase) {
        res.status(404).json({ message: "案件が見つかりません" });
        return;
      }
      
      const { milestone } = req.body;
      if (milestone === undefined) {
        res.status(400).json({ message: "マイルストーン情報が含まれていません" });
        return;
      }
      
      // 既存のデータを保持しつつマイルストーンのみ更新
      const updatedCase = await storage.updateCase(id, {
        ...existingCase,
        milestone
      });
      
      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(400).json({ message: "マイルストーンの更新に失敗しました" });
    }
  });

  // 週次報告関連のエンドポイント
  app.get("/api/weekly-reports/latest/:projectName", async (req, res) => {
    try {
      const { projectName } = req.params;
      const reports = await storage.getLatestReportByCase(
        parseInt(projectName),
      );
      if (!reports) {
        res.status(404).json({ message: "No reports found for this project" });
        return;
      }
      res.json(reports);
    } catch (error) {
      console.error("Error fetching latest report:", error);
      res.status(500).json({ message: "Failed to fetch latest report" });
    }
  });
  
  // プロジェクト別月次報告書を生成するエンドポイント
  app.get("/api/monthly-summary/:projectName", async (req, res) => {
    try {
      const { projectName } = req.params;
      const { startDate: startDateQuery, endDate: endDateQuery, caseId } = req.query;
      
      // クエリパラメータから日付を取得、なければデフォルトで直近1か月を使用
      let endDate = new Date();
      let startDate = new Date();
      
      if (endDateQuery && typeof endDateQuery === 'string') {
        endDate = new Date(endDateQuery);
      }
      
      if (startDateQuery && typeof startDateQuery === 'string') {
        startDate = new Date(startDateQuery);
      } else {
        // デフォルトで直近1か月
        startDate.setMonth(startDate.getMonth() - 1);
      }
      
      // プロジェクト名がカンマ区切りの場合は複数プロジェクトとして処理
      const projectNames = projectName.split(',');
      let allProjectCases: any[] = [];
      
      // 各プロジェクトの案件を取得して結合
      for (const name of projectNames) {
        const projectCases = await storage.getCasesByProject(name.trim());
        allProjectCases.push(...projectCases);
      }
      
      if (allProjectCases.length === 0) {
        res.status(404).json({ message: "指定されたプロジェクトに関連する案件が見つかりません" });
        return;
      }
      
      // 選択された案件IDがある場合はフィルタリング
      let targetCaseIds: number[] = [];
      
      if (caseId) {
        // 複数の案件IDが渡される場合は配列として処理
        if (Array.isArray(caseId)) {
          targetCaseIds = caseId.map(id => parseInt(id.toString())).filter(id => !isNaN(id));
        } else {
          // 単一の案件IDの場合
          const parsedId = parseInt(caseId.toString());
          if (!isNaN(parsedId)) {
            targetCaseIds = [parsedId];
          }
        }
        
        // 対象の案件が取得したプロジェクトに含まれるものだけに絞る
        const allProjectCaseIds = allProjectCases.map(c => c.id);
        targetCaseIds = targetCaseIds.filter(id => allProjectCaseIds.includes(id));
      }
      
      // 対象の案件IDがない場合は全ての案件を対象にする
      if (targetCaseIds.length === 0) {
        targetCaseIds = allProjectCases.map(c => c.id);
      }
      
      // 対象案件に対して週次報告を取得
      const lastMonthReports = [];
      const casesWithReports: number[] = []; // データがある案件のIDを記録
      
      for (const caseId of targetCaseIds) {
        const reports = await storage.getWeeklyReportsByCase(caseId);
        
        // 日付でフィルタリング（指定期間のものだけ）
        const filteredReports = reports.filter(report => {
          const reportDate = new Date(report.reportPeriodEnd);
          return reportDate >= startDate && reportDate <= endDate;
        });
        
        // 報告があれば、その案件をデータありとして記録
        if (filteredReports.length > 0) {
          casesWithReports.push(caseId);
          lastMonthReports.push(...filteredReports);
        }
      }
      
      if (lastMonthReports.length === 0 || casesWithReports.length === 0) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`[ERROR] No reports found for the period ${startDateStr} to ${endDateStr}`);
        res.status(404).json({ 
          message: `指定された期間(${startDateStr}～${endDateStr})の週次報告が見つかりません` 
        });
        return;
      }
      
      console.log(`[DEBUG] Found ${lastMonthReports.length} reports for ${casesWithReports.length} cases`);
      
      
      // データがある案件に関連するプロジェクト名だけを抽出
      const projectsWithData: string[] = Array.from(new Set(
        allProjectCases
          .filter(c => casesWithReports.includes(c.id))
          .map(c => c.projectName)
      ));
      
      // 複数プロジェクトの場合は、プロジェクト名を「複数プロジェクト」とする
      const displayProjectName = projectsWithData.length > 1 
        ? `複数プロジェクト (${projectsWithData.join(', ')})` 
        : projectsWithData[0] || projectName;
      
      // データがある案件のみをOpenAIに渡す
      const casesWithData = allProjectCases.filter(c => casesWithReports.includes(c.id));
      
      // OpenAIを使用して月次レポートを生成
      const summary = await generateMonthlySummary(displayProjectName, lastMonthReports, casesWithData);
      
      res.json({ 
        projectName: displayProjectName,
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        summary,
        reportCount: lastMonthReports.length,
        caseCount: casesWithData.length
      });
    } catch (error) {
      console.error("Error generating monthly summary:", error);
      res.status(500).json({ message: "月次報告書の生成に失敗しました" });
    }
  });
  
  // 月次レポート生成のためのインプットデータを取得するAPIエンドポイント
  app.get("/api/monthly-summary-input/:projectName", async (req, res) => {
    try {
      const { projectName } = req.params;
      const { startDate: startDateQuery, endDate: endDateQuery, caseId } = req.query;
      
      // クエリパラメータから日付を取得、なければデフォルトで直近1か月を使用
      let endDate = new Date();
      let startDate = new Date();
      
      if (endDateQuery && typeof endDateQuery === 'string') {
        endDate = new Date(endDateQuery);
      }
      
      if (startDateQuery && typeof startDateQuery === 'string') {
        startDate = new Date(startDateQuery);
      } else {
        // デフォルトで直近1か月
        startDate.setMonth(startDate.getMonth() - 1);
      }
      
      // プロジェクト名がカンマ区切りの場合は複数プロジェクトとして処理
      const projectNames = projectName.split(',');
      let allProjectCases: any[] = [];
      
      // 各プロジェクトの案件を取得して結合
      for (const name of projectNames) {
        const projectCases = await storage.getCasesByProject(name.trim());
        allProjectCases.push(...projectCases);
      }
      
      if (allProjectCases.length === 0) {
        res.status(404).json({ message: "指定されたプロジェクトに関連する案件が見つかりません" });
        return;
      }
      
      // 選択された案件IDがある場合はフィルタリング
      let targetCaseIds: number[] = [];
      
      if (caseId) {
        // 複数の案件IDが渡される場合は配列として処理
        if (Array.isArray(caseId)) {
          targetCaseIds = caseId.map(id => parseInt(id.toString())).filter(id => !isNaN(id));
        } else {
          // 単一の案件IDの場合
          const parsedId = parseInt(caseId.toString());
          if (!isNaN(parsedId)) {
            targetCaseIds = [parsedId];
          }
        }
        
        // 対象の案件が取得したプロジェクトに含まれるものだけに絞る
        const allProjectCaseIds = allProjectCases.map(c => c.id);
        targetCaseIds = targetCaseIds.filter(id => allProjectCaseIds.includes(id));
      }
      
      // 対象の案件IDがない場合は全ての案件を対象にする
      if (targetCaseIds.length === 0) {
        targetCaseIds = allProjectCases.map(c => c.id);
      }
      
      // 対象案件に対して週次報告を取得
      const periodReports = [];
      const casesWithReports: number[] = []; // データがある案件のIDを記録
      
      for (const caseId of targetCaseIds) {
        const reports = await storage.getWeeklyReportsByCase(caseId);
        console.log(`[DEBUG] Case ID: ${caseId}, Reports count: ${reports.length}`);
        
        // 日付でフィルタリング
        const filteredReports = reports.filter(report => {
          const reportDate = new Date(report.reportPeriodEnd);
          return reportDate >= startDate && reportDate <= endDate;
        });
        
        console.log(`[DEBUG] Case ID: ${caseId}, Filtered reports count: ${filteredReports.length}`);
        
        // 報告があれば、その案件をデータありとして記録
        if (filteredReports.length > 0) {
          casesWithReports.push(caseId);
          periodReports.push(...filteredReports);
        }
      }
      
      // レポートがある案件が1つもない場合はエラーを返す
      if (casesWithReports.length === 0) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`[ERROR] No reports found for the period ${startDateStr} to ${endDateStr}`);
        res.status(404).json({ 
          message: `指定された期間(${startDateStr}～${endDateStr})の週次報告が見つかりません` 
        });
        return;
      }
      
      // データがある案件のみのリストを作成
      const casesWithData = allProjectCases.filter(c => casesWithReports.includes(c.id));
      
      // 案件をID基準のマップとして整理（データがある案件のみ）
      const caseMap: Record<number, { caseName: string; description: string | null; projectName: string; reports: any[] }> = {};
      
      casesWithData.forEach(case_ => {
        caseMap[case_.id] = {
          caseName: case_.caseName,
          description: case_.description,
          projectName: case_.projectName,
          reports: []
        };
      });
      
      // 週次報告を案件ごとに整理
      periodReports.forEach(report => {
        if (caseMap[report.caseId]) {
          caseMap[report.caseId].reports.push(report);
        }
      });
      
      // データがある案件に関連するプロジェクト名だけを抽出
      const projectsWithData: string[] = Array.from(new Set(
        casesWithData.map(c => c.projectName)
      ));
      
      // 複数プロジェクトの場合は、プロジェクト名を「複数プロジェクト」とする
      const displayProjectName = projectsWithData.length > 1 
        ? `複数プロジェクト (${projectsWithData.join(', ')})` 
        : projectsWithData[0] || "";
      
      console.log(`[DEBUG] Cases with reports: ${casesWithReports.length}`);
      
      // AIプロンプト用のデータ構成
      let prompt = `
以下のデータをもとに、${displayProjectName}の指定された期間の月次状況報告書を作成してください。
報告書は、経営層やプロジェクト責任者が全体状況を把握できるよう、簡潔かつ要点を押さえた内容にしてください。

【プロジェクト】 ${displayProjectName}

【対象期間】 ${startDate.toISOString().split('T')[0]} 〜 ${endDate.toISOString().split('T')[0]}

【プロジェクト内の案件と週次報告データ】
`;
      
      // データがある案件のみを対象とする
      const selectedCases = allProjectCases.filter(c => casesWithReports.includes(c.id));
      console.log(`[DEBUG] Selected cases: ${selectedCases.length}, Case map keys: ${Object.keys(caseMap).length}`);
      
      // Empty prompt check - データがある案件が0件の場合は早期リターン
      if (selectedCases.length === 0 || Object.keys(caseMap).length === 0) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`[ERROR] No cases with reports found for the period ${startDateStr} to ${endDateStr}`);
        res.status(404).json({ 
          message: `指定された期間(${startDateStr}～${endDateStr})に週次報告のある案件が見つかりません` 
        });
        return;
      }
      
      // データがある案件の情報のみをプロンプトに追加
      Object.keys(caseMap).forEach((caseIdStr) => {
        const caseId = parseInt(caseIdStr);
        const caseInfo = caseMap[caseId];
        
        // 該当するケースのフル情報を探す
        const fullCaseInfo = selectedCases.find(c => c.id === caseId);
        if (!fullCaseInfo) {
          console.log(`[DEBUG] Case ${caseId} not found in selectedCases`);
          return; // データがない案件は表示しない
        }
        
        const milestone = fullCaseInfo?.milestone || "";
        
        prompt += `
■ プロジェクト: ${caseInfo.projectName}
■ 案件: ${caseInfo.caseName}
${caseInfo.description ? `説明: ${caseInfo.description}` : ""}
${milestone ? `マイルストーン: ${milestone}` : ""}
報告数: ${caseInfo.reports.length}件

`;
        
        // 各案件の報告内容をプロンプトに追加
        if (caseInfo.reports.length > 0) {
          // 日付順にソート
          caseInfo.reports.sort((a: any, b: any) => 
            new Date(a.reportPeriodEnd).getTime() - new Date(b.reportPeriodEnd).getTime()
          );
          
          // 最大5件までの報告を表示
          const displayReports = caseInfo.reports.slice(-5);
          
          displayReports.forEach((report: any) => {
            prompt += `
報告期間: ${report.reportPeriodStart} 〜 ${report.reportPeriodEnd}
報告者: ${report.reporterName}
進捗率: ${report.progressRate}%
進捗状況: ${report.progressStatus}
作業内容: ${report.weeklyTasks}
課題・問題点: ${report.issues}
リスク: ${report.newRisks === "yes" ? report.riskSummary : "なし"}
品質懸念: ${report.qualityConcerns !== "none" ? report.qualityDetails : "なし"}
来週予定: ${report.nextWeekPlan}
---
`;
          });
        }
      });
      
      prompt += `
以上のデータを元に、以下の観点で月次状況報告書を作成してください：

1. 全体進捗状況のサマリー
2. 主な成果と完了項目
3. 直面している課題やリスク、その対応策
4. 各案件ごとの状況概要（現状と予定）
5. 品質状況のまとめ
6. 今後のスケジュールと目標
7. 経営層に伝えるべきその他重要事項

最終的なレポートは経営層向けに簡潔にまとめ、プロジェクト全体の健全性と今後の見通しが明確に伝わるように作成してください。
Markdown形式で作成し、適切な見出しを使って整理してください。
`;
      
      res.json({ 
        projectName: displayProjectName,
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        prompt: prompt,
        reportCount: periodReports.length,
        caseCount: selectedCases.length
      });
    } catch (error) {
      console.error("Error retrieving monthly summary input data:", error);
      res.status(500).json({ message: "月次報告書の入力データの取得に失敗しました" });
    }
  });

  app.post("/api/weekly-reports", async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.reporterName) {
        data.reporterName = data.reporterName.replace(/\s+/g, "");
      }
      const weeklyReport = insertWeeklyReportSchema.parse(data);
      const createdReport = await storage.createWeeklyReport(weeklyReport);

      // 関連する案件情報を取得
      const relatedCase = await storage.getCase(createdReport.caseId);
      const analysis = await analyzeWeeklyReport(createdReport, relatedCase);
      if (analysis) {
        await storage.updateAIAnalysis(createdReport.id, analysis);
      }

      const updatedReport = await storage.getWeeklyReport(createdReport.id);
      res.json(updatedReport);
    } catch (error) {
      res.status(400).json({ message: "Invalid weekly report data" });
    }
  });

  app.get("/api/weekly-reports", async (_req, res) => {
    try {
      const reports = await storage.getAllWeeklyReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly reports" });
    }
  });

  app.get("/api/weekly-reports/by-case/:caseId", async (req, res) => {
    try {
      const caseId = parseInt(req.params.caseId);
      const reports = await storage.getWeeklyReportsByCase(caseId);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "週次報告の取得に失敗しました" });
    }
  });

  app.get("/api/weekly-reports/:id", async (req, res) => {
    try {
      const report = await storage.getWeeklyReport(parseInt(req.params.id));
      if (!report) {
        res.status(404).json({ message: "Weekly report not found" });
        return;
      }

      // 関連する案件情報を取得して週次報告に含める
      const relatedCase = await storage.getCase(report.caseId);
      if (relatedCase) {
        const reportWithCase = {
          ...report,
          projectName: relatedCase.projectName,
          caseName: relatedCase.caseName,
        };
        res.json(reportWithCase);
      } else {
        res.json(report);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly report" });
    }
  });

  app.put("/api/weekly-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingReport = await storage.getWeeklyReport(id);

      if (!existingReport) {
        res.status(404).json({ message: "Weekly report not found" });
        return;
      }

      const data = { ...req.body };
      if (data.reporterName) {
        data.reporterName = data.reporterName.replace(/\s+/g, "");
      }
      const updatedData = insertWeeklyReportSchema.parse(data);
      const updatedReport = await storage.updateWeeklyReport(id, updatedData);

      // 関連する案件情報を取得
      const relatedCase = await storage.getCase(updatedReport.caseId);
      const analysis = await analyzeWeeklyReport(updatedReport, relatedCase);
      if (analysis) {
        await storage.updateAIAnalysis(id, analysis);
      }

      const finalReport = await storage.getWeeklyReport(id);
      res.json(finalReport);
    } catch (error) {
      console.error("Error updating weekly report:", error);
      res.status(400).json({ message: "Failed to update weekly report" });
    }
  });

  async function generateMonthlySummary(
    projectName: string,
    reports: any[],
    cases: any[]
  ): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return "OpenAI API キーが設定されていません。デプロイメント設定でAPIキーを追加してください。";
      }

      // データがない場合は早期リターン
      if (reports.length === 0 || cases.length === 0) {
        return "該当する期間に報告データがありません。";
      }

      // 複数プロジェクトかどうかを判定
      const isMultiProject = projectName.includes('複数プロジェクト');

      // 各案件と報告を整理（データがある案件のみ）
      const caseMap: Record<number, { caseName: string; description: string | null; projectName: string; reports: any[] }> = {};
      
      // レポートのある案件IDのセットを作成
      const caseIdsWithReports = new Set(reports.map(report => report.caseId));
      console.log(`[DEBUG] Monthly Summary - Report count: ${reports.length}, Case count: ${cases.length}, Cases with reports: ${caseIdsWithReports.size}`);
      
      // データがある案件のみを追加
      cases
        .filter(c => caseIdsWithReports.has(c.id))
        .forEach(c => {
          caseMap[c.id] = {
            caseName: c.caseName,
            description: c.description,
            projectName: c.projectName,
            reports: []
          };
        });
      
      console.log(`[DEBUG] Monthly Summary - Cases in map: ${Object.keys(caseMap).length}`);

      // データがある案件がない場合は早期リターン
      if (Object.keys(caseMap).length === 0) {
        console.log(`[ERROR] Monthly Summary - No cases with reports found`);
        return "指定された期間に週次報告のある案件が見つかりません。";
      }

      // 週次報告を案件ごとに整理
      reports.forEach(report => {
        if (caseMap[report.caseId]) {
          caseMap[report.caseId].reports.push(report);
        } else {
          console.log(`[WARN] Monthly Summary - Report for case ID ${report.caseId} not found in case map`);
        }
      });

      // 期間の計算
      const startDate = reports.length > 0 
        ? new Date(Math.min(...reports.map(r => new Date(r.reportPeriodStart).getTime())))
        : new Date();
      const endDate = reports.length > 0 
        ? new Date(Math.max(...reports.map(r => new Date(r.reportPeriodEnd).getTime())))
        : new Date();

      // プロンプト作成
      let prompt = `
以下のデータをもとに、${projectName}の指定された期間の月次状況報告書を作成してください。
報告書は、経営層やプロジェクト責任者が全体状況を把握できるよう、簡潔かつ要点を押さえた内容にしてください。

【プロジェクト】 ${projectName}

【対象期間】 ${startDate.toISOString().split('T')[0]} 〜 ${endDate.toISOString().split('T')[0]}

【プロジェクト内の案件と週次報告データ】
`;

      // データがある案件の情報のみをプロンプトに追加
      Object.keys(caseMap).forEach((caseIdStr) => {
        const caseId = parseInt(caseIdStr);
        const caseInfo = caseMap[caseId];
        
        // 該当する案件の完全な情報を取得
        const fullCaseInfo = cases.find(c => c.id === caseId);
        if (!fullCaseInfo) return; // 存在しない案件は表示しない
        
        const milestone = fullCaseInfo?.milestone || "";
        
        prompt += `
${isMultiProject ? `■ プロジェクト: ${caseInfo.projectName}` : ''}
■ 案件: ${caseInfo.caseName}
${caseInfo.description ? `説明: ${caseInfo.description}` : ""}
${milestone ? `マイルストーン: ${milestone}` : ""}
報告数: ${caseInfo.reports.length}件

`;

        // 各案件の報告内容をプロンプトに追加
        if (caseInfo.reports.length > 0) {
          // 日付順にソート
          caseInfo.reports.sort((a: any, b: any) => 
            new Date(a.reportPeriodEnd).getTime() - new Date(b.reportPeriodEnd).getTime()
          );
          
          // 最大5件までの報告を表示
          const displayReports = caseInfo.reports.slice(-5);
          
          displayReports.forEach((report: any) => {
            prompt += `
報告期間: ${report.reportPeriodStart} 〜 ${report.reportPeriodEnd}
報告者: ${report.reporterName}
進捗率: ${report.progressRate}%
進捗状況: ${report.progressStatus}
作業内容: ${report.weeklyTasks}
課題・問題点: ${report.issues}
リスク: ${report.newRisks === "yes" ? report.riskSummary : "なし"}
品質懸念: ${report.qualityConcerns !== "none" ? report.qualityDetails : "なし"}
来週予定: ${report.nextWeekPlan}
---
`;
          });
        }
      });

      prompt += `
以上のデータを元に、以下の観点で月次状況報告書を作成してください：

1. 全体進捗状況のサマリー
2. 主な成果と完了項目
3. 直面している課題やリスク、その対応策
${isMultiProject ? '4. プロジェクトごとの概要と各案件の状況（現状と予定）' : '4. 各案件ごとの状況概要（現状と予定）'}
5. 品質状況のまとめ
6. 今後のスケジュールと目標
7. 経営層に伝えるべきその他重要事項

最終的なレポートは経営層向けに簡潔にまとめ、${isMultiProject ? 'すべてのプロジェクト' : 'プロジェクト'}全体の健全性と今後の見通しが明確に伝わるように作成してください。
Markdown形式で作成し、適切な見出しを使って整理してください。
`;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const aiModel = "gpt-4.1-mini";
      console.log(`Using AI model for monthly summary: ${aiModel}`);
      
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "あなたは経営層向けのプロジェクト状況報告書を作成する専門家です。複数の週次報告から重要な情報を抽出し、簡潔で要点を押さえた月次報告書を作成します。報告書は経営判断に必要な情報が過不足なく含まれるよう心がけてください。"
          },
          { role: "user", content: prompt }
        ],
        model: aiModel,
      });

      // 内容を確実に文字列として返す
      const content = completion.choices[0].message.content;
      return content !== null && content !== undefined ? content : "";
    } catch (error) {
      console.error("OpenAI API error:", error);
      return "月次レポート生成中にエラーが発生しました。";
    }
  }
  
  async function analyzeWeeklyReport(
    report: any,
    relatedCase: any,
  ): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return "OpenAI API キーが設定されていません。デプロイメント設定でAPIキーを追加してください。";
      }

      // 過去の報告を取得
      const pastReports = await storage.getWeeklyReportsByCase(report.caseId);
      console.log(`取得した過去の報告数: ${pastReports.length}`);

      // 現在の報告を除外して過去の報告を取得
      const previousReports = pastReports.filter((pr) => pr.id !== report.id);
      console.log(
        `現在の報告ID: ${report.id}, 比較対象となる過去の報告数: ${previousReports.length}`,
      );

      // 直近の過去の報告（レポート日付の降順でソート済みなので最初の要素を使用）
      const previousReport =
        previousReports.length > 0 ? previousReports[0] : null;
      console.log(`直近の過去の報告ID: ${previousReport?.id || "なし"}`);

      if (previousReport) {
        console.log(
          `直近の報告期間: ${previousReport.reportPeriodStart} 〜 ${previousReport.reportPeriodEnd}`,
        );
      }

      const projectInfo = relatedCase
        ? `プロジェクト名: ${relatedCase.projectName}\n案件名: ${relatedCase.caseName}`
        : "プロジェクト情報が取得できませんでした";

      // 過去の報告がある場合、比較情報を追加
      let previousReportInfo = "";
      if (previousReport) {
        previousReportInfo = `
【前回の報告内容】
報告期間: ${previousReport.reportPeriodStart} 〜 ${previousReport.reportPeriodEnd}
進捗率: ${previousReport.progressRate}%
進捗状況: ${previousReport.progressStatus}
作業内容: ${previousReport.weeklyTasks}
課題・問題点: ${previousReport.issues}
新たなリスク: ${previousReport.newRisks === "yes" ? previousReport.riskSummary : "なし"}
来週の予定（前回）: ${previousReport.nextWeekPlan}
`;
      }

      const prompt = `
あなたはプロジェクトマネージャーのアシスタントです。
現場リーダーが記載した以下の週次報告の内容を分析し、改善点や注意点を指摘してください。
プロジェクトマネージャが確認する前の事前確認として非常に重要なチェックです。
的確に指摘を行い、プロジェクトマネージャが確認する際にプロジェクトの状況を把握できるようにするものです。

${projectInfo}

【今回の報告内容】
報告期間: ${report.reportPeriodStart} 〜 ${report.reportPeriodEnd}
進捗率: ${report.progressRate}%
進捗状況: ${report.progressStatus}
作業内容: ${report.weeklyTasks}
課題・問題点: ${report.issues}
新たなリスク: ${report.newRisks === "yes" ? report.riskSummary : "なし"}
品質懸念事項: ${report.qualityConcerns}
品質懸念詳細: ${report.qualityDetails || "なし"}
顧客懸念: ${report.customerIssues === "exists" ? report.customerDetails : "なし"}
知識・スキル懸念: ${report.knowledgeIssues === "exists" ? report.knowledgeDetails : "なし"}
教育懸念: ${report.trainingIssues === "exists" ? report.trainingDetails : "なし"}
コスト懸念: ${report.costIssues === "exists" ? report.costDetails : "なし"}
緊急課題: ${report.urgentIssues === "exists" ? report.urgentDetails : "なし"}
ビジネスチャンス: ${report.businessOpportunities === "exists" ? report.businessDetails : "なし"}
来週の予定: ${report.nextWeekPlan}

${previousReportInfo}

以下の観点で分析してください：
1. 報告の詳細度は十分か
2. リスクや課題の記載は具体的か
3. 対策や解決策は明確か
4. 追加で記載すべき重要な情報はないか
5. ${previousReport ? "前回の報告と比較して、進捗や課題に変化があるか" : "過去の報告がないため、初回の報告として評価"}
6. ${previousReport ? "前回の「来週の予定」と今回の「作業内容」に整合性があるか" : ""}

簡潔に重要なポイントのみ指摘してください。特に前回からの変化や、前回予定していた作業との差異がある場合は具体的に言及してください。
`;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const aiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
      console.log(`Using AI model: ${aiModel}`);

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "あなたはプロジェクトマネージャーのアシスタントです。週次報告を詳細に分析し、改善点や注意点を明確に指摘できます。前回の報告と今回の報告を比較し、変化や傾向を把握します。",
          },
          { role: "user", content: prompt },
        ],
        model: aiModel,
      });

      // 内容を確実に文字列として返す
      const content = completion.choices[0].message.content;
      return content !== null && content !== undefined ? content : "";
    } catch (error) {
      console.error("OpenAI API error:", error);
      return "AI分析中にエラーが発生しました。";
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
