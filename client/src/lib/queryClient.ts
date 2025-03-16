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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => customFetch(queryKey as string[]),
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});