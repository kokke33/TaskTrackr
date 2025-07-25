import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    
    // 401エラーの詳細ログ
    if (res.status === 401) {
      console.error(`[AUTH ERROR] 401 Unauthorized for ${res.url}`, {
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
  console.log(`[API REQUEST] ${options.method} ${url}`, {
    data: options.data,
    cookies: document.cookie,
    timestamp: new Date().toISOString()
  });

  const performRequest = async (): Promise<Response> => {
    return await fetch(url, {
      method: options.method,
      headers: options.data ? { "Content-Type": "application/json" } : {},
      body: options.data ? JSON.stringify(options.data) : undefined,
      credentials: "include",  // 常にクレデンシャルを送信
    });
  };

  let res = await performRequest();

  console.log(`[API RESPONSE] ${options.method} ${url} - Status: ${res.status}`, {
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries())
  });

  // 401エラーかつ認証リトライが無効でない場合、セッション確認を1回試行
  if (res.status === 401 && !options.skipAuthRetry && url !== "/api/check-auth") {
    console.log("🔄 401エラー検出 - セッション確認を試行します");
    
    // セッション同期のため待機時間を延長
    await new Promise(resolve => setTimeout(resolve, 1000)); // 500ms → 1000ms
    
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
          console.log("❌ セッション期限切れを確認 - ログインページにリダイレクト");
          // セッション期限切れの場合はログインページへ
          window.location.href = "/login";
          throw new Error("Session expired");
        }
      }
    } catch (authError) {
      console.error("セッション確認中にエラー:", authError);
      // セッション確認に失敗した場合は元の401エラーを処理
    }
  }

  await throwIfResNotOk(res);
  return await res.json() as T;
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
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000, // デフォルト2分間キャッシュ（従来のInfinityから変更）
      gcTime: 5 * 60 * 1000, // 5分後にガベージコレクション
      retry: (failureCount, error) => {
        // 認証エラーの場合は1回だけリトライ（一時的なセッション問題の可能性）
        if (error instanceof Error && error.message.startsWith("401:")) {
          return failureCount < 1;
        }
        return failureCount < 3;  // その他のエラーは3回までリトライ
      },
      retryDelay: (attemptIndex) => {
        // 指数バックオフ: 1秒、2秒、4秒...
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
    },
    mutations: {
      retry: false,
    },
  },
});