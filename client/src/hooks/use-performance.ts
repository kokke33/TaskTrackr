/**
 * フロントエンドパフォーマンス監視フック
 * コンポーネントのレンダリング時間とライフサイクルイベントを追跡
 */

import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor } from '@shared/performance-monitor';

interface UsePerformanceOptions {
  componentName: string;
  enableRenderMeasurement?: boolean;
  enableLifecycleMeasurement?: boolean;
  threshold?: number; // ms
}

interface PerformanceHookReturn {
  measureRender: (renderPhase: 'mount' | 'update' | 'unmount') => void;
  measureOperation: (operationName: string, operation: () => void | Promise<void>) => Promise<void>;
  startMeasurement: (name: string) => () => void;
}

export function usePerformance(options: UsePerformanceOptions): PerformanceHookReturn {
  const {
    componentName,
    enableRenderMeasurement = true,
    enableLifecycleMeasurement = true,
    threshold = 16.67 // 60fps = 16.67ms per frame
  } = options;

  const renderTimerRef = useRef<ReturnType<typeof performanceMonitor.startTimer> | null>(null);
  const mountTimeRef = useRef<number>(Date.now());

  // コンポーネントマウント時の計測開始
  useEffect(() => {
    if (enableLifecycleMeasurement) {
      const timer = performanceMonitor.startTimer('render', `${componentName}_mount`);
      const mountStartTime = performance.now();
      
      // 次のフレームで計測完了（実際のレンダリング完了を待つ）
      requestAnimationFrame(() => {
        const mountDuration = performance.now() - mountStartTime;
        timer.end({
          componentName,
          phase: 'mount',
          exceedsThreshold: mountDuration > threshold
        }, true);
      });

      // アンマウント時の清理
      return () => {
        if (enableLifecycleMeasurement) {
          const unmountTimer = performanceMonitor.startTimer('render', `${componentName}_unmount`);
          requestAnimationFrame(() => {
            unmountTimer.end({
              componentName,
              phase: 'unmount',
              lifetimeMs: Date.now() - mountTimeRef.current
            }, true);
          });
        }
      };
    }
  }, [componentName, enableLifecycleMeasurement, threshold]);

  // レンダリング計測
  const measureRender = useCallback((renderPhase: 'mount' | 'update' | 'unmount') => {
    if (!enableRenderMeasurement) return;

    // 前回の計測が完了していない場合は完了させる
    if (renderTimerRef.current) {
      renderTimerRef.current.end({
        componentName,
        phase: renderPhase,
        interrupted: true
      }, false);
    }

    const timer = performanceMonitor.startTimer('render', `${componentName}_${renderPhase}`);
    renderTimerRef.current = timer;

    // 次のフレームで計測完了
    requestAnimationFrame(() => {
      if (renderTimerRef.current === timer) {
        const duration = performance.now() - timer['startTime'];
        timer.end({
          componentName,
          phase: renderPhase,
          exceedsThreshold: duration > threshold
        }, true);
        renderTimerRef.current = null;
      }
    });
  }, [componentName, enableRenderMeasurement, threshold]);

  // 汎用操作計測
  const measureOperation = useCallback(async (operationName: string, operation: () => void | Promise<void>) => {
    const timer = performanceMonitor.startTimer('render', `${componentName}_${operationName}`);
    
    try {
      const result = operation();
      if (result instanceof Promise) {
        await result;
      }
      timer.end({
        componentName,
        operationName,
        type: 'operation'
      }, true);
    } catch (error) {
      timer.end({
        componentName,
        operationName,
        type: 'operation'
      }, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [componentName]);

  // 手動計測開始（終了関数を返す）
  const startMeasurement = useCallback((name: string) => {
    const timer = performanceMonitor.startTimer('render', `${componentName}_${name}`);
    
    return () => {
      timer.end({
        componentName,
        measurementName: name,
        type: 'manual'
      }, true);
    };
  }, [componentName]);

  return {
    measureRender,
    measureOperation,
    startMeasurement
  };
}

// 重いコンポーネント用の高レベルフック
export function useHeavyComponentPerformance(componentName: string) {
  return usePerformance({
    componentName,
    enableRenderMeasurement: true,
    enableLifecycleMeasurement: true,
    threshold: 100 // 100ms以上で警告
  });
}

// リスト系コンポーネント用のフック
export function useListPerformance(componentName: string, itemCount: number) {
  return usePerformance({
    componentName: `${componentName}_${itemCount}items`,
    enableRenderMeasurement: true,
    enableLifecycleMeasurement: false,
    threshold: Math.max(16.67, itemCount * 0.5) // アイテム数に応じた動的閾値
  });
}

// フォーム系コンポーネント用のフック
export function useFormPerformance(componentName: string) {
  const perf = usePerformance({
    componentName,
    enableRenderMeasurement: true,
    enableLifecycleMeasurement: true,
    threshold: 50 // フォームは50ms以上で警告
  });

  // フォーム特有の操作計測
  const measureFormOperation = useCallback(async (
    operationType: 'validation' | 'submission' | 'fieldUpdate',
    operation: () => void | Promise<void>
  ) => {
    return perf.measureOperation(`form_${operationType}`, operation);
  }, [perf.measureOperation]);

  return {
    ...perf,
    measureFormOperation
  };
}