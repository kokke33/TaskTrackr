import { useEffect } from 'react';

interface CustomEventEmitter<T> {
  (data: T): void;
  on: (callback: (data: T) => void) => () => void;
}

/**
 * カスタムイベントを使用するためのフック
 * コンポーネント間で通信するために使用します
 * 
 * @param eventName イベント名
 * @param callback イベントが発生したときに呼び出される関数（オプショナル）
 * @returns イベントをディスパッチする関数とリスナーを追加するためのメソッドを持つオブジェクト
 */
export function useCustomEvent<T = any>(
  eventName: string,
  callback?: (data: T) => void,
): CustomEventEmitter<T> {
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

  // イベントをディスパッチする関数
  const dispatchEvent = ((data: T) => {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  }) as CustomEventEmitter<T>;

  // on メソッドを追加（リスナー登録用）
  dispatchEvent.on = (listener: (data: T) => void) => {
    const handleEvent = (event: CustomEvent<T>) => {
      listener(event.detail);
    };
    
    window.addEventListener(eventName, handleEvent as EventListener);
    
    // クリーンアップ関数を返す
    return () => {
      window.removeEventListener(eventName, handleEvent as EventListener);
    };
  };

  return dispatchEvent;
}