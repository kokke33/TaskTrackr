import { useEffect, useCallback } from 'react';

/**
 * カスタムイベントを使用するためのフック
 * コンポーネント間で通信するために使用します
 * 
 * @param eventName イベント名
 * @param callback イベントが発生したときに呼び出される関数（オプショナル）
 * @returns イベントをディスパッチする関数
 */
export function useCustomEvent<T = unknown>(
  eventName: string,
  callback?: (data: T) => void,
): (data: T) => void {
  // コールバック関数をuseEffectでラップして登録
  useEffect(() => {
    if (!callback) return;

    const handleEvent = (event: CustomEvent<T>) => {
      callback(event.detail);
    };

    // イベントリスナーを追加
    window.addEventListener(eventName, handleEvent as EventListener);

    // クリーンアップ関数
    return () => {
      window.removeEventListener(eventName, handleEvent as EventListener);
    };
  }, [eventName, callback]);

  // イベントをディスパッチする関数を返す
  const dispatchEvent = useCallback((data: T) => {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  }, [eventName]);

  return dispatchEvent;
}