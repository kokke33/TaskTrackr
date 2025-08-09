export enum DebugLogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error'
}

export enum DebugLogCategory {
  AUTH = 'auth',
  NAVIGATION = 'navigation',
  API = 'api',
  FORM = 'form', 
  WEBSOCKET = 'websocket',
  USER_ACTION = 'user_action',
  ERROR_HANDLER = 'error_handler',
  STATE = 'state',
  RENDER = 'render',
  AI = 'ai',
  GENERAL = 'general'
}

export interface DebugLogEntry {
  timestamp: string;
  level: DebugLogLevel;
  category: DebugLogCategory;
  sessionId: string;
  operation: string;
  message: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  metadata?: {
    url?: string;
    pathname?: string;
    userAgent?: string;
    userId?: string;
    username?: string;
    component?: string;
    duration?: number;
    [key: string]: any;
  };
}

class DebugLogger {
  private logLevel: DebugLogLevel;
  private enableConsole: boolean;
  private enableLocalStorage: boolean;
  private maxLocalStorageEntries: number;
  private sessionId: string;
  private userId?: string;
  private username?: string;

  constructor() {
    // 本番環境ではINFO、開発環境ではDEBUG
    this.logLevel = import.meta.env.PROD ? DebugLogLevel.INFO : DebugLogLevel.DEBUG;
    
    // 本番環境ではコンソール出力を制限
    this.enableConsole = !import.meta.env.PROD || 
      (import.meta.env.VITE_DEBUG_LOG_CONSOLE === 'true');
    
    // LocalStorageへの保存（デバッグ用）
    this.enableLocalStorage = import.meta.env.VITE_DEBUG_LOG_STORAGE === 'true';
    this.maxLocalStorageEntries = 1000;
    
    // セッションIDを生成
    this.sessionId = this.generateSessionId();
    
    // ページ離脱時にログを保存
    if (this.enableLocalStorage) {
      window.addEventListener('beforeunload', () => {
        this.saveLogsToStorage();
      });
    }
  }

