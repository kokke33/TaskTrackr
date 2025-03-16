
import { QueryClient } from "@tanstack/react-query";

// カスタムフェッチ関数
async function customFetch(queryKey: string[]) {
  try {
    const url = queryKey[0];
    console.log('Fetching URL:', url);

    const res = await fetch(url, {
      credentials: 'include', // 常にクッキーを送信
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // レスポンスのデバッグログ
    console.log('Query response:', {
      url: queryKey[0],
      status: res.status,
      statusText: res.statusText,
    });

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// 他のコンポーネントから使用されるapiRequest関数
export async function apiRequest(
  url: string,
  options: {
    method: string;
    data?: unknown;
  }
): Promise<Response> {
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

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  
  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => customFetch(queryKey as string[]),
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});
