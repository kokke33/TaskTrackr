import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import passport from "passport";
import { createInitialUsers } from "./auth";

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
    proxy: true
  })
);

// Passportの初期化
app.use(passport.initialize());
app.use(passport.session());

// 初期ユーザーの作成
createInitialUsers().catch((error) => {
  console.error("Failed to create initial users:", error);
});

// デバッグ用のログミドルウェア
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // セッション情報のログ
  console.log(`Request path: ${path}`);
  console.log(`Session ID: ${req.sessionID}`);
  console.log(`Is Authenticated: ${req.isAuthenticated()}`);
  console.log(`Cookie Settings:`, req.session?.cookie);

  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
    log(`serving on port ${port}`);
  });
})();