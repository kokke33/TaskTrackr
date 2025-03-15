import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWeeklyReportSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}