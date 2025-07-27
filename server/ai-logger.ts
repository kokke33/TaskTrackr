import { type AIProvider } from "@shared/ai-constants";
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface AILogEntry {
  timestamp: string;
  level: LogLevel;
  provider: AIProvider;
  operation: string;
  requestId: string;
  userId?: string;
  request: {
    endpoint: string;
    method: string;
    headers: Record<string, any>;
    body: any;
    size: number;
  };
  response?: {
    status: number;
    headers: Record<string, any>;
    body: any;
    size: number;
    duration: number;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

export class AILogger {
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private maskSensitiveData: boolean;
  private fileLogger?: winston.Logger;
  private logDir: string;
  private requestCache: Map<string, {
    endpoint: string;
    method: string;
    headers: Record<string, any>;
    body: any;
    size: number;
  }> = new Map();

  constructor() {
    // Setup log directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.logDir = process.env.AI_LOG_DIR || path.join(__dirname, '../logs');
    
    // Default to WARNING level in production, INFO in development
    const defaultLogLevel = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO;
    this.logLevel = (process.env.AI_LOG_LEVEL as LogLevel) || defaultLogLevel;
    
    // Default to disabled console logging in production
    const defaultConsoleLogging = process.env.NODE_ENV === 'production' ? 'false' : 'true';
    this.enableConsole = (process.env.AI_LOG_CONSOLE || defaultConsoleLogging) === 'true';
    
    // Enable file logging automatically in production, or when explicitly requested
    this.enableFile = process.env.AI_LOG_FILE === 'true' || process.env.NODE_ENV === 'production';
    this.maskSensitiveData = process.env.AI_LOG_MASK_SENSITIVE !== 'false';
    
    // Initialize file logging if enabled
    if (this.enableFile) {
      this.initializeFileLogger();
    }
    
    // Set up periodic cache cleanup to prevent memory leaks
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Clean up every minute
  }

  private initializeFileLogger(): void {
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Daily rotate file transport for all logs
      const dailyRotateTransport = new DailyRotateFile({
        filename: path.join(this.logDir, 'ai-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: process.env.AI_LOG_COMPRESS !== 'false',
        maxSize: process.env.AI_LOG_MAX_SIZE || '10m',
        maxFiles: process.env.AI_LOG_MAX_FILES || '30d',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.json()
        )
      });

      // Error-only rotate file transport
      const errorRotateTransport = new DailyRotateFile({
        filename: path.join(this.logDir, 'ai-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: process.env.AI_LOG_COMPRESS !== 'false',
        maxSize: process.env.AI_LOG_MAX_SIZE || '10m',
        maxFiles: process.env.AI_LOG_MAX_FILES || '30d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.json()
        )
      });

      this.fileLogger = winston.createLogger({
        level: this.logLevel,
        transports: [
          dailyRotateTransport,
          errorRotateTransport
        ],
        exitOnError: false
      });

      // Log rotation events
      dailyRotateTransport.on('rotate', (oldFilename, newFilename) => {
        console.log(`AI Logger: Log file rotated from ${oldFilename} to ${newFilename}`);
      });

      dailyRotateTransport.on('archive', (zipFilename) => {
        console.log(`AI Logger: Log file archived to ${zipFilename}`);
      });

      console.log(`AI Logger: File logging initialized at ${this.logDir}`);

    } catch (error) {
      console.error('AI Logger: Failed to initialize file logger:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private maskSensitiveInfo(data: any): any {
    if (!this.maskSensitiveData) return data;
    
    const sensitiveKeys = [
      'apikey', 'api_key', 'authorization', 'password', 'secret', 'token',
      'api-key', 'x-api-key', 'openai-api-key', 'gemini-api-key', 'groq-api-key'
    ];

    if (typeof data === 'string') {
      // API Key pattern matching for various providers
      return data.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***MASKED***')  // OpenAI
                 .replace(/gsk_[a-zA-Z0-9]{20,}/g, 'gsk_***MASKED***')  // Groq
                 .replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, 'AIzaSy***MASKED***')  // Google/Gemini
                 .replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, 'Bearer ***MASKED***')
                 .replace(/[a-zA-Z0-9]{32,}/g, (match) => {
                   // Generic long token masking
                   return match.length > 32 ? match.substring(0, 8) + '***MASKED***' : match;
                 });
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

  private formatLogEntry(entry: AILogEntry): string {
    const maskedEntry = {
      ...entry,
      request: {
        ...entry.request,
        headers: this.maskSensitiveInfo(entry.request.headers),
        body: this.maskSensitiveInfo(entry.request.body)
      },
      response: entry.response ? {
        ...entry.response,
        headers: this.maskSensitiveInfo(entry.response.headers),
        body: this.maskSensitiveInfo(entry.response.body)
      } : undefined
    };

    // In production, use compact format and truncate large bodies
    if (process.env.NODE_ENV === 'production') {
      // Truncate large request/response bodies to prevent log bloat
      if (maskedEntry.request.body && typeof maskedEntry.request.body === 'string' && maskedEntry.request.body.length > 1000) {
        maskedEntry.request.body = maskedEntry.request.body.substring(0, 1000) + '... [truncated]';
      }
      if (maskedEntry.response?.body && typeof maskedEntry.response.body === 'string' && maskedEntry.response.body.length > 1000) {
        maskedEntry.response.body = maskedEntry.response.body.substring(0, 1000) + '... [truncated]';
      }
      return JSON.stringify(maskedEntry); // Compact format
    }

    return JSON.stringify(maskedEntry, null, 2); // Pretty format for development
  }

  private writeLog(entry: AILogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const formattedLog = this.formatLogEntry(entry);

    if (this.enableConsole) {
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [AI:${entry.provider}] [${entry.operation}]`;
      
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(prefix, formattedLog);
          break;
        case LogLevel.INFO:
          console.info(prefix, formattedLog);
          break;
        case LogLevel.WARN:
          console.warn(prefix, formattedLog);
          break;
        case LogLevel.ERROR:
          console.error(prefix, formattedLog);
          break;
      }
    }

    // File logging with winston
    if (this.enableFile && this.fileLogger) {
      const logData = {
        timestamp: entry.timestamp,
        level: entry.level,
        provider: entry.provider,
        operation: entry.operation,
        requestId: entry.requestId,
        userId: entry.userId,
        request: entry.request,
        response: entry.response,
        error: entry.error,
        metadata: entry.metadata
      };
      
      this.fileLogger.log(entry.level, 'AI Operation', logData);
    }
  }

  logRequest(
    provider: AIProvider,
    operation: string,
    requestId: string,
    request: {
      endpoint: string;
      method: string;
      headers: Record<string, any>;
      body: any;
    },
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    const requestData = {
      endpoint: request.endpoint,
      method: request.method,
      headers: request.headers,
      body: request.body,
      size: JSON.stringify(request.body || {}).length
    };

    // Cache the request data for use in response/error logging
    this.requestCache.set(requestId, requestData);

    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      provider,
      operation,
      requestId,
      userId,
      request: requestData,
      metadata
    };

    this.writeLog(entry);
  }

  logResponse(
    provider: AIProvider,
    operation: string,
    requestId: string,
    response: {
      status: number;
      headers: Record<string, any>;
      body: any;
      duration: number;
    },
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    // Get cached request data or use empty fallback
    const cachedRequest = this.requestCache.get(requestId) || {
      endpoint: '',
      method: '',
      headers: {},
      body: null,
      size: 0
    };

    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      provider,
      operation,
      requestId,
      userId,
      request: cachedRequest,
      response: {
        ...response,
        size: JSON.stringify(response.body || {}).length
      },
      metadata
    };

    this.writeLog(entry);
    
    // Clean up cache after response is logged
    this.requestCache.delete(requestId);
  }

  logError(
    provider: AIProvider,
    operation: string,
    requestId: string,
    error: Error,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    // Get cached request data or use empty fallback
    const cachedRequest = this.requestCache.get(requestId) || {
      endpoint: '',
      method: '',
      headers: {},
      body: null,
      size: 0
    };

    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      provider,
      operation,
      requestId,
      userId,
      request: cachedRequest,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: (error as any).code
      },
      metadata
    };

    this.writeLog(entry);
    
    // Clean up cache after error is logged
    this.requestCache.delete(requestId);
  }

  logDebug(
    provider: AIProvider,
    operation: string,
    requestId: string,
    message: string,
    data?: any,
    userId?: string
  ): void {
    // Get cached request data or use empty fallback
    const cachedRequest = this.requestCache.get(requestId) || {
      endpoint: '',
      method: '',
      headers: {},
      body: null,
      size: 0
    };

    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      provider,
      operation,
      requestId,
      userId,
      request: cachedRequest,
      metadata: {
        message,
        data: this.maskSensitiveInfo(data)
      }
    };

    this.writeLog(entry);
  }

  logWarn(
    provider: AIProvider,
    operation: string,
    requestId: string,
    message: string,
    data?: any,
    userId?: string
  ): void {
    // Get cached request data or use empty fallback
    const cachedRequest = this.requestCache.get(requestId) || {
      endpoint: '',
      method: '',
      headers: {},
      body: null,
      size: 0
    };

    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      provider,
      operation,
      requestId,
      userId,
      request: cachedRequest,
      metadata: {
        message,
        data: this.maskSensitiveInfo(data)
      }
    };

    this.writeLog(entry);
  }

  // Clean up old cache entries to prevent memory leaks
  private cleanupCache(): void {
    // Clear cache entries older than 5 minutes
    const fiveMinutesAgo = Date.now() - 300000;
    const keysToDelete: string[] = [];
    
    this.requestCache.forEach((value, requestId) => {
      const timestamp = parseInt(requestId.split('_')[1]);
      if (timestamp < fiveMinutesAgo) {
        keysToDelete.push(requestId);
      }
    });
    
    keysToDelete.forEach(key => {
      this.requestCache.delete(key);
    });
  }
}

// シングルトンインスタンス
export const aiLogger = new AILogger();

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
