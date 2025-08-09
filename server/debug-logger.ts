import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export enum DebugLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export enum DebugLogCategory {
  AUTH = 'auth',
  API = 'api', 
  DATABASE = 'database',
  WEBSOCKET = 'websocket',
  NAVIGATION = 'navigation',
  FORM = 'form',
  ERROR_HANDLER = 'error_handler',
  SESSION = 'session',
  VALIDATION = 'validation',
  AI = 'ai',
  GENERAL = 'general'
}

export interface DebugLogEntry {
  timestamp: string;
  level: DebugLogLevel;
  category: DebugLogCategory;
  sessionId?: string;
  requestId?: string;
  userId?: string;
  username?: string;
  operation: string;
  message: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    duration?: number;
    [key: string]: any;
  };
}

export class DebugLogger {
  private logLevel: DebugLogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private maskSensitiveData: boolean;
  private fileLogger?: winston.Logger;
  private logDir: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.logDir = process.env.DEBUG_LOG_DIR || path.join(__dirname, '../logs');
    
    // 開発環境ではDEBUG、本番環境ではINFO
    const defaultLogLevel = process.env.NODE_ENV === 'production' ? DebugLogLevel.INFO : DebugLogLevel.DEBUG;
    this.logLevel = (process.env.DEBUG_LOG_LEVEL as DebugLogLevel) || defaultLogLevel;
    
    // 開発環境ではコンソール有効、本番環境では無効
    const defaultConsoleLogging = process.env.NODE_ENV === 'production' ? 'false' : 'true';
    this.enableConsole = (process.env.DEBUG_LOG_CONSOLE || defaultConsoleLogging) === 'true';
    
    // ファイルログは本番環境で自動有効、または明示的に指定
    this.enableFile = process.env.DEBUG_LOG_FILE === 'true' || process.env.NODE_ENV === 'production';
    this.maskSensitiveData = process.env.DEBUG_LOG_MASK_SENSITIVE !== 'false';
    
