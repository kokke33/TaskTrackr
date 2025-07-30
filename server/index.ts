import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebSocket } from "./websocket";
import session from "express-session";
import passport from "passport";
import { createInitialUsers } from "./auth";
import { migrateExistingProjectsFromCases } from "./migrations";
import { validateAIConfig } from "./config";

// 環境変数の読み込み
dotenv.config();

// 本番環境での必須環境変数チェック
if (process.env.NODE_ENV === 'production') {
  console.log('🔍 本番環境での環境変数をチェック中...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL環境変数が設定されていません');
    process.exit(1);
  }
  
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️ SESSION_SECRET環境変数が設定されていません。デフォルト値を使用します。');
  }
  
  console.log('✅ 必須環境変数のチェック完了');
  console.log(`📍 データベース接続先: ${process.env.DATABASE_URL.split('@')[1] || 'unknown'}`);
}

const app = express();
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
      maxAge: 24 * 60 * 60 * 1000, // 24時間に延長（開発時の利便性向上）
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
console.log(`📦 セッションストア: ${sessionManager.getStoreType()}`);
if (process.env.NODE_ENV !== 'production') {
  console.log('📊 セッションストア統計:', sessionManager.getStats());
}

// 初期ユーザーの作成
createInitialUsers().catch((error) => {
  console.error("Failed to create initial users:", error);
});

// 既存の案件からプロジェクトを作成
migrateExistingProjectsFromCases().catch((error) => {
  console.error("Failed to migrate projects from cases:", error);
});

// AI設定の検証とログ出力
try {
  validateAIConfig();
} catch (error) {
  console.error("AI configuration validation failed:", error);
}

// セッションデバッグミドルウェア（簡略化）
app.use((req, res, next) => {
  // APIアクセス時のみログ出力
  if (req.path.startsWith("/api") && req.method !== 'OPTIONS') {
    console.log(`${req.method} ${req.path} - Auth: ${req.isAuthenticated()}`);
  }

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
    if (req.path.startsWith("/api")) {
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
        console.log(`[${timestamp}] セッション期限切れ: ${req.path}`, requestInfo);
        return res.status(401).json({
          error: 'SESSION_EXPIRED',
          message: 'セッションが期限切れです。再度ログインしてください。',
          redirectTo: '/login',
          timestamp
        });

      case 'AUTH_FAILED':
        console.log(`[${timestamp}] 認証失敗: ${req.path}`, requestInfo);
        return res.status(401).json({
          error: 'AUTH_FAILED',
          message: '認証が必要です。',
          redirectTo: '/login',
          timestamp
        });

      case 'VALIDATION_ERROR':
        console.log(`[${timestamp}] バリデーションエラー: ${req.path}`, { ...requestInfo, error: err.message });
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: err.message || 'リクエストデータが無効です。',
          timestamp
        });

      case 'DATABASE_ERROR':
        console.error(`[${timestamp}] データベースエラー: ${req.path}`, { ...requestInfo, error: err.message });
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
