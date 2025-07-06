export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface AILogEntry {
  timestamp: string;
  level: LogLevel;
  provider: 'openai' | 'ollama' | 'gemini' | 'groq';
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

  constructor() {
    this.logLevel = (process.env.AI_LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.enableConsole = process.env.AI_LOG_CONSOLE !== 'false';
    this.enableFile = process.env.AI_LOG_FILE === 'true';
    this.maskSensitiveData = process.env.AI_LOG_MASK_SENSITIVE !== 'false';
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
      'api-key', 'x-api-key', 'openai-api-key'
    ];

    if (typeof data === 'string') {
      // API Key pattern matching
      return data.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***MASKED***')
                 .replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, 'Bearer ***MASKED***');
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

    return JSON.stringify(maskedEntry, null, 2);
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

    // File logging implementation would go here if needed
    if (this.enableFile) {
      // TODO: Implement file logging with rotation
    }
  }

  logRequest(
    provider: 'openai' | 'ollama' | 'gemini' | 'groq',
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
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      provider,
      operation,
      requestId,
      userId,
      request: {
        ...request,
        size: JSON.stringify(request.body).length
      },
      metadata
    };

    this.writeLog(entry);
  }

  logResponse(
    provider: 'openai' | 'ollama' | 'gemini' | 'groq',
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
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      provider,
      operation,
      requestId,
      userId,
      request: {
        endpoint: '',
        method: '',
        headers: {},
        body: null,
        size: 0
      },
      response: {
        ...response,
        size: JSON.stringify(response.body).length
      },
      metadata
    };

    this.writeLog(entry);
  }

  logError(
    provider: 'openai' | 'ollama' | 'gemini' | 'groq',
    operation: string,
    requestId: string,
    error: Error,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      provider,
      operation,
      requestId,
      userId,
      request: {
        endpoint: '',
        method: '',
        headers: {},
        body: null,
        size: 0
      },
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      metadata
    };

    this.writeLog(entry);
  }

  logDebug(
    provider: 'openai' | 'ollama' | 'gemini' | 'groq',
    operation: string,
    requestId: string,
    message: string,
    data?: any,
    userId?: string
  ): void {
    const entry: AILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      provider,
      operation,
      requestId,
      userId,
      request: {
        endpoint: '',
        method: '',
        headers: {},
        body: null,
        size: 0
      },
      metadata: {
        message,
        data: this.maskSensitiveInfo(data)
      }
    };

    this.writeLog(entry);
  }
}

// シングルトンインスタンス
export const aiLogger = new AILogger();

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
