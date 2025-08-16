import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import rateLimit from "express-rate-limit";

const viteLogger = createLogger();

// HTMLテンプレートキャッシュ
interface TemplateCache {
  content: string;
  lastModified: number;
  templatePath: string;
}

let templateCache: TemplateCache | null = null;

// ファイルアクセス専用レートリミット
const fileAccessRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 300, // 300リクエスト/分（10倍緩和）
  message: {
    error: 'FILE_ACCESS_RATE_LIMIT_EXCEEDED',
    message: 'ファイルアクセスのリクエストが多すぎます。しばらく後にお試しください。',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 静的ファイルの場合はスキップ（Viteミドルウェアが処理）
    return req.originalUrl.startsWith('/assets/') || 
           req.originalUrl.includes('.js') || 
           req.originalUrl.includes('.css') || 
           req.originalUrl.includes('.json');
  },
  handler: (req, res) => {
    log(`ファイルアクセスレートリミット違反: ${req.ip} -> ${req.originalUrl}`, "rate-limit");
    res.status(429).json({
      error: 'FILE_ACCESS_RATE_LIMIT_EXCEEDED',
      message: 'ファイルアクセスのリクエストが多すぎます。しばらく後にお試しください。',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// キャッシュされたHTMLテンプレートを取得する関数
async function getCachedTemplate(clientTemplate: string): Promise<string> {
  try {
    const stats = await fs.promises.stat(clientTemplate);
    const lastModified = stats.mtime.getTime();

    // キャッシュが存在し、ファイルが変更されていない場合はキャッシュを返す
    if (templateCache && 
        templateCache.templatePath === clientTemplate && 
        templateCache.lastModified === lastModified) {
      return templateCache.content;
    }

    // ファイルを読み込み、キャッシュを更新
    const content = await fs.promises.readFile(clientTemplate, "utf-8");
    templateCache = {
      content,
      lastModified,
      templatePath: clientTemplate
    };

    log(`HTMLテンプレートをキャッシュに更新: ${clientTemplate}`, "cache");
    return content;
  } catch (error) {
    log(`HTMLテンプレート読み込みエラー: ${error}`, "cache-error");
    throw error;
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // ファイルアクセス専用レートリミットを適用
  app.use("*", fileAccessRateLimit);
  
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // 静的ファイルのリクエストはスキップ（Viteミドルウェアに処理を委ねる）
    if (url.startsWith('/assets/') || url.includes('.js') || url.includes('.css') || url.includes('.json')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // キャッシュからHTMLテンプレートを取得（ファイル変更時は自動更新）
      let template = await getCachedTemplate(clientTemplate);
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // 静的ファイルを適切なMIMEタイプで配信
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // JavaScriptファイルの場合はapplication/javascriptを設定
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
      // CSSファイルの場合はtext/cssを設定
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
      // JSONファイルの場合はapplication/jsonを設定
      if (filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      // HTMLファイルの場合はtext/htmlを設定
      if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
