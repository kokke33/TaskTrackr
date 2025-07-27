/**
 * パフォーマンス監視システム
 * API応答時間、データベースクエリ、フロントエンドレンダリングを監視
 */

export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: 'api' | 'database' | 'render' | 'bundle';
  name: string;
  duration: number;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

export interface PerformanceThresholds {
  api: {
    warning: number;  // ms
    critical: number; // ms
  };
  database: {
    warning: number;
    critical: number;
  };
  render: {
    warning: number;
    critical: number;
  };
  bundle: {
    warning: number;
    critical: number;
  };
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // メモリ使用量制限
  private thresholds: PerformanceThresholds = {
    api: { warning: 500, critical: 2000 },
    database: { warning: 100, critical: 500 },
    render: { warning: 16, critical: 100 }, // 60fps = 16.67ms
    bundle: { warning: 5000, critical: 10000 } // バンドルサイズ(KB)
  };

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * パフォーマンス計測を開始
   */
  public startTimer(type: PerformanceMetric['type'], name: string): PerformanceTimer {
    return new PerformanceTimer(this, type, name);
  }

  /**
   * メトリクスを記録
   */
  public recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...metric
    };

    this.metrics.push(fullMetric);

    // メトリクス数制限
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 閾値チェック
    this.checkThresholds(fullMetric);

    // 開発環境でのリアルタイムログ
    if (process.env.NODE_ENV === 'development') {
      this.logMetric(fullMetric);
    }
  }

  /**
   * メトリクス統計を取得
   */
  public getStats(type?: PerformanceMetric['type'], timeWindow?: number): PerformanceStats {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    let filteredMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
    if (type) {
      filteredMetrics = filteredMetrics.filter(m => m.type === type);
    }

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        p95Duration: 0,
        p99Duration: 0
      };
    }

    const durations = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successCount = filteredMetrics.filter(m => m.success).length;

    return {
      count: filteredMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: successCount / filteredMetrics.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)]
    };
  }

  /**
   * 最近のメトリクスを取得
   */
  public getRecentMetrics(count: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * 閾値を設定
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.type];
    if (!threshold) return;

    if (metric.duration >= threshold.critical) {
      console.warn(`🚨 CRITICAL: ${metric.type} '${metric.name}' took ${metric.duration}ms (threshold: ${threshold.critical}ms)`);
    } else if (metric.duration >= threshold.warning) {
      console.warn(`⚠️ WARNING: ${metric.type} '${metric.name}' took ${metric.duration}ms (threshold: ${threshold.warning}ms)`);
    }
  }

  private logMetric(metric: PerformanceMetric): void {
    const status = metric.success ? '✅' : '❌';
    console.log(`${status} [PERF] ${metric.type.toUpperCase()} ${metric.name}: ${metric.duration}ms`, {
      ...metric.metadata,
      threshold: this.thresholds[metric.type]
    });
  }
}

export class PerformanceTimer {
  private startTime: number;

  constructor(
    private monitor: PerformanceMonitor,
    private type: PerformanceMetric['type'],
    private name: string
  ) {
    this.startTime = performance.now();
  }

  /**
   * 計測を終了してメトリクスを記録
   */
  public end(metadata?: Record<string, any>, success: boolean = true, errorMessage?: string): void {
    const duration = performance.now() - this.startTime;
    
    this.monitor.recordMetric({
      type: this.type,
      name: this.name,
      duration,
      metadata,
      success,
      errorMessage
    });
  }
}

export interface PerformanceStats {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  p95Duration: number;
  p99Duration: number;
}

// シングルトンインスタンス
export const performanceMonitor = PerformanceMonitor.getInstance();

// ユーティリティ関数
export function measureAsync<T>(
  type: PerformanceMetric['type'],
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const timer = performanceMonitor.startTimer(type, name);
  
  return fn()
    .then(result => {
      timer.end(metadata, true);
      return result;
    })
    .catch(error => {
      timer.end(metadata, false, error instanceof Error ? error.message : String(error));
      throw error;
    });
}

export function measureSync<T>(
  type: PerformanceMetric['type'],
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const timer = performanceMonitor.startTimer(type, name);
  
  try {
    const result = fn();
    timer.end(metadata, true);
    return result;
  } catch (error) {
    timer.end(metadata, false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}