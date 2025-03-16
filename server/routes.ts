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

// 進捗状況の日本語マッピング
const progressStatusMap = {
  'on-schedule': '予定通り',
  'slightly-delayed': '少し遅れている',
  'severely-delayed': '大幅に遅れている',
  'ahead': '前倒しで進行中'
};

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
  app.get("/api/weekly-reports/latest/:caseId", async (req, res) => {
    try {
      const { caseId } = req.params;
      const report = await storage.getLatestReportByCase(parseInt(caseId));
      if (!report) {
        res.status(404).json({ message: "No reports found for this case" });
        return;
      }

      // 進捗状況を日本語に変換
      const reportWithJapanese = {
        ...report,
        progressStatus: progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus
      };

      res.json(reportWithJapanese);
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

      // 進捗状況を日本語に変換
      const updatedReport = await storage.getWeeklyReport(createdReport.id);
      const reportWithJapanese = {
        ...updatedReport,
        progressStatus: progressStatusMap[updatedReport.progressStatus as keyof typeof progressStatusMap] || updatedReport.progressStatus
      };

      res.json(reportWithJapanese);
    } catch (error) {
      res.status(400).json({ message: "Invalid weekly report data" });
    }
  });

  app.get("/api/weekly-reports", async (_req, res) => {
    try {
      const reports = await storage.getAllWeeklyReports();
      // 進捗状況を日本語に変換
      const reportsWithJapanese = reports.map(report => ({
        ...report,
        progressStatus: progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus
      }));
      res.json(reportsWithJapanese);
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

      // 進捗状況を日本語に変換
      const reportWithJapanese = {
        ...report,
        progressStatus: progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus
      };

      if (relatedCase) {
        const reportWithCase = {
          ...reportWithJapanese,
          projectName: relatedCase.projectName,
          caseName: relatedCase.caseName,
        };
        res.json(reportWithCase);
      } else {
        res.json(reportWithJapanese);
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
      // 進捗状況を日本語に変換
      const reportWithJapanese = {
        ...finalReport,
        progressStatus: progressStatusMap[finalReport.progressStatus as keyof typeof progressStatusMap] || finalReport.progressStatus
      };

      res.json(reportWithJapanese);
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
あなたはプロジェクトマネージャーのアシスタントです。
現場リーダーが記載した以下の週次報告の内容を分析し、改善点や注意点を指摘してください。
プロジェクトマネージャが確認する前の事前確認として非常に重要なチェックです。
的確に指摘を行い、プロジェクトマネージャが確認する際にプロジェクトの状況を把握できるよう
にするものです。

${projectInfo}
進捗率: ${report.progressRate}%
進捗状況: ${progressStatusMap[report.progressStatus as keyof typeof progressStatusMap] || report.progressStatus}
作業内容: ${report.weeklyTasks}
課題・問題点: ${report.issues}
新たなリスク: ${report.newRisks === "yes" ? report.riskSummary : "なし"}
品質懸念事項: ${report.qualityConcerns}
来週の予定: ${report.nextWeekPlan}

以下の観点で分析してください：
1. 報告の詳細度は十分か
2. リスクや課題の記載は具体的か
3. 対策や解決策は明確か
4. 追加で記載すべき重要な情報はないか

簡潔に重要なポイントのみ指摘してください。
`;

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: process.env.OPENAI_MODEL || "gpt-4",
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