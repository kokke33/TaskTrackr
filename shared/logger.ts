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
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
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

  public debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const sanitizedContext = this.sanitizeContext(context);
    console.log(this.formatMessage('DEBUG', message, sanitizedContext));
  }

  public info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const sanitizedContext = this.sanitizeContext(context);
    console.info(this.formatMessage('INFO', message, sanitizedContext));
  }

  public warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const sanitizedContext = this.sanitizeContext(context);
    console.warn(this.formatMessage('WARN', message, sanitizedContext));
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const sanitizedContext = this.sanitizeContext(context);
    const errorInfo = error ? ` | Error: ${error.message} | Stack: ${error.stack}` : '';
    console.error(this.formatMessage('ERROR', message, sanitizedContext) + errorInfo);
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

// 旧式のconsole.logとの互換性のためのヘルパー
export const devLog = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, ...args);
  }
};

export const devError = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(message, ...args);
  }
};