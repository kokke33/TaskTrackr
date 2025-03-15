import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWeeklyReportSchema } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/weekly-reports", async (req, res) => {
    try {
      const weeklyReport = insertWeeklyReportSchema.parse(req.body);
      const createdReport = await storage.createWeeklyReport(weeklyReport);

      // 新規作成時もAI分析を行い、保存する
      const analysis = await analyzeWeeklyReport(createdReport);
      await storage.updateAIAnalysis(createdReport.id, analysis);

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
      res.json(report);
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

      const updatedData = insertWeeklyReportSchema.parse(req.body);
      const updatedReport = await storage.updateWeeklyReport(id, updatedData);

      // AI分析を実行し、保存
      const analysis = await analyzeWeeklyReport(updatedReport);
      await storage.updateAIAnalysis(id, analysis);

      // 更新後のレポートを取得して返す
      const finalReport = await storage.getWeeklyReport(id);
      res.json(finalReport);
    } catch (error) {
      console.error("Error updating weekly report:", error);
      res.status(400).json({ message: "Failed to update weekly report" });
    }
  });

  // AI分析用の関数
  async function analyzeWeeklyReport(report: any) {
    try {
      const prompt = `
あなたはプロジェクトマネージャーのアシスタントです。
現場リーダーが記載した以下の週次報告の内容を分析し、改善点や注意点を指摘してください。
プロジェクトマネージャが確認する前の事前確認として非常に重要なチェックです。
的確に指摘を行い、プロジェクトマネージャが確認する際にプロジェクトの状況を把握できるよう
にするものです。

プロジェクト名: ${report.projectName}
進捗率: ${report.progressRate}%
進捗状況: ${report.progressStatus}
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

      // 環境変数からモデルを取得するか、デフォルト値を使用
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
