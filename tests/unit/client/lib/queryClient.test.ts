import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

// このテストファイル専用でMSWを無効化
process.env.VITEST_DISABLE_MSW = 'true';

// MSWインターセプターを完全に無効化
vi.mock('msw/node', () => ({
  setupServer: vi.fn(() => null),
}));

vi.mock('@mswjs/interceptors', () => ({}));

// fetchの基本モックを使用
const mockFetch = vi.fn();



// パフォーマンスモニターのモック（エラーを防ぐために最小限の実装）
vi.mock("@shared/performance-monitor", () => ({
  performanceMonitor: {
    startTimer: vi.fn(() => ({
      end: vi.fn(),
    })),
  },
}));

// window.location のモック
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

// document.cookie のモック
Object.defineProperty(document, 'cookie', {
  value: 'sessionId=test-session',
  writable: true,
});

// URL オブジェクトのモック（無限再帰を避けるため、ネイティブURLを保存）
const OriginalURL = global.URL;
const URLMock = vi.fn().mockImplementation((url, base) => {
  try {
    // urlが文字列でない場合の対処
    if (typeof url !== 'string') {
      url = String(url);
    }
    
    // 相対URLの場合は base または デフォルトベースを使用
    const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url.startsWith('/') ? url : '/' + url}`;
    const urlObj = new OriginalURL(fullUrl);
    return {
      ...urlObj,
      href: fullUrl,
      origin: 'http://localhost:3000',
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
    };
  } catch (error) {
    // フォールバック: 基本的なURLオブジェクトを返す
    const urlStr = typeof url === 'string' ? url : String(url);
    return {
      href: urlStr,
      origin: 'http://localhost:3000',
      pathname: urlStr.startsWith('/') ? urlStr : '/' + urlStr,
      search: '',
      hash: '',
    };
  }
});
global.URL = URLMock as any;

describe("queryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    console.log = vi.fn();
    console.info = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("apiRequest", () => {
    it("成功時に正しくレスポンスを返すこと", async () => {
      const mockResponse = { data: "test data" };
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue("application/json"),
        },
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      const result = await apiRequest("/api/test", {
        method: "GET",
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("POSTリクエストでデータを正しく送信すること", async () => {
      const requestData = { name: "test", value: 123 };
      const mockResponse = { success: true };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      const result = await apiRequest("/api/test", {
        method: "POST",
        data: requestData,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("HTTPエラー時に適切なエラーを投げること", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        text: () => Promise.resolve("Resource not found"),
        clone: vi.fn(),
      });

      await expect(
        apiRequest("/api/nonexistent", { method: "GET" })
      ).rejects.toThrow("404: Resource not found");
    });

    it("401エラー時にセッション確認とリトライを行うこと", async () => {
      // 最初は401エラー
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: {
            get: vi.fn().mockReturnValue(null),
          },
          text: () => Promise.resolve("Unauthorized"),
          clone: vi.fn(),
        })
        // セッション確認は成功
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: {
            get: vi.fn().mockReturnValue(null),
          },
          json: () => Promise.resolve({ authenticated: true }),
          clone: vi.fn(),
        })
        // リトライは成功
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: {
            get: vi.fn().mockReturnValue(null),
          },
          json: () => Promise.resolve({ data: "success after retry" }),
          clone: vi.fn(),
        });

      const result = await apiRequest("/api/protected", {
        method: "GET",
      });

      expect(result).toEqual({ data: "success after retry" });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("セッション期限切れ時にログインページにリダイレクトすること", async () => {
      // URLベースでレスポンスを分ける
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/protected')) {
          // /api/protectedは401エラー
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            headers: {
              get: vi.fn().mockReturnValue(null),
            },
            text: () => Promise.resolve("Unauthorized"),
            clone: vi.fn(),
          });
        } else if (typeof url === 'string' && url.includes('/api/check-auth')) {
          // /api/check-authはauthenticated=false
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: {
              get: vi.fn().mockReturnValue(null),
            },
            json: () => Promise.resolve({ authenticated: false }),
            clone: vi.fn(),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await expect(
        apiRequest("/api/protected", { method: "GET" })
      ).rejects.toThrow("Session expired");

      expect(window.location.href).toBe("/login");
    });

    it("skipAuthRetryフラグが設定されている場合、認証リトライを行わないこと", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue([]),
        },
        text: () => Promise.resolve("Unauthorized"),
        clone: vi.fn(),
      });

      await expect(
        apiRequest("/api/protected", {
          method: "GET",
          skipAuthRetry: true,
        })
      ).rejects.toThrow("401: Unauthorized");

      // リトライが行われないため、fetchは1回だけ呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("check-authエンドポイントでは認証リトライを行わないこと", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue([]),
        },
        text: () => Promise.resolve("Unauthorized"),
        clone: vi.fn(),
      });

      await expect(
        apiRequest("/api/check-auth", { method: "GET" })
      ).rejects.toThrow("401: Unauthorized");

      // リトライが行われないため、fetchは1回だけ呼ばれる
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("パフォーマンス測定が正しく行われること", async () => {
      const mockTimer = {
        end: vi.fn(),
      };
      
      const { performanceMonitor } = await import("@shared/performance-monitor");
      vi.mocked(performanceMonitor.startTimer).mockReturnValue(mockTimer as any);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: () => Promise.resolve({ data: "test" }),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      await apiRequest("/api/test", { method: "GET" });

      expect(performanceMonitor.startTimer).toHaveBeenCalledWith(
        "api",
        "GET /api/test"
      );
      expect(mockTimer.end).toHaveBeenCalledWith(
        {
          status: 200,
          method: "GET",
          url: "/api/test",
          hasData: false,
        },
        true
      );
    });

    it("エラー時にパフォーマンス測定が正しく終了すること", async () => {
      const mockTimer = {
        end: vi.fn(),
      };
      
      const { performanceMonitor } = await import("@shared/performance-monitor");
      vi.mocked(performanceMonitor.startTimer).mockReturnValue(mockTimer as any);

      const error = new Error("Network error");
      mockFetch.mockRejectedValue(error);

      await expect(
        apiRequest("/api/test", { method: "GET" })
      ).rejects.toThrow("Network error");

      expect(mockTimer.end).toHaveBeenCalledWith(
        {
          method: "GET",
          url: "/api/test",
          hasData: false,
        },
        false,
        "Network error"
      );
    });
  });

  describe("getQueryFn", () => {
    it("成功時に正しくデータを返すこと", async () => {
      const mockData = { items: [1, 2, 3] };
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: () => Promise.resolve(mockData),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      const queryFn = getQueryFn({ on401: "throw" });
      const result = await queryFn({
        queryKey: ["/api/items"],
        signal: new AbortController().signal,
      } as any);

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("401エラー時にon401='returnNull'でnullを返すこと", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        text: () => Promise.resolve("Unauthorized"),
        clone: vi.fn(),
      });

      const queryFn = getQueryFn({ on401: "returnNull" });
      const result = await queryFn({
        queryKey: ["/api/protected"],
        signal: new AbortController().signal,
      } as any);

      expect(result).toBeNull();
    });

    it("401エラー時にon401='throw'でエラーを投げること", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue([]),
        },
        text: () => Promise.resolve("Unauthorized"),
        clone: vi.fn(),
      });

      const queryFn = getQueryFn({ on401: "throw" });

      await expect(
        queryFn({
          queryKey: ["/api/protected"],
          signal: new AbortController().signal,
        } as any)
      ).rejects.toThrow("401: Unauthorized");
    });

    it("その他のHTTPエラー時にエラーを投げること", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        text: () => Promise.resolve("Server Error"),
        clone: vi.fn(),
      });

      const queryFn = getQueryFn({ on401: "returnNull" });

      await expect(
        queryFn({
          queryKey: ["/api/error"],
          signal: new AbortController().signal,
        } as any)
      ).rejects.toThrow("500: Server Error");
    });
  });

  describe("queryClient設定", () => {
    it("デフォルト設定が正しく設定されていること", () => {
      const defaultOptions = queryClient.getDefaultOptions();

      expect(defaultOptions.queries?.staleTime).toBe(2 * 60 * 1000); // 2分
      expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000); // 5分
      expect(defaultOptions.queries?.refetchInterval).toBe(false);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
      expect(defaultOptions.mutations?.retry).toBe(false);
    });

    it("リトライロジックが正しく動作すること", () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;

      // 401エラーの場合はリトライしない（apiRequest内で処理済み）
      const authError = new Error("401: Unauthorized");
      expect(retryFn(0, authError)).toBe(false);
      expect(retryFn(1, authError)).toBe(false);

      // セッション期限切れもリトライしない
      const sessionError = new Error("Session expired");
      expect(retryFn(0, sessionError)).toBe(false);

      // その他のエラーは2回までリトライ（failureCount < 2）
      const otherError = new Error("500: Internal Server Error");
      expect(retryFn(0, otherError)).toBe(true);
      expect(retryFn(1, otherError)).toBe(true);
      expect(retryFn(2, otherError)).toBe(false);
    });

    it("リトライ遅延が正しく動作すること", () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryDelayFn = defaultOptions.queries?.retryDelay as Function;

      // Math.min(500 * (attemptIndex + 1), 5000)
      expect(retryDelayFn(0)).toBe(500); // 500 * 1 = 500ms
      expect(retryDelayFn(1)).toBe(1000); // 500 * 2 = 1000ms
      expect(retryDelayFn(2)).toBe(1500); // 500 * 3 = 1500ms
      expect(retryDelayFn(9)).toBe(5000); // 500 * 10 = 5000ms（最大値）
      expect(retryDelayFn(10)).toBe(5000); // Math.min(5500, 5000) = 5000ms（最大値制限）
    });
  });

  describe("ログ出力", () => {
    it("APIリクエスト時に適切なログが出力されること", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      await apiRequest("/api/test", {
        method: "POST",
        data: { test: "data" },
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] [api] api_request: API request started"),
        expect.objectContaining({
          requestId: expect.any(String)
        })
      );

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] [api] api_request: API request successful"),
        expect.objectContaining({
          requestId: expect.any(String)
        })
      );
    });

    it("401エラー時に詳細なエラーログが出力されること", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue("Bearer"),
          entries: vi.fn().mockReturnValue([["www-authenticate", "Bearer"]]),
        },
        text: () => Promise.resolve("Unauthorized"),
        clone: vi.fn(),
      });

      await expect(
        apiRequest("/api/protected", {
          method: "GET",
          skipAuthRetry: true,
        })
      ).rejects.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] [auth] session_expired: Authentication failed for session_expired"),
        expect.objectContaining({
          status: 401,
          statusText: "Unauthorized",
        }),
        expect.any(String)
      );
    });
  });
});