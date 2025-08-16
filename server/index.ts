import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import csrf from "csrf";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebSocket } from "./websocket";
import session from "express-session";
import passport from "passport";
import { createInitialUsers } from "./auth";
import { validateAIConfig } from "./config";
import { debugLogger, debugMiddleware, DebugLogCategory } from "./debug-logger";
import { ensureDatabaseExists } from "./database-setup";
import "./types"; // Session type extensions

// 環境変数の読み込み
dotenv.config();

// デバッグロガー初期化
debugLogger.info(DebugLogCategory.GENERAL, 'server_start', 'TaskTrackr server starting up', {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT || 5000
});

// 本番環境での必須環境変数チェック
if (process.env.NODE_ENV === 'production') {
  debugLogger.info(DebugLogCategory.GENERAL, 'env_check', '本番環境での環境変数をチェック中...');
  
  if (!process.env.DATABASE_URL) {
    debugLogger.error(DebugLogCategory.GENERAL, 'env_check', 'DATABASE_URL環境変数が設定されていません');
    process.exit(1);
  }
  
  if (!process.env.SESSION_SECRET) {
    debugLogger.warn(DebugLogCategory.GENERAL, 'env_check', 'SESSION_SECRET環境変数が設定されていません。デフォルト値を使用します。');
  }
  
  debugLogger.info(DebugLogCategory.GENERAL, 'env_check', '必須環境変数のチェック完了', {
    databaseHost: process.env.DATABASE_URL.split('@')[1] || 'unknown'
  });
}

const app = express();

