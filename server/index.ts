import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// __dirname をESMで再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import passport from "passport";
import { createInitialUsers } from "./auth";
import { migrateExistingProjectsFromCases } from "./migrations";

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
import pgSession from "connect-pg-simple";
const PostgresStore = pgSession(session);

app.use(
  session({
    store: new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
      tableName: 'session' // セッションテーブル名を明示的に指定
    }),
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      httpOnly: true
    },
    proxy: true,
    name: 'sessionId' // クッキー名を明示的に指定
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

// セッションデバッグミドルウェア
app.use((req, res, next) => {
  // 詳細なセッション情報のログ
  console.log('=== Session Debug Info ===');
  console.log(`Request Path: ${req.path}`);
  console.log(`Session ID: ${req.sessionID}`);
  console.log(`Is Authenticated: ${req.isAuthenticated()}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Cookie Settings:`, req.session?.cookie);
  console.log(`Request Headers:`, {
    origin: req.headers.origin,
    cookie: req.headers.cookie,
    'user-agent': req.headers['user-agent']
  });
  console.log('========================');

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