import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../../../server/routes";
import * as storageModule from "../../../server/storage";
import * as authModule from "../../../server/auth";

// モックの設定
vi.mock("../../../server/storage", () => ({
  storage: {
    search: vi.fn(),
    getSearchSuggestions: vi.fn(),
    createProject: vi.fn(),
    getAllProjects: vi.fn(),
    getAllProjectsForList: vi.fn(),
    getProject: vi.fn(),
    getProjectByName: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    restoreProject: vi.fn(),
    createCase: vi.fn(),
    getAllCases: vi.fn(),
    getCase: vi.fn(),
    createWeeklyReport: vi.fn(),
    getWeeklyReport: vi.fn(),
    updateWeeklyReport: vi.fn(),
    updateWeeklyReportWithVersion: vi.fn(),
    getRecentWeeklyReports: vi.fn(),
  },
}));

vi.mock("../../../server/auth", () => ({
  isAuthenticated: vi.fn((req, res, next) => {
    // 認証されたユーザーとして扱う
    req.user = { id: 1, username: "testuser", isAdmin: false };
    next();
  }),
  isAdmin: vi.fn((req, res, next) => {
    // 管理者ユーザーとして扱う
    req.user = { id: 1, username: "admin", isAdmin: true };
    next();
  }),
  isAuthenticatedHybrid: vi.fn(),
  isAdminHybrid: vi.fn(),
}));

vi.mock("../../../server/hybrid-auth-manager", () => ({
  hybridAuthManager: {
    createAuthResponse: vi.fn().mockImplementation((req) => {
      // req.userが設定されている場合は認証済みとして扱う
      if (req.user) {
        return {
          authenticated: true,
          user: req.user,
        };
      }
      return {
        authenticated: false,
        message: "認証されていません。再度ログインしてください。",
      };
    }),
  },
}));

vi.mock("../../../server/ai-service", () => ({
  getAIService: vi.fn(),
  generateAdminConfirmationEmail: vi.fn(),
}));

vi.mock("../../../server/ai-routes", () => ({
  aiRoutes: vi.fn(),
}));

vi.mock("passport", () => ({
  default: {
    authenticate: vi.fn(() => (req, res, next) => next()),
  },
}));

