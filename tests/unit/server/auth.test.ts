import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compare, hash } from "bcryptjs";
import passport from "passport";
import { isAuthenticated, isAdmin, createInitialUsers } from "../../../server/auth";

// モックの設定
vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue("hashed_password"),
}));

vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("../../../server/hybrid-auth-manager", () => ({
  hybridAuthManager: {
    createAuthMiddleware: vi.fn().mockReturnValue(vi.fn()),
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

vi.mock("passport", () => ({
  default: {
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
  },
}));

describe("Auth", () => {
  let mockDb: any;
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    // データベースモックの設定
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    // リクエスト・レスポンスモックの設定
    mockReq = {
      isAuthenticated: vi.fn(),
      user: null,
      session: {},
      sessionID: "test-session-id",
      method: "GET",
      path: "/api/test",
      headers: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();

    vi.doMock("../../../server/db", () => ({ db: mockDb }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    // NODE_ENV をリセット
    delete process.env.NODE_ENV;
  });

  describe("isAuthenticated ミドルウェア", () => {
    it("認証済みユーザーの場合、nextを呼ぶこと", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "testuser", isAdmin: false };

      isAuthenticated(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("未認証ユーザーの場合、認証エラーを投げること", () => {
      mockReq.isAuthenticated.mockReturnValue(false);
      mockReq.session = { passport: null };

      isAuthenticated(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUTH_FAILED",
          status: 401,
          message: "認証が必要です。",
        })
      );
    });

    it("セッション期限切れの場合、適切なエラーメッセージを投げること", () => {
      mockReq.isAuthenticated.mockReturnValue(false);
      mockReq.session = { passport: { user: null } };

      isAuthenticated(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SESSION_EXPIRED",
          status: 401,
          message: "セッションが期限切れです。再度ログインしてください。",
        })
      );
    });

    it("本番環境では詳細ログを出力しないこと", () => {
      process.env.NODE_ENV = "production";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "testuser", isAdmin: false };

      isAuthenticated(mockReq, mockRes, mockNext);

      // 本番環境では成功時のログが出力されない
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Auth OK")
      );

      consoleSpy.mockRestore();
    });

    it("開発環境では詳細ログを出力すること", () => {
      process.env.NODE_ENV = "development";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "testuser", isAdmin: false };

      isAuthenticated(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Auth OK")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("isAdmin ミドルウェア", () => {
    it("管理者ユーザーの場合、nextを呼ぶこと", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "admin", isAdmin: true };

      isAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("一般ユーザーの場合、権限エラーを投げること", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "testuser", isAdmin: false };

      isAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUTH_FAILED",
          status: 403,
          message: "この操作には管理者権限が必要です。",
        })
      );
    });

    it("未認証ユーザーの場合、権限エラーを投げること", () => {
      mockReq.isAuthenticated.mockReturnValue(false);
      mockReq.user = null;

      isAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUTH_FAILED",
          status: 403,
          message: "この操作には管理者権限が必要です。",
        })
      );
    });

    it("ユーザーオブジェクトが存在するが管理者フラグがfalseの場合、権限エラーを投げること", () => {
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "testuser", isAdmin: false };

      isAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AUTH_FAILED",
          status: 403,
        })
      );
    });

    it("管理者チェックの詳細ログを出力すること", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "admin", isAdmin: true };

      isAdmin(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ADMIN CHECK]")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("createInitialUsers", () => {
    it("初期ユーザーが存在しない場合、作成すること", async () => {
      // 既存ユーザーが見つからない場合をモック
      mockDb.select().from().where.mockResolvedValue([]);

      await createInitialUsers();

      // ユーザー作成が2回呼ばれる（ss7-1とadmin）
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(hash).toHaveBeenCalledTimes(2);
    });

    it("初期ユーザーが既に存在する場合、作成をスキップすること", async () => {
      // 既存ユーザーが見つかる場合をモック
      mockDb.select().from().where.mockResolvedValue([{ id: 1 }]);

      await createInitialUsers();

      // ユーザー作成が呼ばれない
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("データベースエラー時にリトライすること", async () => {
      const dbError = new Error("Connection terminated unexpectedly");
      
      // 最初の2回は失敗、3回目は成功
      mockDb.select().from().where
        .mockRejectedValueOnce(dbError)
        .mockRejectedValueOnce(dbError)
        .mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await createInitialUsers();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("初期ユーザー作成でデータベース接続エラー")
      );

      consoleSpy.mockRestore();
    });

    it("非接続エラーの場合、リトライしないこと", async () => {
      const nonConnectionError = new Error("Validation error");
      
      mockDb.select().from().where.mockRejectedValue(nonConnectionError);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await createInitialUsers();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error creating initial users:",
        nonConnectionError
      );

      consoleErrorSpy.mockRestore();
    });

    it("パスワードが正しくハッシュ化されること", async () => {
      mockDb.select().from().where.mockResolvedValue([]);

      await createInitialUsers();

      expect(hash).toHaveBeenCalledWith("ss7-1weeklyreport", 10);
      expect(hash).toHaveBeenCalledWith("adminpassword", 10);
    });

    it("作成される初期ユーザーの権限設定が正しいこと", async () => {
      mockDb.select().from().where.mockResolvedValue([]);

      await createInitialUsers();

      // ss7-1ユーザー（一般ユーザー）
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "ss7-1",
          password: "hashed_password",
          isAdmin: false,
        })
      );

      // adminユーザー（管理者）
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "admin",
          password: "hashed_password",
          isAdmin: true,
        })
      );
    });
  });

  describe("PassportJS設定", () => {
    it("LocalStrategyが設定されていること", () => {
      expect(passport.use).toHaveBeenCalled();
    });

    it("serializeUserが設定されていること", () => {
      expect(passport.serializeUser).toHaveBeenCalled();
    });

    it("deserializeUserが設定されていること", () => {
      expect(passport.deserializeUser).toHaveBeenCalled();
    });
  });

  describe("認証ストラテジー", () => {
    it("正しいパスワードで認証成功すること", async () => {
      const mockStrategy = vi.mocked(passport.use).mock.calls[0][0];
      const done = vi.fn();

      // ユーザー検索とパスワード検証のモック
      mockDb.select().from().where
        .mockResolvedValueOnce([{
          id: 1,
          username: "testuser",
          password: "hashed_password",
        }])
        .mockResolvedValueOnce([{
          id: 1,
          username: "testuser",
          isAdmin: false,
        }]);

      vi.mocked(compare).mockResolvedValue(true);

      // LocalStrategyのverify関数を呼び出し
      await (mockStrategy as any)._verify("testuser", "password", done);

      expect(done).toHaveBeenCalledWith(null, {
        id: 1,
        username: "testuser",
        isAdmin: false,
      });
    });

    it("間違ったパスワードで認証失敗すること", async () => {
      const mockStrategy = vi.mocked(passport.use).mock.calls[0][0];
      const done = vi.fn();

      mockDb.select().from().where.mockResolvedValue([{
        id: 1,
        username: "testuser",
        password: "hashed_password",
      }]);

      vi.mocked(compare).mockResolvedValue(false);

      await (mockStrategy as any)._verify("testuser", "wrongpassword", done);

      expect(done).toHaveBeenCalledWith(null, false, {
        message: "パスワードが正しくありません",
      });
    });

    it("存在しないユーザーで認証失敗すること", async () => {
      const mockStrategy = vi.mocked(passport.use).mock.calls[0][0];
      const done = vi.fn();

      mockDb.select().from().where.mockResolvedValue([]);

      await (mockStrategy as any)._verify("nonexistent", "password", done);

      expect(done).toHaveBeenCalledWith(null, false, {
        message: "ユーザーが見つかりません",
      });
    });

    it("データベースエラー時にエラーを返すこと", async () => {
      const mockStrategy = vi.mocked(passport.use).mock.calls[0][0];
      const done = vi.fn();
      const dbError = new Error("Database connection failed");

      mockDb.select().from().where.mockRejectedValue(dbError);

      await (mockStrategy as any)._verify("testuser", "password", done);

      expect(done).toHaveBeenCalledWith(dbError);
    });
  });
});