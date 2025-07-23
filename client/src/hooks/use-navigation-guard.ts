import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";

export type NavigationGuardAction = "save" | "discard" | "cancel";

type UseNavigationGuardProps = {
  shouldBlock: boolean;
  onNavigationAttempt: (targetPath: string) => Promise<NavigationGuardAction>;
};

export function useNavigationGuard({ 
  shouldBlock, 
  onNavigationAttempt 
}: UseNavigationGuardProps) {
  const [, setLocation] = useLocation();
  const isNavigatingRef = useRef(false);
  const originalPushStateRef = useRef(window.history.pushState);

  console.log("🔍 Navigation guard initialized - shouldBlock:", shouldBlock);

  // ブラウザの beforeunload イベントをハンドル
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldBlock && !isNavigatingRef.current) {
        event.preventDefault();
        event.returnValue = "未保存の変更があります。このページを離れますか？";
        return event.returnValue;
      }
    };

    if (shouldBlock) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldBlock]);

  // history.pushState をオーバーライド
  useEffect(() => {
    if (shouldBlock) {
      const originalPushState = window.history.pushState;
      originalPushStateRef.current = originalPushState;

      window.history.pushState = function(state: any, title: string, url?: string | URL | null) {
        console.log("🔍 Navigation guard - pushState intercepted:", { url, shouldBlock, isNavigating: isNavigatingRef.current });
        
        if (shouldBlock && !isNavigatingRef.current && url) {
          const targetPath = typeof url === 'string' ? url : url?.toString() || '';
          console.log("🔍 Navigation guard - blocking pushState to:", targetPath);
          
          
          // ナビゲーションフラグを即座に設定して重複呼び出しを防ぐ
          isNavigatingRef.current = true;
          
          // 非同期で確認ダイアログを表示
          onNavigationAttempt(targetPath).then((action) => {
            console.log("🔍 Navigation guard - pushState action:", action);
            
            if (action !== "cancel") {
              // WouterのsetLocationを使用してクライアントサイドルーティング
              console.log("🔍 Using Wouter setLocation for:", targetPath);
              setLocation(targetPath);
            }
            // フラグをリセット
            isNavigatingRef.current = false;
          }).catch((error) => {
            console.error("Navigation guard error:", error);
            isNavigatingRef.current = false;
          });
          
          return;
        }
        
        // ガードが無効または既にナビゲーション中の場合は通常通り実行
        originalPushState.call(window.history, state, title, url);
      };
    }

    return () => {
      // 元のpushStateを復元
      if (originalPushStateRef.current) {
        window.history.pushState = originalPushStateRef.current;
      }
    };
  }, [shouldBlock, onNavigationAttempt]);

  // リンククリックをインターセプト（フォールバック）
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {      
      if (!shouldBlock || isNavigatingRef.current) {
        return;
      }

      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (!link) {
        return;
      }

      const href = link.getAttribute('href');
      
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      // 外部リンクは除外
      if (href.startsWith('http') && !href.startsWith(window.location.origin)) {
        return;
      }

      console.log("🔍 Navigation guard - link click intercepted:", href);
      
      event.preventDefault();
      event.stopPropagation();

      try {
        const action = await onNavigationAttempt(href);
        console.log("🔍 Navigation guard - link action:", action);
        
        if (action !== "cancel") {
          isNavigatingRef.current = true;
          // WouterのsetLocationを使用してクライアントサイドルーティング
          console.log("🔍 Using Wouter setLocation for link:", href);
          setLocation(href);
          isNavigatingRef.current = false;
        }
      } catch (error) {
        console.error("Navigation guard error:", error);
      }
    };

    if (shouldBlock) {
      document.addEventListener("click", handleClick, true);
    }

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [shouldBlock, onNavigationAttempt]);

  const allowNavigation = useCallback(() => {
    isNavigatingRef.current = false;
  }, []);

  const navigate = useCallback(async (path: string) => {
    if (shouldBlock && !isNavigatingRef.current) {
      try {
        const action = await onNavigationAttempt(path);
        if (action !== "cancel") {
          isNavigatingRef.current = true;
          window.location.href = path;
        }
      } catch (error) {
        console.error("Navigation guard error:", error);
      }
    } else {
      window.location.href = path;
    }
  }, [shouldBlock, onNavigationAttempt]);

  return {
    allowNavigation,
    navigate,
    isNavigating: isNavigatingRef.current,
  };
}