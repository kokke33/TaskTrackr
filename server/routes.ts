import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWeeklyReportSchema } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/weekly-reports", async (req, res) => {
    try {
      const weeklyReport = insertWeeklyReportSchema.parse(req.body);
      const createdReport = await storage.createWeeklyReport(weeklyReport);
      res.json(createdReport);
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

  // 週次報告の更新エンドポイントを追加
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

      // AI分析を実行
      const analysis = await analyzeWeeklyReport(updatedReport);

      res.json({ report: updatedReport, analysis });
    } catch (error) {
      console.error('Error updating weekly report:', error);
      res.status(400).json({ message: "Failed to update weekly report" });
    }
  });

  // AI分析用の関数
  async function analyzeWeeklyReport(report: any) {
    try {
      const prompt = `
あなたはプロジェクトマネージャーのアシスタントです。以下の週次報告の内容を分析し、改善点や注意点を指摘してください。

プロジェクト名: ${report.projectName}
進捗率: ${report.progressRate}%
進捗状況: ${report.progressStatus}
作業内容: ${report.weeklyTasks}
課題・問題点: ${report.issues}
新たなリスク: ${report.newRisks === 'yes' ? report.riskSummary : 'なし'}
品質懸念事項: ${report.qualityConcerns}
来週の予定: ${report.nextWeekPlan}

以下の観点で分析してください：
1. 報告の詳細度は十分か
2. リスクや課題の記載は具体的か
3. 対策や解決策は明確か
4. 追加で記載すべき重要な情報はないか

簡潔に重要なポイントのみ指摘してください。`;

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      return message.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      return "AI分析中にエラーが発生しました。";
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}