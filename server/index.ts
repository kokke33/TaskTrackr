import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import passport from "passport";
import { createInitialUsers } from "./auth";
import { migrateExistingProjectsFromCases } from "./migrations";
import { validateAIConfig } from "./config";

dotenv.config();

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

// セッション設定
import MemoryStore from "memorystore";
import pgSession from "connect-pg-simple";
const PostgresStore = pgSession(session);
const MemStore = MemoryStore(session);

// DATABASE_URLを解析してセッションストアを決定
const databaseUrl = process.env.DATABASE_URL || '';
const isNeon = databaseUrl.includes('neon.tech');

// Neonの場合はMemoryStoreを使用（接続問題を回避・離席後エラー対策）
const sessionStore = isNeon ? 
  new MemStore({
    checkPeriod: 600000, // 10分ごとにクリーンアップ（競合を減らすため短縮）
    max: 1000,           // メモリ使用量制限
    ttl: 86400000,       // 24時間でセッション期限切れ
    stale: false,        // 期限切れセッションは保持しない（競合防止）
    dispose: (key: string) => {
      console.log(`セッション削除: ${key.substring(0, 8)}...`);
    }
  }) :
  new PostgresStore({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
    tableName: 'session',
    ttl: 86400 // PostgreSQLでも24時間のTTL設定
  });

console.log(`セッションストア: ${isNeon ? 'MemoryStore (Neon対応)' : 'PostgreSQL'}`);

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false, // MemoryStoreとの競合を防ぐ
    saveUninitialized: true, // セッション初期化を確実に行う
    rolling: false, // セッションID固定
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 本番環境では自動的にセキュア
      sameSite: 'lax', // CSRF対策
      maxAge: 8 * 60 * 60 * 1000, // 8時間に短縮（離席を考慮した実用的な時間）
      httpOnly: true, // セキュリティ向上（XSS対策）
      domain: undefined // 開発環境ではdomainを指定しない
    },
    proxy: true,
    name: 'tasktrackr_session', // より具体的なクッキー名
    unset: 'destroy' // セッション削除時にクッキーも削除
  })
);

// Passportの初期化
app.use(passport.initialize());
app.use(passport.session());

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

// エラーハンドリングの強化
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Application Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ 
    message,
    status,
    timestamp: new Date().toISOString()
  });
});

(async () => {
  const server = await registerRoutes(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server is running on port ${port} in ${app.get("env")} mode`);
  });
})();
