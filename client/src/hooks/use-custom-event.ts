import { useEffect } from 'react';

/**
 * カスタムイベントを使用するためのフック
 * コンポーネント間で通信するために使用します
 */
export function useCustomEvent<T = any>(
  eventName: string,
  callback?: (data: T) => void,
) {
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
  const dispatchEvent = (data: T) => {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  };

  return dispatchEvent;
}