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
  const res = await fetch(url, {
    method: options.method,
    headers: options.data ? { "Content-Type": "application/json" } : {},
    body: options.data ? JSON.stringify(options.data) : undefined,
    credentials: "include",  // 常にクレデンシャルを送信
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
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // 認証エラーの場合はリトライしない
        if (error instanceof Error && error.message.startsWith("401:")) {
          return false;
        }
        return failureCount < 3;  // その他のエラーは3回までリトライ
      },
    },
    mutations: {
      retry: false,
    },
  },
});