// デバッグログミドルウェアを早期に追加
app.use(debugMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// プロキシの設定
app.set('trust proxy', 1);

// CORS設定の更新
app.use(cors({
  origin: true, // 本番環境ではReplitのドメインに自動的に制限される
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 基本レートリミット設定
const basicRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: process.env.NODE_ENV === 'production' ? 60 : 1000, // 本番: 60req/min, 開発: 1000req/min
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'リクエストが多すぎます。しばらく後にお試しください。',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // WebSocket関連のリクエストを確実にスキップ
    if (req.path === '/ws' || req.url?.includes('/ws')) {
      return true;
    }
    // WebSocketアップグレードヘッダーのチェック
    if (req.headers.upgrade === 'websocket') {
      return true;
    }
    // 静的ファイルのスキップ
    return req.path.startsWith('/assets/') || 
           req.path.includes('.js') || 
           req.path.includes('.css') || 
           req.path.includes('.json');
  },
  handler: (req, res) => {
    debugLogger.warn(DebugLogCategory.GENERAL, 'rate_limit', 'レートリミット違反', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエストが多すぎます。しばらく後にお試しください。',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// 基本レートリミットを適用（APIルートとページ表示に対して）
app.use(basicRateLimit);

// 統一セッション管理システム
import { sessionManager } from './session-manager';

app.use(
  session({
    store: sessionManager.getStore(),
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false, // MemoryStoreとの競合を防ぐ
    saveUninitialized: false, // セキュリティ向上：未初期化セッションは保存しない
    rolling: false, // 並列APIリクエスト対応：セッションID固定（セッション有効期限は延長される）
    cookie: {
      secure: false, // 開発環境では常にfalse（HTTPSでなくても動作）
      sameSite: 'lax', // 開発環境用に緩和（strictから変更）
      maxAge: 30 * 60 * 1000, // 30分（DB接続プールと統一）
      httpOnly: true, // XSS対策は維持
      domain: undefined // 開発環境ではdomainを指定しない
    },
    proxy: false, // 開発環境では無効化
    name: 'tasktrackr_session', // より具体的なクッキー名
    unset: 'destroy' // セッション削除時にクッキーも削除
  })
);

// Passportの初期化
app.use(passport.initialize());
app.use(passport.session());

// セッションストア情報をログ出力
debugLogger.info(DebugLogCategory.SESSION, 'session_init', 'セッションストア初期化完了', {
  storeType: sessionManager.getStoreType(),
  stats: process.env.NODE_ENV !== 'production' ? sessionManager.getStats() : undefined
});

// CSRF対策の実装
const csrfTokens = new csrf();

// CSRFミドルウェア - POST、PUT、DELETEリクエストのみに適用
app.use((req: Request, res: Response, next: NextFunction) => {
  // セッションが存在しない場合は、CSRFチェックをスキップ
  if (!req.session) {
    return next();
  }

  // GETリクエストやAPIチェック等はCSRFチェックをスキップ
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // 静的ファイルやWebSocket、ログインAPIはスキップ
  if (req.path.startsWith('/assets/') || req.path === '/ws' || req.url?.includes('/ws') || req.path === '/api/login') {
    return next();
  }

  // セッションにCSRFシークレットがない場合は作成
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = csrfTokens.secretSync();
  }

  // CSRFトークンの検証
  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  
  if (!token) {
    debugLogger.warn(DebugLogCategory.GENERAL, 'csrf_error', 'CSRFトークンが提供されていません', {
      method: req.method,
      path: sanitizePath(req.path),
      ip: req.ip
    });
    return res.status(403).json({
      error: 'CSRF_TOKEN_MISSING',
      message: 'CSRFトークンが必要です。',
      timestamp: new Date().toISOString()
    });
  }

  if (!csrfTokens.verify(req.session.csrfSecret, token)) {
    debugLogger.warn(DebugLogCategory.GENERAL, 'csrf_error', 'CSRFトークンが無効です', {
      method: req.method,
      path: sanitizePath(req.path),
      ip: req.ip
    });
    return res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: 'CSRFトークンが無効です。',
      timestamp: new Date().toISOString()
    });
  }

  next();
});

// データベースの自動作成（初期ユーザー作成前に実行）
ensureDatabaseExists()
  .then(() => {
    // データベース作成成功後に初期ユーザーを作成
    return createInitialUsers();
  })
  .catch((error) => {
    debugLogger.error(DebugLogCategory.GENERAL, 'database_setup', 'データベースセットアップに失敗', error);
  });


// AI設定の検証とログ出力
try {
  validateAIConfig();
  debugLogger.info(DebugLogCategory.GENERAL, 'ai_config', 'AI設定の検証が完了');
} catch (error) {
  debugLogger.error(DebugLogCategory.GENERAL, 'ai_config', 'AI設定の検証に失敗', error instanceof Error ? error : new Error(String(error)));
}

// セッションデバッグミドルウェア（簡略化）- ログ出力を最適化
app.use((req, res, next) => {
  // パフォーマンス測定
  const start = Date.now();
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    // /api/check-auth以外のAPIリクエストのみログ出力を制限
    if (req.path.startsWith("/api") && req.path !== "/api/check-auth" && req.method !== 'OPTIONS') {
      let logLine = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// セキュリティ: ログ出力用のサニタイズ関数
function sanitizePath(path: string): string {
  if (!path) return '[empty]';
  
  // 危険な文字（改行、制御文字等）を除去
  const sanitized = path
    .replace(/[\r\n\t]/g, '') // 改行、タブを除去
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // 制御文字を除去
    .slice(0, 200); // 最大200文字に制限
  
  return sanitized || '[sanitized]';
}

// 統一エラーハンドリングシステム
interface AppError extends Error {
  status?: number;
  statusCode?: number;
  type?: 'SESSION_EXPIRED' | 'AUTH_FAILED' | 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'INTERNAL_ERROR';
  redirectTo?: string;
}

class UnifiedErrorHandler {
  static handle(err: AppError, req: Request, res: Response, _next: NextFunction) {
    const timestamp = new Date().toISOString();
    const requestInfo = {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // エラータイプ別の処理
    switch (err.type) {
      case 'SESSION_EXPIRED':
        console.log(`[${timestamp}] セッション期限切れ:`, { requestPath: sanitizePath(req.path), ...requestInfo });
        return res.status(401).json({
          error: 'SESSION_EXPIRED',
          message: 'セッションが期限切れです。再度ログインしてください。',
          redirectTo: '/login',
          timestamp
        });

      case 'AUTH_FAILED':
        console.log(`[${timestamp}] 認証失敗:`, { requestPath: sanitizePath(req.path), ...requestInfo });
        return res.status(401).json({
          error: 'AUTH_FAILED',
          message: '認証が必要です。',
          redirectTo: '/login',
          timestamp
        });

      case 'VALIDATION_ERROR':
        console.log(`[${timestamp}] バリデーションエラー:`, { requestPath: sanitizePath(req.path), ...requestInfo, error: err.message });
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: err.message || 'リクエストデータが無効です。',
          timestamp
        });

      case 'DATABASE_ERROR':
        console.error(`[${timestamp}] データベースエラー:`, { requestPath: sanitizePath(req.path), ...requestInfo, error: err.message });
        return res.status(503).json({
          error: 'DATABASE_ERROR',
          message: 'データベース接続に問題があります。しばらく後にお試しください。',
          timestamp
        });

      default:
        // 一般的なエラー処理
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        
        if (status >= 500) {
          console.error(`[${timestamp}] サーバーエラー:`, { ...requestInfo, status, error: err.message, stack: err.stack });
        } else {
          console.log(`[${timestamp}] クライアントエラー:`, { ...requestInfo, status, error: err.message });
        }

        return res.status(status).json({
          error: status >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR',
          message: process.env.NODE_ENV === 'production' && status >= 500 
            ? 'サーバー内部エラーが発生しました。' 
            : message,
          status,
          timestamp
        });
    }
  }
}

// 統一エラーハンドラーを適用
app.use(UnifiedErrorHandler.handle);

(async () => {
  const server = await registerRoutes(app);

  // WebSocketサーバーをセットアップ
  setupWebSocket(server);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server is running on port ${port} in ${app.get("env")} mode`);
    log(`WebSocket is available at ws://localhost:${port}/ws`);
  });
})();