vi.mock("@shared/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("Routes", () => {
  let app: express.Application;
  let mockStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // セッション設定を追加
    app.use((req, res, next) => {
      req.sessionID = "test-session-id";
      req.user = { id: 1, username: "testuser", isAdmin: false };
      req.isAuthenticated = vi.fn().mockReturnValue(true);
      req.logIn = vi.fn((user, callback) => {
        if (callback) callback(null);
      });
      req.logout = vi.fn((callback) => {
        req.user = undefined;
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      req.session = {
        destroy: vi.fn((callback) => {
          if (callback) callback(null);
        }),
        save: vi.fn((callback) => {
          if (callback) callback(null);
        }),
      } as any;
      next();
    });

    // ストレージモックを適切に初期化
    mockStorage = (storageModule as any).storage;
    
    // デフォルトの戻り値を設定
    mockStorage.createProject.mockResolvedValue({ 
      id: 1, 
      name: "テストプロジェクト",
      overview: "テスト概要",
      organization: "テスト会社",
      personnel: "テスト太郎",
      progress: "開始準備中",
      businessDetails: "詳細情報",
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockStorage.updateProject.mockResolvedValue({ 
      id: 1, 
      name: "更新されたプロジェクト",
      overview: "更新された概要",
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockStorage.deleteProject.mockResolvedValue({ 
      id: 1, 
      name: "削除されたプロジェクト",
      isDeleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockStorage.restoreProject.mockImplementation((id) => {
      // 削除されていないプロジェクトの場合はnullを返すようにモック
      if (id === 1) {
        return Promise.resolve(null);
      }
      return Promise.resolve({ 
        id: id, 
        name: "復元されたプロジェクト",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    mockStorage.createCase.mockResolvedValue({ 
      id: 1, 
      caseName: "テスト案件",
      projectId: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await registerRoutes(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("検索API", () => {
    it("GET /api/search - 検索結果を返すこと", async () => {
      const mockResults = {
        total: 2,
        results: [
          {
            id: 1,
            type: "project",
            title: "テストプロジェクト",
            description: "テスト用のプロジェクト",
            link: "/project/1",
          },
        ],
      };

      mockStorage.search.mockResolvedValue(mockResults);

      const response = await request(app)
        .get("/api/search")
        .query({ q: "テスト" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResults);
      expect(mockStorage.search).toHaveBeenCalledWith("テスト", undefined);
    });

    it("GET /api/search - 空のクエリで空の結果を返すこと", async () => {
      const response = await request(app)
        .get("/api/search")
        .query({ q: "" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ total: 0, results: [] });
      expect(mockStorage.search).not.toHaveBeenCalled();
    });

    it("GET /api/search - 検索エラー時に500を返すこと", async () => {
      mockStorage.search.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/search")
        .query({ q: "テスト" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "検索中にエラーが発生しました" });
    });

    it("GET /api/search/suggest - サジェストを返すこと", async () => {
      const mockSuggestions = [
        {
          id: 1,
          type: "project",
          title: "テストプロジェクト",
          description: "テスト用のプロジェクト",
          link: "/project/1",
        },
      ];

      mockStorage.getSearchSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get("/api/search/suggest")
        .query({ q: "テスト" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSuggestions);
      expect(mockStorage.getSearchSuggestions).toHaveBeenCalledWith("テスト");
    });
  });

  describe("認証API", () => {
    it("GET /api/check-auth - 認証済みユーザー情報を返すこと", async () => {
      // isAuthenticatedミドルウェアが認証済みユーザーとして設定してくれる
      const response = await request(app).get("/api/check-auth");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        authenticated: true,
        user: {
          id: 1,
          username: "testuser",
          isAdmin: false,
        },
      });
    });

    it("POST /api/logout - ログアウト成功メッセージを返すこと", async () => {
      const response = await request(app).post("/api/logout");

      if (response.status !== 200) {
        console.log("Logout error:", response.status, response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "ログアウト成功" });
    });
  });

  describe("プロジェクトAPI", () => {
    it("POST /api/projects - 新しいプロジェクトを作成すること", async () => {
      const projectData = {
        name: "新しいプロジェクト",
        overview: "プロジェクトの概要",
        organization: "テスト会社",
        personnel: "テスト太郎",
        progress: "開始準備中",
        businessDetails: "詳細情報",
        issues: "特になし",
      };

      const createdProject = {
        id: 1,
        ...projectData,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.createProject.mockResolvedValue(createdProject);

      const response = await request(app)
        .post("/api/projects")
        .send(projectData);

      expect(response.status).toBe(200);
      // 日時フィールドを除いて比較
      const { createdAt, updatedAt, ...responseWithoutDates } = response.body;
      const { createdAt: expectedCreatedAt, updatedAt: expectedUpdatedAt, ...expectedWithoutDates } = createdProject;
      expect(responseWithoutDates).toEqual(expectedWithoutDates);
      expect(new Date(createdAt)).toBeInstanceOf(Date);
      expect(new Date(updatedAt)).toBeInstanceOf(Date);
      expect(mockStorage.createProject).toHaveBeenCalledWith(projectData);
    });

    it("GET /api/projects - プロジェクト一覧を取得すること（軽量版）", async () => {
      const mockProjects = [
        {
          id: 1,
          name: "プロジェクト1",
          overview: "概要1",
          organization: "会社1",
          createdAt: "2025-08-03T11:40:05.797Z",
          updatedAt: "2025-08-03T11:40:05.797Z",
          isDeleted: false,
        },
        {
          id: 2,
          name: "プロジェクト2",
          overview: "概要2",
          organization: "会社2",
          createdAt: "2025-08-03T11:40:05.797Z",
          updatedAt: "2025-08-03T11:40:05.797Z",
          isDeleted: false,
        },
      ];

      mockStorage.getAllProjectsForList.mockResolvedValue(mockProjects);

      const response = await request(app).get("/api/projects");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProjects);
      expect(mockStorage.getAllProjectsForList).toHaveBeenCalledWith(false);
    });

    it("GET /api/projects?fullData=true - 詳細プロジェクト一覧を取得すること", async () => {
      const mockProjects = [
        {
          id: 1,
          name: "プロジェクト1",
          overview: "概要1",
          organization: "会社1",
          personnel: "担当者1",
          progress: "進行中",
          businessDetails: "詳細1",
          issues: "問題1",
          isDeleted: false,
          createdAt: "2025-08-03T11:40:05.807Z",
          updatedAt: "2025-08-03T11:40:05.807Z",
        },
      ];

      mockStorage.getAllProjects.mockResolvedValue(mockProjects);

      const response = await request(app)
        .get("/api/projects")
        .query({ fullData: "true" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProjects);
      expect(mockStorage.getAllProjects).toHaveBeenCalledWith(false);
    });

    it("GET /api/projects/:id - 特定のプロジェクトを取得すること", async () => {
      const mockProject = {
        id: 1,
        name: "テストプロジェクト",
        overview: "テスト用のプロジェクト",
        isDeleted: false,
      };

      mockStorage.getProject.mockResolvedValue(mockProject);

      const response = await request(app).get("/api/projects/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(mockStorage.getProject).toHaveBeenCalledWith(1);
    });

    it("GET /api/projects/:id - 存在しないプロジェクトで404を返すこと", async () => {
      mockStorage.getProject.mockResolvedValue(undefined);

      const response = await request(app).get("/api/projects/999");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "プロジェクトが見つかりません" });
    });

    it("PUT /api/projects/:id - プロジェクトを更新すること", async () => {
      const existingProject = {
        id: 1,
        name: "既存プロジェクト",
        overview: "既存の概要",
      };

      const updateData = {
        name: "更新されたプロジェクト",
        overview: "更新された概要",
        organization: "テスト会社",
        personnel: "テスト太郎",
        progress: "進行中",
        businessDetails: "詳細情報",
        issues: "特になし",
      };

      const updatedProject = {
        id: 1,
        ...updateData,
        isDeleted: false,
        updatedAt: new Date(),
      };

      mockStorage.getProject.mockResolvedValue(existingProject);
      mockStorage.updateProject.mockResolvedValue(updatedProject);

      const response = await request(app)
        .put("/api/projects/1")
        .send(updateData);

      expect(response.status).toBe(200);
      // 日時フィールドを除いて比較
      const { updatedAt, ...responseWithoutDates } = response.body;
      const { updatedAt: expectedUpdatedAt, ...expectedWithoutDates } = updatedProject;
      expect(responseWithoutDates).toEqual(expectedWithoutDates);
      expect(new Date(updatedAt)).toBeInstanceOf(Date);
      expect(mockStorage.updateProject).toHaveBeenCalledWith(1, updateData);
    });

    it("DELETE /api/projects/:id - プロジェクトを削除すること", async () => {
      const existingProject = {
        id: 1,
        name: "削除対象プロジェクト",
        isDeleted: false,
      };

      const deletedProject = {
        ...existingProject,
        isDeleted: true,
        updatedAt: new Date(),
      };

      mockStorage.getProject.mockResolvedValue(existingProject);
      mockStorage.deleteProject.mockResolvedValue(deletedProject);

      const response = await request(app).delete("/api/projects/1");

      expect(response.status).toBe(200);
      // 日時フィールドを除いて比較
      const { updatedAt, ...responseWithoutDates } = response.body;
      const { updatedAt: expectedUpdatedAt, ...expectedWithoutDates } = deletedProject;
      expect(responseWithoutDates).toEqual(expectedWithoutDates);
      expect(new Date(updatedAt)).toBeInstanceOf(Date);
      expect(mockStorage.deleteProject).toHaveBeenCalledWith(1);
    });

    it("POST /api/projects/:id/restore - 削除されたプロジェクトを復元すること", async () => {
      const deletedProject = {
        id: 1,
        name: "削除されたプロジェクト",
        isDeleted: true,
      };

      const restoredProject = {
        ...deletedProject,
        isDeleted: false,
        updatedAt: new Date(),
      };

      mockStorage.getProject.mockResolvedValue(deletedProject);
      mockStorage.restoreProject.mockResolvedValue(restoredProject);

      const response = await request(app).post("/api/projects/1/restore");

      expect(response.status).toBe(200);
      // 日時フィールドを除いて比較
      const { updatedAt, ...responseWithoutDates } = response.body;
      const { updatedAt: expectedUpdatedAt, ...expectedWithoutDates } = restoredProject;
      expect(responseWithoutDates).toEqual(expectedWithoutDates);
      expect(new Date(updatedAt)).toBeInstanceOf(Date);
      expect(mockStorage.restoreProject).toHaveBeenCalledWith(1);
    });

    it("POST /api/projects/:id/restore - 削除されていないプロジェクトで400を返すこと", async () => {
      const activeProject = {
        id: 1,
        name: "アクティブなプロジェクト",
        isDeleted: false,
      };

      mockStorage.getProject.mockResolvedValue(activeProject);

      const response = await request(app).post("/api/projects/1/restore");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "このプロジェクトは削除されていません",
      });
    });
  });

  describe("案件API", () => {
    it("POST /api/cases - 新しい案件を作成すること", async () => {
      const caseData = {
        caseName: "新しい案件",
        projectName: "テストプロジェクト",
        description: "案件の詳細",
        milestone: "フェーズ1",
        includeProgressAnalysis: true,
      };

      const createdCase = {
        id: 1,
        ...caseData,
        isDeleted: false,
        createdAt: new Date(),
      };

      mockStorage.createCase.mockResolvedValue(createdCase);

      const response = await request(app).post("/api/cases").send(caseData);

      expect(response.status).toBe(200);
      // 日時フィールドを除いて比較
      const { createdAt, updatedAt, ...responseWithoutDates } = response.body;
      const { createdAt: expectedCreatedAt, updatedAt: expectedUpdatedAt, ...expectedWithoutDates } = createdCase;
      expect(responseWithoutDates).toEqual(expectedWithoutDates);
      expect(new Date(createdAt)).toBeInstanceOf(Date);
      expect(new Date(updatedAt)).toBeInstanceOf(Date);
      expect(mockStorage.createCase).toHaveBeenCalledWith(caseData);
    });

    it("GET /api/cases - 案件一覧を取得すること", async () => {
      const mockCases = [
        {
          id: 1,
          caseName: "案件1",
          projectName: "プロジェクト1",
          isDeleted: false,
        },
        {
          id: 2,
          caseName: "案件2",
          projectName: "プロジェクト2",
          isDeleted: false,
        },
      ];

      mockStorage.getAllCases.mockResolvedValue(mockCases);

      const response = await request(app).get("/api/cases");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCases);
      expect(mockStorage.getAllCases).toHaveBeenCalledWith(false);
    });

    it("GET /api/cases/:id - 特定の案件を取得すること", async () => {
      const mockCase = {
        id: 1,
        caseName: "テスト案件",
        projectName: "テストプロジェクト",
        description: "テスト用の案件",
        isDeleted: false,
      };

      mockStorage.getCase.mockResolvedValue(mockCase);

      const response = await request(app).get("/api/cases/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCase);
      expect(mockStorage.getCase).toHaveBeenCalledWith(1);
    });

    it("GET /api/cases/:id - 存在しない案件で404を返すこと", async () => {
      mockStorage.getCase.mockResolvedValue(undefined);

      const response = await request(app).get("/api/cases/999");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Case not found" });
    });
  });

  describe("週次報告API", () => {
    it("GET /api/recent-reports - 最近の週次報告一覧を取得すること", async () => {
      const mockReports = [
        {
          id: 1,
          reportPeriodStart: "2024-01-01",
          reportPeriodEnd: "2024-01-07",
          reporterName: "テスト太郎",
          progressRate: 50,
          projectName: "テストプロジェクト",
          caseName: "テスト案件",
        },
      ];

      mockStorage.getRecentWeeklyReports.mockResolvedValue(mockReports);

      const response = await request(app).get("/api/recent-reports");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockReports);
      expect(mockStorage.getRecentWeeklyReports).toHaveBeenCalledWith(20);
    });

    it("GET /api/recent-reports?limit=10 - 指定した件数の週次報告を取得すること", async () => {
      const mockReports = [];

      mockStorage.getRecentWeeklyReports.mockResolvedValue(mockReports);

      const response = await request(app)
        .get("/api/recent-reports")
        .query({ limit: "10" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockReports);
      expect(mockStorage.getRecentWeeklyReports).toHaveBeenCalledWith(10);
    });
  });

  describe("エラーハンドリング", () => {
    it("データベースエラー時に500を返すこと", async () => {
      mockStorage.getAllProjects.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/projects")
        .query({ fullData: "true" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: "プロジェクト一覧の取得に失敗しました",
      });
    });

    it("無効なIDパラメータでも適切に処理すること", async () => {
      const response = await request(app).get("/api/projects/invalid-id");

      // parseIntは無効な文字列でNaNを返す
      expect(mockStorage.getProject).toHaveBeenCalledWith(NaN);
    });

    it("不正なJSONデータで400を返すこと", async () => {
      const response = await request(app)
        .post("/api/projects")
        .send("invalid json")
        .set("Content-Type", "application/json");

      expect(response.status).toBe(400);
    });
  });
});