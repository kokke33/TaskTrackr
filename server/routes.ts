import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWeeklyReportSchema, insertCaseSchema } from "@shared/schema";
import OpenAI from "openai";
import passport from "passport";
import { isAuthenticated } from "./auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function registerRoutes(app: Express): Promise<Server> {
  // 認証関連のエンドポイント
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({ message: "ログイン成功" });
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "ログアウト成功" });
    });
  });

  app.get("/api/check-auth", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  // 以下のエンドポイントに認証ミドルウェアを適用
  app.use("/api/cases", isAuthenticated);
  app.use("/api/weekly-reports", isAuthenticated);

  // 案件関連のエンドポイント
  app.post("/api/cases", async (req, res) => {
    try {
      const caseData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(caseData);
      res.json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(400).json({ message: "Invalid case data" });
    }
  });

  app.get("/api/cases", async (_req, res) => {
    try {
      const cases = await storage.getAllCases();
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

  app.put("/api/cases/:id", async (req, res) => {
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

  // 週次報告関連のエンドポイント
  app.get("/api/weekly-reports/latest/:projectName", async (req, res) => {
    try {
      const { projectName } = req.params;
      const reports = await storage.getLatestReportByCase(parseInt(projectName));
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

  app.post("/api/weekly-reports", async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.reporterName) {
        data.reporterName = data.reporterName.replace(/\s+/g, '');
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
        data.reporterName = data.reporterName.replace(/\s+/g, '');
      }
      const updatedData = insertWeeklyReportSchema.parse(data);
      const updatedReport = await storage.updateWeeklyReport(id, updatedData);

      // 関連する案件情報を取得
      const relatedCase = await storage.getCase(updatedReport.caseId);
      const analysis = await analyzeWeeklyReport(updatedReport, relatedCase);
      await storage.updateAIAnalysis(id, analysis);

      const finalReport = await storage.getWeeklyReport(id);
      res.json(finalReport);
    } catch (error) {
      console.error("Error updating weekly report:", error);
      res.status(400).json({ message: "Failed to update weekly report" });
    }
  });

  async function analyzeWeeklyReport(report: any, relatedCase: any) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return "OpenAI API キーが設定されていません。デプロイメント設定でAPIキーを追加してください。";
      }

      const projectInfo = relatedCase ?
        `プロジェクト名: ${relatedCase.projectName}\n案件名: ${relatedCase.caseName}` :
        "プロジェクト情報が取得できませんでした";

      const prompt = `
あなたは100戦錬磨のプロジェクトマネージャー補佐として、現場リーダーの週次進捗報告をレビューする役割を担います。厳しく分析し、的確な指摘を行ってください。

分析対象
プロジェクト名: ${report.projectName}
進捗率: ${report.progressRate}%
進捗状況: ${report.progressStatus}
作業内容: ${report.weeklyTasks}
課題・問題点: ${report.issues}
新たなリスク: ${report.newRisks === 'yes' ? report.riskSummary : 'なし'}
品質懸念事項: ${report.qualityConcerns}
来週の予定: ${report.nextWeekPlan}

レビュー観点
以下の観点から厳格に分析し、具体的な改善点を指摘してください：

1. 進捗状況の妥当性
進捗率と作業内容の整合性はあるか
計画と実績の乖離がある場合、その理由は明確か
進捗遅延の場合、リカバリープランは示されているか

2. 課題・リスク管理
課題の優先度と影響度は明確か
課題に対する対応策は具体的で実行可能か
リスクの予兆を適切に捉えているか
リスク対策は予防的かつ効果的か

3. 品質管理
品質指標は適切に監視されているか
品質懸念事項に対する対策は十分か
テスト結果や不具合状況は適切に報告されているか

4. 計画性
来週の計画は具体的かつ実現可能か
課題解決のためのアクションは計画に反映されているか
リソース配分は適切か

5. 報告の質
重要情報が漏れなく報告されているか
数値やエビデンスに基づいた客観的な報告になっているか
経営層や上位マネジメントへの報告として十分か

フィードバック形式
【重大な懸念点】：即時対応が必要な事項
【改善すべき点】：報告の質を高めるために必要な改善点
【評価できる点】：適切に報告されている点（あれば）
【追加質問】：報告から読み取れない重要情報について確認すべき事項

具体的かつ実践的なフィードバックを提供し、報告の質と効果的なプロジェクト管理を支援してください。

`;

      const aiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
      console.log(`Using AI model: ${aiModel}`);

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: aiModel,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("OpenAI API error:", error);
      return "AI分析中にエラーが発生しました。";
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}