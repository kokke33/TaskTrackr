import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { performanceMonitor } from "@shared/performance-monitor";
import { debugLogger, DebugLogCategory } from "@/utils/debug-logger";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    
    // 401エラーの詳細ログ
    if (res.status === 401) {
      debugLogger.authFailed('session_expired', res.url, {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        timestamp: new Date().toISOString()
      });
    }
    
    throw error;
  }
}

export async function apiRequest<T = any>(
  url: string,
  options: {
    method: string;
    data?: unknown;
    skipAuthRetry?: boolean; // 認証リトライをスキップする場合
  }
): Promise<T> {
  const timer = performanceMonitor.startTimer('api', `${options.method} ${url}`);
  const requestId = debugLogger.apiStart(`api_request`, options.method, url, options.data);

  const performRequest = async (): Promise<Response> => {
    return await fetch(url, {
      method: options.method,
      headers: options.data ? { "Content-Type": "application/json" } : {},
      body: options.data ? JSON.stringify(options.data) : undefined,
      credentials: "include",  // 常にクレデンシャルを送信
    });
  };

  let res: Response;
  const startTime = Date.now();
  
  try {
    res = await performRequest();

  // 401エラーかつ認証リトライが無効でない場合、セッション確認を1回試行
  if (res.status === 401 && !options.skipAuthRetry && url !== "/api/check-auth") {
    console.log("🔄 401エラー検出 - セッション確認を試行します");
    
    // セッション同期のため最小限の待機時間
    await new Promise(resolve => setTimeout(resolve, 300)); // 1000ms → 300ms 効率化
    
    try {
      // セッション確認を実行（無限ループ防止のためskipAuthRetryを設定）
      const authCheckRes = await fetch("/api/check-auth", {
        method: "GET",
        credentials: "include",
      });
      
      if (authCheckRes.ok) {
        const authData = await authCheckRes.json();
        if (authData.authenticated) {
          console.log("✅ セッション確認成功 - リクエストを再試行します");
          // セッションが有効なら元のリクエストを再試行
          res = await performRequest();
        } else {
          debugLogger.authFailed('session_redirect', '/login', {
            reason: 'セッション期限切れを確認',
            originalUrl: url
          });
          console.log("❌ セッション期限切れを確認 - ログインページにリダイレクト");
          // セッション期限切れの場合はログインページへ
          window.location.href = "/login";
          throw new Error("Session expired");
        }
      } else {
        // セッション確認APIが401を返した場合、直接セッション期限切れと判断
        debugLogger.authFailed('session_expired_direct', url, {
          reason: 'セッション確認API認証失敗',
          status: authCheckRes.status
        });
        console.log("❌ セッション期限切れ（直接判定） - ログインページにリダイレクト");
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    } catch (authError) {
      // Session expiredエラーの場合は再スローする
      if (authError instanceof Error && authError.message === "Session expired") {
        throw authError;
      }
      console.error("セッション確認中にエラー:", authError);
      // 他のセッション確認エラーは元の401エラーを処理
    }
  }

    await throwIfResNotOk(res);
    const result = await res.json() as T;
    
    // パフォーマンス計測終了（成功）
    const finalDuration = Date.now() - startTime;
    timer.end({
      status: res.status,
      method: options.method,
      url,
      hasData: !!options.data
    }, true);
    
    debugLogger.apiSuccess(`api_request`, requestId, result, finalDuration);
    
    return result;
  } catch (error) {
    // パフォーマンス計測終了（エラー）
    const finalDuration = Date.now() - startTime;
    timer.end({
      method: options.method,
      url,
      hasData: !!options.data
    }, false, error instanceof Error ? error.message : String(error));
    
    debugLogger.apiError(`api_request`, requestId, error instanceof Error ? error : new Error(String(error)), finalDuration);
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",  // 常にクレデンシャルを送信
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        // apiRequestを使用して認証リトライロジックを有効化
        return await apiRequest(queryKey[0] as string, { method: "GET" });
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000, // デフォルト2分間キャッシュ（従来のInfinityから変更）
      gcTime: 5 * 60 * 1000, // 5分後にガベージコレクション
      retry: (failureCount, error) => {
        // 認証エラーの場合は既にapiRequest内でリトライ済みなので、ここではリトライしない
        if (error instanceof Error && 
            (error.message.startsWith("401:") || error.message === "Session expired")) {
          return false; // apiRequest内で認証リトライ済み、またはセッション期限切れ
        }
        return failureCount < 2;  // 3回→2回に削減して効率化
      },
      retryDelay: (attemptIndex) => {
        // より短いリトライ間隔: 500ms, 1s
        return Math.min(500 * (attemptIndex + 1), 5000);
      },
    },
    mutations: {
      retry: false,
    },
  },
});