import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: {
    method: string;
    data?: unknown;
  }
): Promise<Response> {
  // デバッグ用のログ
  console.log('Sending request to:', url, {
    method: options.method,
    credentials: 'include',
    headers: options.data ? { "Content-Type": "application/json" } : {},
  });

  const res = await fetch(url, {
    method: options.method,
    headers: {
      ...options.data ? { "Content-Type": "application/json" } : {},
      "Accept": "application/json",
      "Cache-Control": "no-cache",
    },
    body: options.data ? JSON.stringify(options.data) : undefined,
    credentials: "include", // 常にクレデンシャルを含める
  });

  // レスポンスのデバッグログ
  console.log('Response from:', url, {
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // デバッグ用のログ
    console.log('Executing query:', queryKey[0]);

    const res = await fetch(queryKey[0] as string, {
      credentials: "include", // 常にクレデンシャルを含める
      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache",
      },
    });

    // レスポンスのデバッグログ
    console.log('Query response:', {
      url: queryKey[0],
      status: res.status,
      statusText: res.statusText,
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
      refetchOnWindowFocus: true, // ウィンドウにフォーカスが戻った時に再取得
      retry: 1, // エラー時に1回だけリトライ
      staleTime: 30000, // 30秒間はキャッシュを使用
    },
    mutations: {
      retry: 1, // エラー時に1回だけリトライ
    },
  },
});