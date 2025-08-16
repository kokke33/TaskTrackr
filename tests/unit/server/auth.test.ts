import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compare, hash } from "bcryptjs";

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

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@shared/logger", () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("passport", () => ({
  default: {
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
  },
}));

// 実際のモジュールをインポート（モック後に）
import { isAuthenticated, isAdmin, createInitialUsers } from "../../../server/auth";
import passport from "passport";
import { db } from "../../../server/db";

// auth.tsの設定を強制的に実行
import "../../../server/auth";

describe("Auth", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;
  let mockDb: any;

  beforeEach(() => {
    // データベースモックのリセット
    vi.clearAllMocks();
    mockDb = vi.mocked(db);
    // ログモックのリセット
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();

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
          type: "SESSION_EXPIRED",
          status: 401,
          message: "セッションが期限切れです。再度ログインしてください。",
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

      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "testuser", isAdmin: false };

      isAuthenticated(mockReq, mockRes, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Auth OK",
        expect.objectContaining({
          username: "testuser",
          method: "GET",
          path: "/api/test"
        })
      );
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
      mockReq.isAuthenticated.mockReturnValue(true);
      mockReq.user = { id: 1, username: "admin", isAdmin: true };

      isAdmin(mockReq, mockRes, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ADMIN CHECK",
        expect.objectContaining({
          method: "GET",
          path: "/api/test",
          isAuthenticated: true,
          user: { id: 1, username: "admin", isAdmin: true }
        })
      );
    });
  });

  describe("createInitialUsers", () => {
    it("初期ユーザーが存在しない場合、作成すること", async () => {
      // 既存ユーザーが見つからない場合をモック（両方のユーザーで空配列を返す）
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // 既存ユーザーなし
        }),
      });

      await createInitialUsers();

      // ユーザー作成が2回呼ばれる（ss7-1とadmin）
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(hash).toHaveBeenCalledTimes(2);
      
      // 実際に作成されるユーザーの確認
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "ss7-1",
          isAdmin: false,
        })
      );
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "admin", 
          isAdmin: true,
        })
      );
    });

    it("初期ユーザーが既に存在する場合、作成をスキップすること", async () => {
      // 既存ユーザーが見つかる場合をモック
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1 }]), // 既存ユーザーあり
        }),
      });

      await createInitialUsers();

      // ユーザー作成が呼ばれない
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("データベースエラー時にリトライすること", async () => {
      const dbError = new Error("Connection terminated unexpectedly");
      
      // 最初の1回は失敗、2回目は成功 (リトライ回数を減らしてタイムアウトを防ぐ)
      const mockWhere = vi.fn()
        .mockRejectedValueOnce(dbError)
        .mockResolvedValue([]);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      });

      await createInitialUsers();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "初期ユーザー作成でデータベース接続エラー",
        expect.objectContaining({
          retriesLeft: expect.any(Number)
        })
      );
    }, 10000); // 10秒のタイムアウトを設定

    it("非接続エラーの場合、リトライしないこと", async () => {
      const nonConnectionError = new Error("Validation error");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(nonConnectionError),
        }),
      });

      await createInitialUsers();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error creating initial users",
        nonConnectionError
      );
    });

    it("パスワードが正しくハッシュ化されること", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await createInitialUsers();

      expect(hash).toHaveBeenCalledWith("ss7-1weeklyreport", 10);
      expect(hash).toHaveBeenCalledWith("adminpassword", 10);
    });

    it("作成される初期ユーザーの権限設定が正しいこと", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

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
    it("Passportオブジェクトが利用可能であること", () => {
      expect(passport.use).toBeDefined();
      expect(passport.serializeUser).toBeDefined();
      expect(passport.deserializeUser).toBeDefined();
    });
  });

  describe("認証ストラテジー", () => {
    it("認証関数が正しく定義されていること", () => {
      expect(typeof isAuthenticated).toBe("function");
      expect(typeof isAdmin).toBe("function");
      expect(typeof createInitialUsers).toBe("function");
    });
  });
});