  private generateSessionId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private shouldLog(level: DebugLogLevel): boolean {
    const levels = [DebugLogLevel.DEBUG, DebugLogLevel.INFO, DebugLogLevel.WARN, DebugLogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private maskSensitiveInfo(data: any): any {
    if (!data) return data;
    
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

  private writeLog(entry: DebugLogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const maskedEntry = {
      ...entry,
      data: this.maskSensitiveInfo(entry.data)
    };

    if (this.enableConsole) {
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.operation}`;
      const logMessage = `${prefix}: ${entry.message}`;
      
      switch (entry.level) {
        case DebugLogLevel.DEBUG:
          console.debug(logMessage, entry.data || '');
          break;
        case DebugLogLevel.INFO:
          console.info(logMessage, entry.data || '');
          break;
        case DebugLogLevel.WARN:
          console.warn(logMessage, entry.data || '');
          break;
        case DebugLogLevel.ERROR:
          console.error(logMessage, entry.data || '', entry.error || '');
          break;
      }
    }

    if (this.enableLocalStorage) {
      this.saveToLocalStorage(maskedEntry);
    }
  }

  private saveToLocalStorage(entry: DebugLogEntry): void {
    try {
      const logs = this.getLogsFromStorage();
      logs.push(entry);
      
      // 最大件数を超えたら古いものを削除
      if (logs.length > this.maxLocalStorageEntries) {
        logs.splice(0, logs.length - this.maxLocalStorageEntries);
      }
      
      localStorage.setItem('debug_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save debug log to localStorage:', error);
    }
  }

  private getLogsFromStorage(): DebugLogEntry[] {
    try {
      const logs = localStorage.getItem('debug_logs');
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get debug logs from localStorage:', error);
      return [];
    }
  }

  private saveLogsToStorage(): void {
    // 現在のセッションのログのみを保存
    // 実装は必要に応じて拡張
  }

  // ユーザー情報を設定
  setUser(userId: string, username: string): void {
    this.userId = userId;
    this.username = username;
  }

  clearUser(): void {
    this.userId = undefined;
    this.username = undefined;
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
      sessionId: this.sessionId,
      operation,
      message,
      data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      metadata: {
        url: window.location.href,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent,
        userId: this.userId,
        username: this.username,
        ...metadata
      }
    };

    this.writeLog(entry);
  }

  // 便利メソッド - ナビゲーション追跡
  navigationStart(fromPath: string, toPath: string): void {
    this.info(
      DebugLogCategory.NAVIGATION,
      'route_change',
      `Navigation started`,
      {
        from: fromPath,
        to: toPath
      },
      {
        component: 'Router'
      }
    );
  }

  navigationComplete(path: string, duration?: number): void {
    this.info(
      DebugLogCategory.NAVIGATION,
      'route_change',
      `Navigation completed`,
      {
        path
      },
      {
        component: 'Router',
        duration
      }
    );
  }

  // API呼び出し追跡
  apiStart(operation: string, method: string, url: string, data?: any): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    this.info(
      DebugLogCategory.API,
      operation,
      `API request started`,
      {
        requestId,
        method,
        url,
        requestData: data
      },
      {
        method,
        url
      }
    );
    
    return requestId;
  }

  apiSuccess(operation: string, requestId: string, response: any, duration?: number): void {
    this.info(
      DebugLogCategory.API,
      operation,
      `API request successful`,
      {
        requestId,
        response: response ? (typeof response === 'object' ? Object.keys(response) : response) : undefined
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

  // フォーム処理追跡
  formStart(formName: string, operation: string): void {
    this.info(
      DebugLogCategory.FORM,
      operation,
      `Form operation started`,
      {
        formName
      },
      {
        component: formName
      }
    );
  }

  formSuccess(formName: string, operation: string, result?: any): void {
    this.info(
      DebugLogCategory.FORM,
      operation,
      `Form operation successful`,
      {
        formName,
        result
      },
      {
        component: formName
      }
    );
  }

  formError(formName: string, operation: string, error: Error): void {
    this.error(
      DebugLogCategory.FORM,
      operation,
      `Form operation failed`,
      error,
      {
        formName
      },
      {
        component: formName
      }
    );
  }

  // ユーザーアクション追跡
  userAction(action: string, element: string, data?: any): void {
    this.info(
      DebugLogCategory.USER_ACTION,
      action,
      `User ${action}`,
      {
        element,
        data
      }
    );
  }

  // 認証関連
  authStart(operation: string): void {
    this.info(
      DebugLogCategory.AUTH,
      operation,
      `Authentication ${operation} started`
    );
  }

  authSuccess(operation: string, userId: string, username: string): void {
    this.setUser(userId, username);
    this.info(
      DebugLogCategory.AUTH,
      operation,
      `Authentication ${operation} successful`,
      {
        userId,
        username
      }
    );
  }

  authFailure(operation: string, reason: string): void {
    this.warn(
      DebugLogCategory.AUTH,
      operation,
      `Authentication ${operation} failed: ${reason}`
    );
  }

  authLogout(): void {
    this.info(
      DebugLogCategory.AUTH,
      'logout',
      `User logged out`,
      {
        userId: this.userId,
        username: this.username
      }
    );
    this.clearUser();
  }

  // WebSocket関連
  wsConnect(url: string): void {
    this.info(
      DebugLogCategory.WEBSOCKET,
      'connect',
      `WebSocket connection established`,
      {
        url
      }
    );
  }

  wsDisconnect(reason?: string): void {
    this.info(
      DebugLogCategory.WEBSOCKET,
      'disconnect',
      `WebSocket connection closed`,
      {
        reason
      }
    );
  }

  wsMessage(messageType: string, data?: any): void {
    this.debug(
      DebugLogCategory.WEBSOCKET,
      'message',
      `WebSocket message received`,
      {
        messageType,
        data
      }
    );
  }

  wsError(error: Error): void {
    this.error(
      DebugLogCategory.WEBSOCKET,
      'error',
      `WebSocket error occurred`,
      error
    );
  }

  // 状態変更追跡
  stateChange(component: string, operation: string, oldState?: any, newState?: any): void {
    this.debug(
      DebugLogCategory.STATE,
      operation,
      `State changed in ${component}`,
      {
        oldState,
        newState
      },
      {
        component
      }
    );
  }

  // エラーハンドリング
  uncaughtError(error: Error, context?: string): void {
    this.error(
      DebugLogCategory.ERROR_HANDLER,
      'uncaught_error',
      `Uncaught error${context ? ` in ${context}` : ''}`,
      error
    );
  }

  // AI関連
  aiAnalysisStart(fieldName: string, contentLength: number): void {
    this.info(
      DebugLogCategory.AI,
      'analysis_start',
      `AI analysis started for field: ${fieldName}`,
      {
        fieldName,
        contentLength
      }
    );
  }

  aiAnalysisComplete(fieldName: string, resultLength: number, duration: number): void {
    this.info(
      DebugLogCategory.AI,
      'analysis_complete',
      `AI analysis completed for field: ${fieldName}`,
      {
        fieldName,
        resultLength
      },
      {
        duration
      }
    );
  }

  aiAnalysisError(fieldName: string, error: Error): void {
    this.error(
      DebugLogCategory.AI,
      'analysis_error',
      `AI analysis failed for field: ${fieldName}`,
      error,
      {
        fieldName
      }
    );
  }

  // デバッグ用のログ取得
  getLogs(): DebugLogEntry[] {
    return this.getLogsFromStorage();
  }

  // ログのクリア
  clearLogs(): void {
    if (this.enableLocalStorage) {
      localStorage.removeItem('debug_logs');
    }
  }

  // ログのエクスポート
  exportLogs(): string {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  }
}

// シングルトンインスタンス
export const debugLogger = new DebugLogger();

// グローバルエラーハンドラーを設定
window.addEventListener('error', (event) => {
  debugLogger.uncaughtError(
    new Error(event.message),
    `${event.filename}:${event.lineno}:${event.colno}`
  );
});

window.addEventListener('unhandledrejection', (event) => {
  debugLogger.uncaughtError(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    'unhandled promise rejection'
  );
});

// React Error Boundary用のヘルパー
export interface ErrorInfo {
  componentStack: string;
}

export function logReactError(error: Error, errorInfo: ErrorInfo): void {
  debugLogger.error(
    DebugLogCategory.ERROR_HANDLER,
    'react_error_boundary',
    'React component error',
    error,
    {
      componentStack: errorInfo.componentStack
    },
    {
      component: 'ErrorBoundary'
    }
  );
}