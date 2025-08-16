/**
 * 統一ログ管理システム
 * 開発環境と本番環境で適切なログレベル制御を行う
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string | number;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isProduction: boolean;

  private constructor() {
    // クライアント/サーバー環境の安全な判定
    const isServer = typeof process !== 'undefined' && process.env;
    const isClient = typeof window !== 'undefined';
    
    // 環境変数の安全な取得
    let nodeEnv: string | undefined;
    let logLevelEnv: string | undefined;
    
    if (isServer) {
      // サーバーサイド: process.env を使用
      nodeEnv = process.env.NODE_ENV;
      logLevelEnv = process.env.LOG_LEVEL;
    } else if (isClient && typeof import.meta !== 'undefined' && import.meta.env) {
      // クライアントサイド: import.meta.env を使用
      nodeEnv = import.meta.env.MODE === 'production' ? 'production' : 'development';
      logLevelEnv = import.meta.env.VITE_LOG_LEVEL;
    }
    
    this.isProduction = nodeEnv === 'production';
    
    // ログレベルの決定
    const envLogLevel = logLevelEnv?.toUpperCase();
    let defaultLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
    
    switch (envLogLevel) {
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      default:
        this.logLevel = defaultLevel;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;
    
    // 機密情報をマスク
    const sanitized = { ...context };
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.token) sanitized.token = '***';
    if (sanitized.apiKey) sanitized.apiKey = '***';
    
    return sanitized;
  }

  // ログインジェクション対策のためのサニタイズ関数
  private sanitizeLogMessage(message: string): string {
    if (typeof message !== 'string') {
      return String(message);
    }
    
    // 改行文字、タブ、制御文字、コロンを安全な文字に置換
    return message
      .replace(/[\r\n]/g, ' ')  // 改行文字を空白に置換
      .replace(/\t/g, ' ')      // タブを空白に置換
      .replace(/[\x00-\x1F\x7F]/g, '?')  // 制御文字を?に置換
      .replace(/:/g, '.');      // コロンをピリオドに置換（ログフォーマットの混乱を防ぐ）
  }

  public debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const sanitizedMessage = this.sanitizeLogMessage(message);
    const sanitizedContext = this.sanitizeContext(context);
    console.log(this.formatMessage('DEBUG', sanitizedMessage, sanitizedContext));
  }

  public info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const sanitizedMessage = this.sanitizeLogMessage(message);
    const sanitizedContext = this.sanitizeContext(context);
    console.info(this.formatMessage('INFO', sanitizedMessage, sanitizedContext));
  }

  public warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const sanitizedMessage = this.sanitizeLogMessage(message);
    const sanitizedContext = this.sanitizeContext(context);
    console.warn(this.formatMessage('WARN', sanitizedMessage, sanitizedContext));
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const sanitizedMessage = this.sanitizeLogMessage(message);
    const sanitizedContext = this.sanitizeContext(context);
    const errorInfo = error ? ` | Error: ${this.sanitizeLogMessage(error.message)} | Stack: ${error.stack}` : '';
    console.error(this.formatMessage('ERROR', sanitizedMessage, sanitizedContext) + errorInfo);
  }

  // 特定コンポーネント用のロガーを作成
  public createComponentLogger(componentName: string): ComponentLogger {
    return new ComponentLogger(this, componentName);
  }
}

class ComponentLogger {
  constructor(
    private logger: Logger,
    private componentName: string
  ) {}

  private addComponentContext(context?: LogContext): LogContext {
    return {
      component: this.componentName,
      ...context,
    };
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.addComponentContext(context));
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, this.addComponentContext(context));
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.addComponentContext(context));
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, error, this.addComponentContext(context));
  }
}

// グローバルロガーインスタンス
export const logger = Logger.getInstance();

// よく使用されるコンポーネントロガー
export const createLogger = (componentName: string) => 
  logger.createComponentLogger(componentName);

// ログインジェクション対策用のサニタイズ関数をエクスポート
export const sanitizeForLog = (input: any): string => {
  if (typeof input !== 'string') {
    input = String(input);
  }
  
  // 改行文字、タブ、制御文字、コロンを安全な文字に置換
  return input
    .replace(/[\r\n]/g, ' ')  // 改行文字を空白に置換
    .replace(/\t/g, ' ')      // タブを空白に置換
    .replace(/[\x00-\x1F\x7F]/g, '?')  // 制御文字を?に置換
    .replace(/:/g, '.');      // コロンをピリオドに置換（ログフォーマットの混乱を防ぐ）
};

// 旧式のconsole.logとの互換性のためのヘルパー
export const devLog = (message: string, ...args: any[]) => {
  // 環境判定の安全な実装
  const isProduction = (() => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'production';
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.MODE === 'production';
    }
    return false;
  })();
  
  if (!isProduction) {
    console.log(message, ...args);
  }
};

export const devError = (message: string, ...args: any[]) => {
  // 環境判定の安全な実装
  const isProduction = (() => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'production';
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.MODE === 'production';
    }
    return false;
  })();
  
  if (!isProduction) {
    console.error(message, ...args);
  }
};