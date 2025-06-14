import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWeeklyReportSchema, insertCaseSchema, insertProjectSchema, insertManagerMeetingSchema, insertWeeklyReportMeetingSchema } from "@shared/schema";
import { getAIService } from "./ai-service";
import passport from "passport";
import { isAuthenticated, isAdmin } from "./auth";

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
      // 未認証でも200ステータスで応答（エラーではなく正常な状態として扱う）
      res.json({
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
      const fullData = req.query.fullData === 'true';
      
      if (fullData) {
        // 詳細データが必要な場合
        const projects = await storage.getAllProjects(includeDeleted);
        console.log(`[DEBUG] Returning ${projects.length} full projects`);
        res.json(projects);
      } else {
        // デフォルトで軽量データを取得（パフォーマンス最適化）
        const projects = await storage.getAllProjectsForList(includeDeleted);
        console.log(`[DEBUG] Returning ${projects.length} lightweight projects`);
        res.json(projects);
      }
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
  app.patch("/api/cases/:id/milestone", isAuthenticated, async (req, res) => {
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

      console.log(`[DEBUG] GET /api/monthly-summary/${projectName} - Query params:`, { 
        startDate: startDateQuery, 
        endDate: endDateQuery, 
        caseId 
      });

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

      // プロジェクト名はそのまま使用
      let normalizedProjectName = projectName;
      console.log(`[INFO] Using project name: ${projectName}`);

      // プロジェクト名がカンマ区切りの場合は複数プロジェクトとして処理
      const projectNames = normalizedProjectName.split(',');
      let allProjectCases: any[] = [];

      // 各プロジェクトの案件を取得して結合
      console.log(`[DEBUG] Processing projects:`, projectNames);

      for (const name of projectNames) {
        const trimmedName = name.trim();
        console.log(`[DEBUG] Fetching cases for project: "${trimmedName}"`);
        const projectCases = await storage.getCasesByProject(trimmedName);
        console.log(`[DEBUG] Found ${projectCases.length} cases for project: "${trimmedName}"`);
        allProjectCases.push(...projectCases);
      }

      console.log(`[DEBUG] Total cases found for all projects: ${allProjectCases.length}`);

      if (allProjectCases.length === 0) {
        console.log(`[ERROR] No cases found for projects: ${projectNames.join(', ')}`);
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

      // 対象案件に対して週次報告を一括取得（N+1問題を解決）
      const lastMonthReports = await storage.getWeeklyReportsByCases(targetCaseIds, startDate, endDate);
      
      // データがある案件のIDを記録
      const casesWithReports = Array.from(new Set(lastMonthReports.map(report => report.caseId)));

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

      console.log(`[DEBUG] GET /api/monthly-summary-input/${projectName} - Query params:`, { 
        startDate: startDateQuery, 
        endDate: endDateQuery, 
        caseId 
      });

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

      // プロジェクト名はそのまま使用
      let normalizedProjectName = projectName;
      console.log(`[INFO] Using project name: ${projectName}`);

      // プロジェクト名がカンマ区切りの場合は複数プロジェクトとして処理
      const projectNames = normalizedProjectName.split(',');
      let allProjectCases: any[] = [];

      // 各プロジェクトの案件を取得して結合
      console.log(`[DEBUG] Processing projects:`, projectNames);

      for (const name of projectNames) {
        const trimmedName = name.trim();
        console.log(`[DEBUG] Fetching cases for project: "${trimmedName}"`);
        const projectCases = await storage.getCasesByProject(trimmedName);
        console.log(`[DEBUG] Found ${projectCases.length} cases for project: "${trimmedName}"`);
        allProjectCases.push(...projectCases);
      }

      console.log(`[DEBUG] Total cases found for all projects: ${allProjectCases.length}`);

      if (allProjectCases.length === 0) {
        console.log(`[ERROR] No cases found for projects: ${projectNames.join(', ')}`);
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

      // AIプロンプト用のデータ構成（マークダウン形式）
      let prompt = `
## 月次報告書生成インプット

## プロジェクト情報
- **プロジェクト名**: ${displayProjectName}
- **対象期間**: ${startDate.toISOString().split('T')[0]} ～ ${endDate.toISOString().split('T')[0]}

## プロジェクト内の案件と週次報告データ
`;

      // データがある案件のみをプロンプトに追加
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
### 案件: ${caseInfo.caseName}
- **プロジェクト**: ${caseInfo.projectName}
${caseInfo.description ? `- **説明**: ${caseInfo.description}` : ""}
${milestone ? `- **マイルストーン**: ${milestone}` : ""}
- **報告数**: ${caseInfo.reports.length}件

`;

        // 各案件の報告内容をプロンプトに追加
        if (caseInfo.reports.length > 0) {
          // 日付順にソート
          caseInfo.reports.sort((a: any, b: any) => 
            new Date(a.reportPeriodEnd).getTime() - new Date(b.reportPeriodEnd).getTime()
          );

          // 最大5件までの報告を表示
          const displayReports = caseInfo.reports.slice(-5);

          displayReports.forEach((report: any, index: number) => {
            prompt += `#### 報告 ${index + 1}
- **報告期間**: ${report.reportPeriodStart} ～ ${report.reportPeriodEnd}
- **報告者**: ${report.reporterName}
- **進捗率**: ${report.progressRate}%
- **進捗状況**: ${report.progressStatus}
- **作業内容**:
${report.weeklyTasks.split('\n').map((line: string) => `  - ${line.trim()}`).filter((line: string) => line.length > 3).join('\n')}
${report.issues ? `- **課題・問題点**:\n${report.issues.split('\n').map((line: string) => `  - ${line.trim()}`).filter((line: string) => line.length > 3).join('\n')}` : ''}
- **リスク**: ${report.newRisks === "yes" ? report.riskSummary : "なし"}
- **品質懸念**: ${report.qualityConcerns !== "none" ? report.qualityDetails : "なし"}
- **来週予定**:
${report.nextWeekPlan.split('\n').map((line: string) => `  - ${line.trim()}`).filter((line: string) => line.length > 3).join('\n')}

---

`;
          });
        }
      });

      // 報告書作成ポイントを追加
      prompt += `
## 報告書作成ポイント
1. 全体進捗状況のサマリー
2. 主な成果と完了項目
3. 直面している課題やリスク、その対応策
4. ${Object.keys(caseMap).length > 1 ? 'プロジェクトごとの概要と各案件の状況（現状と予定）' : '各案件ごとの状況概要（現状と予定）'}
5. 品質状況のまとめ
6. 今後のスケジュールと目標
7. 経営層に伝えるべきその他重要事項

最終的なレポートは経営層向けに簡潔にまとめ、${Object.keys(caseMap).length > 1 ? 'すべてのプロジェクト' : 'プロジェクト'}全体の健全性と今後の見通しが明確に伝わるように作成してください。
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

  app.get("/api/weekly-reports", async (req, res) => {
    try {
      // デフォルトで軽量データを返す（パフォーマンス最適化）
      const fullData = req.query.fullData === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      console.log(`[DEBUG] Weekly reports request - fullData: ${fullData}, limit: ${limit}`);
      
      if (fullData) {
        // 詳細データが必要な場合（検索機能等で使用）
        const reports = await storage.getAllWeeklyReports();
        console.log(`[DEBUG] Returning ${reports.length} full weekly reports`);
        res.json(reports);
      } else {
        // デフォルトで軽量データを取得（パフォーマンス最適化）
        const reports = await storage.getAllWeeklyReportsForList(limit || 50);
        console.log(`[DEBUG] Returning ${reports.length} lightweight weekly reports`);
        res.json(reports);
      }
    } catch (error) {
      console.error("Error fetching weekly reports:", error);
      res.status(500).json({ message: "週次報告一覧の取得に失敗しました" });
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

      // 自動保存フラグがない場合のみAI分析を実行
      if (!req.query.autosave) {
        // 関連する案件情報を取得
        const relatedCase = await storage.getCase(updatedReport.caseId);
        const analysis = await analyzeWeeklyReport(updatedReport, relatedCase);
        if (analysis) {
          await storage.updateAIAnalysis(id, analysis);
        }
      }

      const finalReport = await storage.getWeeklyReport(id);
      res.json(finalReport);
    } catch (error) {
      console.error("Error updating weekly report:", error);
      res.status(400).json({ message: "Failed to update weekly report" });
    }
  });

  // 新規作成用の自動保存エンドポイント
  app.post("/api/weekly-reports/autosave", isAuthenticated, async (req, res) => {
    try {
      // 必須項目のバリデーションをスキップし、新規報告として保存
      const data = { ...req.body };
      if (data.reporterName) {
        data.reporterName = data.reporterName.replace(/\s+/g, "");
      }

      // 最低限必要なフィールドだけバリデーション
      if (!data.caseId) {
        return res.status(400).json({ message: "案件IDは必須です" });
      }

      // 関連する案件が存在するか確認
      const relatedCase = await storage.getCase(data.caseId);
      if (!relatedCase) {
        return res.status(404).json({ message: "指定された案件が見つかりません" });
      }

      // 下書きとして保存（必須項目が不足していても保存できるように）
      const createdReport = await storage.createWeeklyReport(data);

      // 簡略化したレスポンスを返す
      res.json({ 
        id: createdReport.id, 
        message: "Auto-saved successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error auto-saving new weekly report:", error);
      res.status(400).json({ message: "Failed to auto-save new weekly report" });
    }
  });

  // 自動保存用の簡易エンドポイント
  app.put("/api/weekly-reports/:id/autosave", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingReport = await storage.getWeeklyReport(id);

      if (!existingReport) {
        res.status(404).json({ message: "Weekly report not found" });
        return;
      }

      // 必須項目のバリデーションをスキップ
      const data = { ...req.body };
      if (data.reporterName) {
        data.reporterName = data.reporterName.replace(/\s+/g, "");
      }

      // 既存のデータと新しいデータをマージして必須フィールドが欠けないようにする
      const mergedData = { ...existingReport, ...data };
      delete mergedData.id; // idは更新対象外
      delete mergedData.createdAt; // createdAtは更新対象外
      delete mergedData.aiAnalysis; // aiAnalysisは更新対象外

      const updatedReport = await storage.updateWeeklyReport(id, mergedData);

      // 簡略化したレスポンスを返す
      res.json({ 
        id: updatedReport.id, 
        message: "Auto-saved successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error auto-saving weekly report:", error);
      res.status(400).json({ message: "Failed to auto-save weekly report" });
    }
  });

  // 週次報告修正会議関連のエンドポイント
  
  // 管理者編集開始エンドポイント
  app.post("/api/weekly-reports/:id/admin-edit-start", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const report = await storage.getWeeklyReport(id);
      
      if (!report) {
        res.status(404).json({ message: "週次報告が見つかりません" });
        return;
      }

      // 管理者編集モード用に元データを返却
      res.json({
        report,
        message: "管理者編集モードを開始しました"
      });
    } catch (error) {
      console.error("Error starting admin edit:", error);
      res.status(500).json({ message: "管理者編集の開始に失敗しました" });
    }
  });

  // 管理者編集完了＋議事録生成エンドポイント
  app.put("/api/weekly-reports/:id/admin-edit-complete", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { originalData, updatedData } = req.body;
      
      if (!originalData || !updatedData) {
        res.status(400).json({ message: "修正前後のデータが必要です" });
        return;
      }

      const existingReport = await storage.getWeeklyReport(id);
      if (!existingReport) {
        res.status(404).json({ message: "週次報告が見つかりません" });
        return;
      }

      // 1. 週次報告を更新
      const updateData = insertWeeklyReportSchema.parse(updatedData);
      const updatedReport = await storage.updateWeeklyReport(id, updateData);

      // 2. 関連案件情報を取得
      const relatedCase = await storage.getCase(updatedReport.caseId);

      // 3. AI分析と議事録生成を並列実行（処理時間短縮）
      console.log("Starting parallel AI processing...");
      const parallelStartTime = Date.now();
      
      const [analysis, meetingMinutes] = await Promise.all([
        // AI分析処理
        analyzeWeeklyReport(updatedReport, relatedCase),
        // 議事録生成処理
        generateEditMeetingMinutes(
          originalData, 
          updatedData, 
          req.user?.username || "管理者",
          relatedCase
        )
      ]);
      
      const parallelEndTime = Date.now();
      console.log(`Parallel AI processing completed in ${parallelEndTime - parallelStartTime}ms`);

      // 4. AI分析結果保存と議事録保存を並列実行
      console.log("Starting parallel database operations...");
      const dbStartTime = Date.now();
      
      const meetingData = {
        weeklyReportId: id,
        meetingDate: new Date().toISOString().split('T')[0],
        title: meetingMinutes.title,
        content: meetingMinutes.content,
        modifiedBy: req.user?.username || "管理者",
        originalData: originalData,
        modifiedData: updatedData
      };

      const [, meeting] = await Promise.all([
        // AI分析結果を保存（analysisが存在する場合のみ）
        analysis ? storage.updateAIAnalysis(id, analysis) : Promise.resolve(),
        // 修正会議議事録を保存
        storage.upsertWeeklyReportMeeting(meetingData)
      ]);
      
      const dbEndTime = Date.now();
      console.log(`Parallel database operations completed in ${dbEndTime - dbStartTime}ms`);

      // 5. 最終的な週次報告データを取得
      const finalReport = await storage.getWeeklyReport(id);
      
      res.json({
        report: finalReport,
        meeting,
        message: "修正と議事録生成が完了しました"
      });
    } catch (error) {
      console.error("Error completing admin edit:", error);
      res.status(500).json({ message: "管理者編集の完了に失敗しました" });
    }
  });

  // 週次報告の修正履歴を取得
  app.get("/api/weekly-reports/:id/meetings", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const meetings = await storage.getWeeklyReportMeetingsByReportId(id);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching report meetings:", error);
      res.status(500).json({ message: "修正履歴の取得に失敗しました" });
    }
  });

  // 議事録更新エンドポイント
  app.put("/api/weekly-reports/meetings/:meetingId", isAuthenticated, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const { title, content } = req.body;

      // 議事録の存在確認
      const existingMeeting = await storage.getWeeklyReportMeeting(meetingId);
      if (!existingMeeting) {
        return res.status(404).json({ message: "議事録が見つかりません" });
      }

      // 更新データを準備
      const updateData = {
        title: title || existingMeeting.title,
        content: content || existingMeeting.content,
      };

      // 議事録を更新
      const updatedMeeting = await storage.updateWeeklyReportMeeting(meetingId, updateData);
      
      res.json({ 
        message: "議事録が更新されました",
        meeting: updatedMeeting 
      });
    } catch (error) {
      console.error("Error updating meeting:", error);
      res.status(500).json({ message: "議事録の更新に失敗しました" });
    }
  });

  async function generateMonthlySummary(
    projectName: string,
    reports: any[],
    cases: any[]
  ): Promise<string> {
    try {
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

      // AIサービスを使用してレポートを生成
      const aiService = getAIService();
      console.log(`Using AI provider: ${process.env.AI_PROVIDER || 'openai'} for monthly summary`);

      const response = await aiService.generateResponse([
        {
          role: "system",
          content: "あなたは経営層向けのプロジェクト状況報告書を作成する専門家です。複数の週次報告から重要な情報を抽出し、簡潔で要点を押さえた月次報告書を作成します。報告書は経営判断に必要な情報が過不足なく含まれるよう心がけてください。\n\n重要: 応答はマークダウン形式で直接出力してください。```markdown のようなコードブロックは使用しないでください。"
        },
        { role: "user", content: prompt }
      ], undefined, { operation: 'generateMonthlySummary', projectName, reportCount: reports.length });

      return response.content;
    } catch (error) {
      console.error("AI API error:", error);
      return "月次レポート生成中にエラーが発生しました。";
    }
  }

  async function analyzeWeeklyReport(
    report: any,
    relatedCase: any,
  ): Promise<string> {
    try {
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

      // AIサービスを使用して分析を実行
      const aiService = getAIService();
      
      const response = await aiService.generateResponse([
        {
          role: "system",
          content: "あなたはプロジェクトマネージャーのアシスタントです。週次報告を詳細に分析し、改善点や注意点を明確に指摘できます。前回の報告と今回の報告を比較し、変化や傾向を把握します。",
        },
        { role: "user", content: prompt },
      ], undefined, { 
        operation: 'analyzeWeeklyReport', 
        reportId: report.id, 
        caseId: report.caseId,
        projectName: relatedCase?.projectName 
      });

      return response.content;
    } catch (error) {
      console.error("OpenAI API error:", error);
      return "AI分析中にエラーが発生しました。";
    }
  }

  // AI議事録生成機能
  async function generateEditMeetingMinutes(
    originalData: any,
    updatedData: any,
    modifiedBy: string,
    relatedCase: any
  ): Promise<{ title: string; content: string }> {
    try {
      // 関連する案件・プロジェクト情報
      const projectInfo = relatedCase
        ? `${relatedCase.projectName} - ${relatedCase.caseName}`
        : "案件情報取得不可";
      
      // 報告期間を取得
      const reportPeriod = updatedData.reportPeriodStart && updatedData.reportPeriodEnd
        ? `${updatedData.reportPeriodStart} 〜 ${updatedData.reportPeriodEnd}`
        : "期間不明";

      // タイトル生成
      const title = `週次報告修正会議 - ${reportPeriod} - ${projectInfo}`;

      // 変更フィールドを検出
      const changes: Array<{field: string, fieldName: string, before: string, after: string}> = [];
      
      const fieldMapping: Record<string, string> = {
        reporterName: "報告者名",
        weeklyTasks: "今週の作業内容",
        progressRate: "進捗率",
        progressStatus: "進捗状況",
        delayIssues: "遅延・問題の有無",
        delayDetails: "遅延・問題の詳細",
        issues: "課題・問題点",
        newRisks: "新たなリスクの有無",
        riskSummary: "リスクの概要",
        riskCountermeasures: "リスク対策",
        riskLevel: "リスクレベル",
        qualityConcerns: "品質懸念の有無",
        qualityDetails: "品質懸念の詳細",
        testProgress: "テスト進捗",
        changes: "変更の有無",
        changeDetails: "変更詳細",
        nextWeekPlan: "来週の予定",
        supportRequests: "支援・判断要望",
        resourceConcerns: "リソース懸念",
        customerIssues: "顧客懸念",
        environmentIssues: "環境懸念",
        costIssues: "コスト懸念",
        knowledgeIssues: "知識・スキル懸念",
        trainingIssues: "教育懸念",
        urgentIssues: "緊急課題懸念",
        businessOpportunities: "営業チャンス"
      };

      // フィールド内の変更箇所を文脈付きでマークアップする機能
      const generateContextualFieldContent = (original: string, updated: string, fieldName: string) => {
        if (original.trim() === updated.trim()) {
          return null; // 変更なし
        }
        
        const originalLines = original.split('\n').map(line => line.trim()).filter(line => line);
        const updatedLines = updated.split('\n').map(line => line.trim()).filter(line => line);
        
        // 更新後の内容をベースに、各行の状態を判定してマークアップ
        let markedUpContent = `**${fieldName}（変更あり）**\n`;
        
        updatedLines.forEach(updatedLine => {
          const isNewLine = !originalLines.some(originalLine => originalLine === updatedLine);
          
          if (isNewLine) {
            // 追加された行
            markedUpContent += `**[追加]** ${updatedLine}\n`;
          } else {
            // 変更されていない既存の行
            markedUpContent += `${updatedLine}\n`;
          }
        });
        
        // 削除された行があるかチェック
        const deletedLines = originalLines.filter(originalLine => 
          !updatedLines.some(updatedLine => updatedLine === originalLine)
        );
        
        if (deletedLines.length > 0) {
          markedUpContent += `\n**削除された内容:**\n`;
          deletedLines.forEach(deletedLine => {
            markedUpContent += `**[削除]** ${deletedLine}\n`;
          });
        }
        
        return {
          fieldName,
          markedUpContent: markedUpContent.trim(),
          hasChanges: true
        };
      };

      const contextualChanges: Array<{
        fieldName: string;
        markedUpContent: string;
        hasChanges: boolean;
      }> = [];

      const unchangedFields: Array<{
        fieldName: string;
        content: string;
      }> = [];

      // 各フィールドの変更を文脈付きで検出
      Object.keys(fieldMapping).forEach(field => {
        const originalValue = String(originalData[field] || "").trim();
        const updatedValue = String(updatedData[field] || "").trim();
        
        const change = generateContextualFieldContent(originalValue, updatedValue, fieldMapping[field]);
        if (change) {
          contextualChanges.push(change);
        } else if (updatedValue) {
          // 変更がないが内容があるフィールドは参考情報として保存
          unchangedFields.push({
            fieldName: fieldMapping[field],
            content: updatedValue
          });
        }
      });

      // AIプロンプト用のデータを準備（文脈を重視した変更箇所の表示）
      let changesText = "";
      if (contextualChanges.length > 0) {
        // 変更があったフィールドの内容をマークアップ付きで表示
        const changedFieldsContent = contextualChanges.map(change => 
          change.markedUpContent
        ).join('\n\n');
        
        
        changesText = `**週次報告の修正内容**\n\n${changedFieldsContent}`;
      } else {
        changesText = "変更が検出されませんでした。";
      }

      const prompt = `
以下の週次報告確認会の議事録を作成してください。

**会議情報**
- 会議: 週次報告確認会
- 対象報告: ${reportPeriod}
- 対象案件: ${projectInfo}
- 参加者: ${modifiedBy}（管理者）、報告者
- 日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

${changesText}

**議事録作成指示**
- 議事録は「主要なアクションアイテム」のみを作成してください
- **重要**: 変更された箇所（**[追加]**マーク付き）の内容と、その文脈（既存の作業内容）を理解した上でタスクを生成する
- 変更がない既存の作業項目に対するタスクは生成しない
- **[追加]**マークが付いた内容について、アクションアイテムを作成：

- 例：
  **今週の作業内容（変更あり）**
  ・システム設計書の作成
  ・データベース設計
  ・REACTのバージョンアップ
  **[追加]** → VerXX→VerXXへのアップに伴う作業。計画とリスク、テスト手法など明確化する。
  
  →「システム設計とデータベース設計の進行中に新たにREACTバージョンアップが必要となったため、
    既存の設計作業への影響を評価し、アップグレード計画を策定する必要がある」
    という文脈を理解したタスクを生成

- 関連する複数の追加内容は統合してアクションアイテムを作成
- アクションアイテムには「具体的に何をするか」をシンプルに記載する。
- Markdownテーブルは使用せず、シンプルなテキスト形式で記載
- 箇条書き（-）を使用してアクションアイテムを整理

変更箇所を既存の作業内容との関連で理解し、文脈を踏まえた実用的な議事録を作成してください。
`;

      // AIサービスを使用して議事録を生成
      const aiService = getAIService();
      
      const response = await aiService.generateResponse([
        {
          role: "system",
          content: "あなたは文脈を重視した実用的な議事録を作成する専門アシスタントです。週次報告の変更内容を、既存の作業フローとの関連性の中で理解し、以下の能力を持っています：\n\n1. 変更箇所が既存の作業にどのような影響を与えるかを分析\n2. プロジェクト全体の流れを理解した上でタスクの優先度と関連性を判断\n3. 「なぜその変更が必要になったか」の背景を推測\n4. 実行可能で具体的なアクションアイテムを生成\n5. 後から参照したときに変更の意図と対応策が明確に分かる議事録を作成\n\n変更箇所だけでなく、その文脈を十分に理解した上で、実用的で行動に移しやすいタスクリストを含む議事録を作成してください。"
        },
        { role: "user", content: prompt }
      ], undefined, {
        operation: 'generateEditMeetingMinutes',
        projectName: relatedCase?.projectName,
        reportPeriod
      });

      return {
        title,
        content: response.content
      };
    } catch (error) {
      console.error("AI議事録生成エラー:", error);
      
      // エラー時はシンプルな議事録を生成
      const fallbackTitle = `週次報告修正会議 - ${updatedData.reportPeriodStart || "日付不明"} - ${relatedCase?.projectName || "プロジェクト不明"}`;
      const fallbackContent = `
# 週次報告修正会議議事録

## 会議概要
- **日時**: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
- **修正者**: ${modifiedBy}
- **対象報告**: ${updatedData.reportPeriodStart || "日付不明"} の週次報告

## 修正内容
管理者により週次報告の修正が実施されました。

## 備考
AI議事録生成中にエラーが発生したため、簡易版議事録を作成しました。
詳細な修正内容については、修正履歴データをご確認ください。
`;

      return {
        title: fallbackTitle,
        content: fallbackContent
      };
    }
  }

  // マネージャ定例議事録関連のAPI
  // プロジェクト別議事録一覧取得（月指定可能）
  app.get('/api/projects/:id/manager-meetings', isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const yearMonth = req.query.yearMonth as string;

      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const meetings = await storage.getManagerMeetingsByProject(projectId, yearMonth);
      res.json(meetings);
    } catch (error) {
      console.error('Manager meetings fetch error:', error);
      res.status(500).json({ error: 'マネージャ定例議事録の取得中にエラーが発生しました' });
    }
  });

  // プロジェクトの利用可能月取得
  app.get('/api/projects/:id/manager-meetings/months', isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const months = await storage.getAvailableMonths(projectId);
      res.json(months);
    } catch (error) {
      console.error('Available months fetch error:', error);
      res.status(500).json({ error: '利用可能月の取得中にエラーが発生しました' });
    }
  });

  // 新規議事録作成
  app.post('/api/projects/:id/manager-meetings', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      // 開催日から年月を自動生成
      const meetingDate = new Date(req.body.meetingDate);
      const yearMonth = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;

      const meetingData = insertManagerMeetingSchema.parse({
        ...req.body,
        projectId,
        yearMonth
      });

      console.log(`[DEBUG] Creating manager meeting with yearMonth: ${yearMonth}`);

      const meeting = await storage.createManagerMeeting(meetingData);
      res.status(201).json(meeting);
    } catch (error) {
      console.error('Manager meeting creation error:', error);
      res.status(500).json({ error: 'マネージャ定例議事録の作成中にエラーが発生しました' });
    }
  });

  // 個別議事録取得
  app.get('/api/manager-meetings/:id', isAuthenticated, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);

      if (isNaN(meetingId)) {
        return res.status(400).json({ error: 'Invalid meeting ID' });
      }

      const meeting = await storage.getManagerMeeting(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ error: 'マネージャ定例議事録が見つかりません' });
      }

      res.json(meeting);
    } catch (error) {
      console.error('Manager meeting fetch error:', error);
      res.status(500).json({ error: 'マネージャ定例議事録の取得中にエラーが発生しました' });
    }
  });

  // 議事録更新
  app.put('/api/manager-meetings/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);

      if (isNaN(meetingId)) {
        return res.status(400).json({ error: 'Invalid meeting ID' });
      }

      // 開催日から年月を自動生成
      const meetingDate = new Date(req.body.meetingDate);
      const yearMonth = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;

      const meetingData = insertManagerMeetingSchema.parse({
        ...req.body,
        yearMonth
      });

      console.log(`[DEBUG] Updating manager meeting with yearMonth: ${yearMonth}`);

      const updatedMeeting = await storage.updateManagerMeeting(meetingId, meetingData);
      
      res.json(updatedMeeting);
    } catch (error) {
      console.error('Manager meeting update error:', error);
      res.status(500).json({ error: 'マネージャ定例議事録の更新中にエラーが発生しました' });
    }
  });

  // 議事録削除
  app.delete('/api/manager-meetings/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);

      if (isNaN(meetingId)) {
        return res.status(400).json({ error: 'Invalid meeting ID' });
      }

      const deletedMeeting = await storage.deleteManagerMeeting(meetingId);
      res.json(deletedMeeting);
    } catch (error) {
      console.error('Manager meeting deletion error:', error);
      res.status(500).json({ error: 'マネージャ定例議事録の削除中にエラーが発生しました' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