    if (this.enableFile) {
      this.initializeFileLogger();
    }
  }

  private initializeFileLogger(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // デバッグログ用のrotate file transport
      const debugRotateTransport = new DailyRotateFile({
        filename: path.join(this.logDir, 'debug-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: process.env.DEBUG_LOG_COMPRESS !== 'false',
        maxSize: process.env.DEBUG_LOG_MAX_SIZE || '20m',
        maxFiles: process.env.DEBUG_LOG_MAX_FILES || '14d',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
          }),
          winston.format.json()
        )
      });

      // エラー専用のrotate file transport
      const errorRotateTransport = new DailyRotateFile({
        filename: path.join(this.logDir, 'debug-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: process.env.DEBUG_LOG_COMPRESS !== 'false',
        maxSize: process.env.DEBUG_LOG_MAX_SIZE || '20m',
        maxFiles: process.env.DEBUG_LOG_MAX_FILES || '30d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
          }),
          winston.format.json()
        )
      });

      this.fileLogger = winston.createLogger({
        level: this.logLevel,
        transports: [
          debugRotateTransport,
          errorRotateTransport
        ],
        exitOnError: false
      });

      console.log(`Debug Logger: File logging initialized at ${this.logDir}`);
    } catch (error) {
      console.error('Debug Logger: Failed to initialize file logger:', error);
    }
  }

  private shouldLog(level: DebugLogLevel): boolean {
    const levels = [DebugLogLevel.DEBUG, DebugLogLevel.INFO, DebugLogLevel.WARN, DebugLogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private maskSensitiveInfo(data: any): any {
    if (!this.maskSensitiveData) return data;
    
    const sensitiveKeys = [
      'password', 'secret', 'token', 'apikey', 'api_key', 'authorization',
      'session', 'cookie', 'csrf', 'jwt', 'bearer'
    ];

    if (typeof data === 'string') {
      return data.replace(/password[=:]\s*\S+/gi, 'password=***MASKED***')
                 .replace(/token[=:]\s*\S+/gi, 'token=***MASKED***')
                 .replace(/secret[=:]\s*\S+/gi, 'secret=***MASKED***');
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveInfo(item));
    }

    if (data && typeof data === 'object') {
      const masked = { ...data };
      for (const key of Object.keys(masked)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = this.maskSensitiveInfo(masked[key]);
        }
      }
      return masked;
    }

    return data;
  }

  private formatLogEntry(entry: DebugLogEntry): any {
    const maskedEntry = {
      ...entry,
      data: this.maskSensitiveInfo(entry.data),
      metadata: entry.metadata ? this.maskSensitiveInfo(entry.metadata) : undefined
    };

    // 本番環境では大きなデータを切り詰める
    if (process.env.NODE_ENV === 'production') {
      if (maskedEntry.data && typeof maskedEntry.data === 'string' && maskedEntry.data.length > 2000) {
        maskedEntry.data = maskedEntry.data.substring(0, 2000) + '... [truncated]';
      }
    }

    return maskedEntry;
  }

  private writeLog(entry: DebugLogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const formattedEntry = this.formatLogEntry(entry);

    if (this.enableConsole) {
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.operation}`;
      const logMessage = `${prefix}: ${entry.message}`;
      
      switch (entry.level) {
        case DebugLogLevel.DEBUG:
          console.debug(logMessage, entry.data ? formattedEntry.data : '');
          break;
        case DebugLogLevel.INFO:
          console.info(logMessage, entry.data ? formattedEntry.data : '');
          break;
        case DebugLogLevel.WARN:
          console.warn(logMessage, entry.data ? formattedEntry.data : '');
          break;
        case DebugLogLevel.ERROR:
          console.error(logMessage, entry.data ? formattedEntry.data : '', entry.error ? formattedEntry.error : '');
          break;
      }
    }

    if (this.enableFile && this.fileLogger) {
      this.fileLogger.log(entry.level, entry.message, formattedEntry);
    }
  }

  // 基本的なログメソッド
  debug(category: DebugLogCategory, operation: string, message: string, data?: any, metadata?: any): void {
    this.log(DebugLogLevel.DEBUG, category, operation, message, data, undefined, metadata);
  }

  info(category: DebugLogCategory, operation: string, message: string, data?: any, metadata?: any): void {
    this.log(DebugLogLevel.INFO, category, operation, message, data, undefined, metadata);
  }

  warn(category: DebugLogCategory, operation: string, message: string, data?: any, metadata?: any): void {
    this.log(DebugLogLevel.WARN, category, operation, message, data, undefined, metadata);
  }

  error(category: DebugLogCategory, operation: string, message: string, error?: Error, data?: any, metadata?: any): void {
    this.log(DebugLogLevel.ERROR, category, operation, message, data, error, metadata);
  }

  // 内部メソッド
  private log(
    level: DebugLogLevel,
    category: DebugLogCategory,
    operation: string,
    message: string,
    data?: any,
    error?: Error,
    metadata?: any
  ): void {
    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      operation,
      message,
      data,
      error: error ? {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: (error as any).code
      } : undefined,
      metadata
    };

    this.writeLog(entry);
  }

  // 便利メソッド - APIリクエスト追跡用
  apiStart(operation: string, req: any): string {
    const requestId = this.generateRequestId();
    this.info(
      DebugLogCategory.API,
      operation,
      `API request started`,
      {
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      },
      {
        sessionId: req.sessionID,
        userId: req.user?.id,
        username: req.user?.username,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        method: req.method,
        url: req.originalUrl || req.url
      }
    );
    return requestId;
  }

  apiEnd(operation: string, requestId: string, result?: any, duration?: number): void {
    this.info(
      DebugLogCategory.API,
      operation,
      `API request completed`,
      {
        requestId,
        result: result ? (typeof result === 'object' ? Object.keys(result) : result) : undefined
      },
      {
        requestId,
        duration
      }
    );
  }

  apiError(operation: string, requestId: string, error: Error, duration?: number): void {
    this.error(
      DebugLogCategory.API,
      operation,
      `API request failed`,
      error,
      {
        requestId
      },
      {
        requestId,
        duration
      }
    );
  }

  // 認証関連の便利メソッド
  authSuccess(operation: string, userId: string, username: string, metadata?: any): void {
    this.info(
      DebugLogCategory.AUTH,
      operation,
      `Authentication successful`,
      {
        userId,
        username
      },
      metadata
    );
  }

  authFailure(operation: string, reason: string, metadata?: any): void {
    this.warn(
      DebugLogCategory.AUTH,
      operation,
      `Authentication failed: ${reason}`,
      undefined,
      metadata
    );
  }

  // データベース操作の便利メソッド
  dbQuery(operation: string, query: string, params?: any, duration?: number): void {
    this.debug(
      DebugLogCategory.DATABASE,
      operation,
      `Database query executed`,
      {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        params
      },
      {
        duration
      }
    );
  }

  dbError(operation: string, error: Error, query?: string): void {
    this.error(
      DebugLogCategory.DATABASE,
      operation,
      `Database operation failed`,
      error,
      {
        query: query ? query.substring(0, 200) + (query.length > 200 ? '...' : '') : undefined
      }
    );
  }

  // WebSocket関連の便利メソッド
  wsConnect(operation: string, userId: string, connectionId: string): void {
    this.info(
      DebugLogCategory.WEBSOCKET,
      operation,
      `WebSocket connection established`,
      {
        userId,
        connectionId
      }
    );
  }

  wsDisconnect(operation: string, userId: string, connectionId: string, reason?: string): void {
    this.info(
      DebugLogCategory.WEBSOCKET,
      operation,
      `WebSocket connection closed`,
      {
        userId,
        connectionId,
        reason
      }
    );
  }

  wsMessage(operation: string, userId: string, messageType: string, data?: any): void {
    this.debug(
      DebugLogCategory.WEBSOCKET,
      operation,
      `WebSocket message processed`,
      {
        userId,
        messageType,
        data
      }
    );
  }

  // セッション関連の便利メソッド
  sessionCreated(sessionId: string, userId: string, username: string): void {
    this.info(
      DebugLogCategory.SESSION,
      'session_create',
      `Session created`,
      {
        sessionId,
        userId,
        username
      }
    );
  }

  sessionDestroyed(sessionId: string, reason?: string): void {
    this.info(
      DebugLogCategory.SESSION,
      'session_destroy',
      `Session destroyed`,
      {
        sessionId,
        reason
      }
    );
  }

  // エラーハンドラー用の便利メソッド
  uncaughtError(error: Error, context?: string): void {
    this.error(
      DebugLogCategory.ERROR_HANDLER,
      'uncaught_error',
      `Uncaught error occurred${context ? ` in ${context}` : ''}`,
      error
    );
  }

  // RequestID生成
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ユニークセッションID生成
  generateSessionId(): string {
    return `sess_${uuidv4()}`;
  }
}

// シングルトンインスタンス
export const debugLogger = new DebugLogger();

// Express middleware用のヘルパー
export interface RequestWithDebug extends Request {
  debugRequestId?: string;
}

export function debugMiddleware(req: any, res: any, next: any): void {
  req.debugRequestId = debugLogger.generateSessionId();
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    debugLogger.info(
      DebugLogCategory.API,
      'http_request',
      `HTTP ${req.method} ${res.statusCode}`,
      {
        requestId: req.debugRequestId,
        statusCode: res.statusCode
      },
      {
        method: req.method,
        url: req.originalUrl || req.url,
        duration,
        statusCode: res.statusCode,
        userId: req.user?.id,
        username: req.user?.username
      }
    );
  });
  
  next();
}