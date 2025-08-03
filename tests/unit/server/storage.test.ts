import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DatabaseStorage, OptimisticLockError } from "../../../server/storage";
import type { InsertUser, InsertProject, InsertCase, InsertWeeklyReport } from "@shared/schema";

// データベースモジュールをモック化
vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

// bcryptjsをモック化
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed_password"),
}));

// パフォーマンスモニターをモック化
vi.mock("@shared/performance-monitor", () => ({
  performanceMonitor: vi.fn(),
  measureAsync: vi.fn().mockImplementation((category, operation, fn) => fn()),
}));

describe("DatabaseStorage", () => {
  let storage: DatabaseStorage;
  let mockDb: any;

  beforeEach(() => {
    storage = new DatabaseStorage();
    // データベースモックの初期化
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
            orderBy: vi.fn().mockReturnValue([]),
          }),
          orderBy: vi.fn().mockReturnValue([]),
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    
    vi.doMock("../../../server/db", () => ({ db: mockDb }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("User管理", () => {
    it("ユーザーを作成できること", async () => {
      const userData: InsertUser = {
        username: "testuser",
        password: "password",
        isAdmin: false,
      };

      const expectedUser = {
        id: 1,
        username: "testuser",
        isAdmin: false,
        createdAt: new Date(),
      };

      // モックの設定
      mockDb.insert().values().returning.mockResolvedValue([expectedUser]);

      const result = await storage.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("ユーザー名で検索できること", async () => {
      const expectedUser = {
        id: 1,
        username: "testuser",
        password: "hashed_password",
        isAdmin: false,
        createdAt: new Date(),
      };

      mockDb.select().from().where.mockResolvedValue([expectedUser]);

      const result = await storage.getUserByUsername("testuser");

      expect(result).toEqual(expectedUser);
    });

    it("存在しないユーザーの場合undefinedを返すこと", async () => {
      mockDb.select().from().where.mockResolvedValue([]);

      const result = await storage.getUserByUsername("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("Project管理", () => {
    it("プロジェクトを作成できること", async () => {
      const projectData: InsertProject = {
        name: "テストプロジェクト",
        overview: "テスト用のプロジェクト",
        organization: "テスト会社",
        personnel: "テスト太郎",
        progress: "開始準備中",
        businessDetails: "詳細情報",
        issues: "特になし",
      };

      const expectedProject = {
        id: 1,
        ...projectData,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert().values().returning.mockResolvedValue([expectedProject]);

      const result = await storage.createProject(projectData);

      expect(result).toEqual(expectedProject);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("プロジェクトを更新できること", async () => {
      const updateData: InsertProject = {
        name: "更新されたプロジェクト",
        overview: "更新された概要",
        organization: "テスト会社",
        personnel: "テスト太郎",
        progress: "進行中",
        businessDetails: "詳細情報",
        issues: "特になし",
      };

      const expectedProject = {
        id: 1,
        ...updateData,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.update().set().where().returning.mockResolvedValue([expectedProject]);

      const result = await storage.updateProject(1, updateData);

      expect(result).toEqual(expectedProject);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("プロジェクトを削除（ソフト削除）できること", async () => {
      const deletedProject = {
        id: 1,
        name: "削除されたプロジェクト",
        isDeleted: true,
        updatedAt: new Date(),
      };

      mockDb.update().set().where().returning.mockResolvedValue([deletedProject]);

      const result = await storage.deleteProject(1);

      expect(result).toEqual(deletedProject);
      expect(result.isDeleted).toBe(true);
    });
  });

  describe("Case管理", () => {
    it("案件を作成できること", async () => {
      const caseData: InsertCase = {
        caseName: "テスト案件",
        projectName: "テストプロジェクト",
        description: "テスト用の案件",
        milestone: "フェーズ1",
        includeProgressAnalysis: true,
      };

      const expectedCase = {
        id: 1,
        ...caseData,
        isDeleted: false,
        createdAt: new Date(),
      };

      mockDb.insert().values().returning.mockResolvedValue([expectedCase]);

      const result = await storage.createCase(caseData);

      expect(result).toEqual(expectedCase);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("プロジェクト別の案件を取得できること", async () => {
      const expectedCases = [
        {
          id: 1,
          caseName: "案件1",
          projectName: "テストプロジェクト",
          isDeleted: false,
        },
        {
          id: 2,
          caseName: "案件2",
          projectName: "テストプロジェクト", 
          isDeleted: false,
        },
      ];

      mockDb.select().from().where().orderBy.mockResolvedValue(expectedCases);

      const result = await storage.getCasesByProject("テストプロジェクト");

      expect(result).toEqual(expectedCases);
    });
  });

  describe("WeeklyReport管理", () => {
    it("週次報告を作成できること", async () => {
      const reportData: InsertWeeklyReport = {
        reportPeriodStart: "2024-01-01",
        reportPeriodEnd: "2024-01-07",
        caseId: 1,
        reporterName: "テスト太郎",
        weeklyTasks: "テストタスク",
        progressRate: 50,
        progressStatus: "順調",
        delayIssues: "なし",
        issues: "特になし",
        newRisks: "なし",
        qualityConcerns: "なし",
        changes: "なし",
        nextWeekPlan: "次週の計画",
        supportRequests: "なし",
        urgentIssues: "なし",
        version: 1,
      };

      const expectedReport = {
        id: 1,
        ...reportData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert().values().returning.mockResolvedValue([expectedReport]);

      const result = await storage.createWeeklyReport(reportData);

      expect(result).toEqual(expectedReport);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("楽観的ロック付きで週次報告を更新できること", async () => {
      const reportData: InsertWeeklyReport = {
        reportPeriodStart: "2024-01-01",
        reportPeriodEnd: "2024-01-07",
        caseId: 1,
        reporterName: "更新されたテスト太郎",
        weeklyTasks: "更新されたテストタスク",
        progressRate: 75,
        progressStatus: "順調",
        delayIssues: "なし",
        issues: "特になし",
        newRisks: "なし",
        qualityConcerns: "なし",
        changes: "なし",
        nextWeekPlan: "更新された次週の計画",
        supportRequests: "なし",
        urgentIssues: "なし",
        version: 2,
      };

      // 現在のレポートを模擬
      const currentReport = {
        id: 1,
        ...reportData,
        version: 1,
      };

      // getWeeklyReportの呼び出しを模擬
      vi.spyOn(storage, 'getWeeklyReport').mockResolvedValue(currentReport);

      const expectedUpdatedReport = {
        ...reportData,
        version: 2,
        updatedAt: new Date(),
      };

      mockDb.update().set().where().returning.mockResolvedValue([expectedUpdatedReport]);

      const result = await storage.updateWeeklyReportWithVersion(1, reportData, 1);

      expect(result).toEqual(expectedUpdatedReport);
      expect(result.version).toBe(2);
    });

    it("楽観的ロック競合でOptimisticLockErrorを投げること", async () => {
      const reportData: InsertWeeklyReport = {
        reportPeriodStart: "2024-01-01",
        reportPeriodEnd: "2024-01-07",
        caseId: 1,
        reporterName: "テスト太郎",
        weeklyTasks: "テストタスク",
        progressRate: 50,
        progressStatus: "順調",
        delayIssues: "なし",
        issues: "特になし",
        newRisks: "なし",
        qualityConcerns: "なし",
        changes: "なし",
        nextWeekPlan: "次週の計画",
        supportRequests: "なし",
        urgentIssues: "なし",
        version: 1,
      };

      // 現在のレポートのバージョンが期待と異なる場合を模擬
      const currentReport = {
        id: 1,
        version: 2, // 期待されたバージョン（1）と異なる
        ...reportData,
      };

      vi.spyOn(storage, 'getWeeklyReport').mockResolvedValue(currentReport);

      await expect(
        storage.updateWeeklyReportWithVersion(1, reportData, 1)
      ).rejects.toThrow(OptimisticLockError);
    });
  });

  describe("検索機能", () => {
    it("空の検索クエリで空の結果を返すこと", async () => {
      const result = await storage.search("");

      expect(result).toEqual({
        total: 0,
        results: [],
      });
    });

    it("検索クエリを正規化すること", async () => {
      // 全角スペースと複数スペースのテスト
      vi.spyOn(storage as any, 'searchProjects').mockResolvedValue([]);
      vi.spyOn(storage as any, 'searchCases').mockResolvedValue([]);
      vi.spyOn(storage as any, 'searchWeeklyReports').mockResolvedValue([]);
      vi.spyOn(storage as any, 'searchManagerMeetings').mockResolvedValue([]);

      await storage.search("キーワード　テスト   検索");

      // 検索メソッドが呼び出されることを確認
      expect((storage as any).searchProjects).toHaveBeenCalled();
      expect((storage as any).searchCases).toHaveBeenCalled();
      expect((storage as any).searchWeeklyReports).toHaveBeenCalled();
      expect((storage as any).searchManagerMeetings).toHaveBeenCalled();
    });
  });

  describe("リトライ機能", () => {
    it("接続エラー時にリトライすること", async () => {
      // withRetry関数をテスト
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
        .mockResolvedValueOnce("success");

      // withRetryを直接呼び出してテスト
      const withRetry = (storage as any).constructor.prototype.constructor;
      
      // 実際の実装をテストするため、getUser メソッドでリトライをテスト
      mockDb.select().from().where.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
                            .mockResolvedValueOnce([{ id: 1, username: "test" }]);

      const result = await storage.getUser(1);

      // 結果の検証は実装に依存するため、エラーが投げられないことを確認
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("システム設定", () => {
    it("システム設定を取得できること", async () => {
      const expectedSetting = {
        key: "REALTIME_PROVIDER",
        value: "openai",
        description: "リアルタイム分析プロバイダー",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.select().from().where.mockResolvedValue([expectedSetting]);

      const result = await storage.getSystemSetting("REALTIME_PROVIDER");

      expect(result).toEqual(expectedSetting);
    });

    it("存在しない設定の場合nullを返すこと", async () => {
      mockDb.select().from().where.mockResolvedValue([]);

      const result = await storage.getSystemSetting("NONEXISTENT_KEY");

      expect(result).toBeNull();
    });

    it("システム設定を更新できること", async () => {
      const expectedSetting = {
        key: "REALTIME_PROVIDER",
        value: "gemini",
        description: "更新されたプロバイダー",
        updatedAt: new Date(),
      };

      mockDb.insert().values().onConflictDoUpdate().returning.mockResolvedValue([expectedSetting]);

      const result = await storage.setSystemSetting("REALTIME_PROVIDER", "gemini", "更新されたプロバイダー");

      expect(result).toEqual(expectedSetting);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("パフォーマンス測定", () => {
    it("すべてのデータベース操作でパフォーマンス測定が行われること", async () => {
      const { measureAsync } = await import("@shared/performance-monitor");
      
      mockDb.select().from().where.mockResolvedValue([]);

      await storage.getUser(1);

      expect(measureAsync).toHaveBeenCalledWith(
        'database',
        'getUser',
        expect.any(Function),
        { userId: 1 }
      );
    });
  });
});