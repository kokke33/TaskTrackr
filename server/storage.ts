import { users, weeklyReports, type User, type InsertUser, type WeeklyReport, type InsertWeeklyReport } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport>;
  getWeeklyReport(id: number): Promise<WeeklyReport | undefined>;
  getAllWeeklyReports(): Promise<WeeklyReport[]>;
  updateWeeklyReport(id: number, report: InsertWeeklyReport): Promise<WeeklyReport>;
  updateAIAnalysis(id: number, analysis: string): Promise<WeeklyReport>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport> {
    const [weeklyReport] = await db.insert(weeklyReports).values(report).returning();
    return weeklyReport;
  }

  async getWeeklyReport(id: number): Promise<WeeklyReport | undefined> {
    const [report] = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id));
    return report;
  }

  async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    try {
      return await db.select().from(weeklyReports).orderBy(desc(weeklyReports.id));
    } catch (error) {
      console.error('Error fetching weekly reports:', error);
      throw error;
    }
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
}

export const storage = new DatabaseStorage();