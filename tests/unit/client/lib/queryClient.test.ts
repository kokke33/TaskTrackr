import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

// fetch のモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
const URLMock = vi.fn().mockImplementation((url) => {
  const urlObj = new OriginalURL(url);
  return {
    ...urlObj,
    href: url,
    origin: 'http://localhost:3000',
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
  };
});
global.URL = URLMock as any;

describe("queryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("apiRequest", () => {
    it("成功時に正しくレスポンスを返すこと", async () => {
      const mockResponse = { data: "test data" };
      const headers = new Map([["content-type", "application/json"]]);
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue("application/json"),
          entries: vi.fn().mockReturnValue(headers.entries()),
        },
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      const result = await apiRequest("/api/test", {
        method: "GET",
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith("/api/test", {
        method: "GET",
        headers: {},
        body: undefined,
        credentials: "include",
      });
    });

    it("POSTリクエストでデータを正しく送信すること", async () => {
      const requestData = { name: "test", value: 123 };
      const mockResponse = { success: true };
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
      expect(mockFetch).toHaveBeenCalledWith("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
        credentials: "include",
      });
    });

    it("HTTPエラー時に適切なエラーを投げること", async () => {
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
        },
        text: () => Promise.resolve("Resource not found"),
        clone: vi.fn(),
      });

      await expect(
        apiRequest("/api/nonexistent", { method: "GET" })
      ).rejects.toThrow("404: Resource not found");
    });

    it("401エラー時にセッション確認とリトライを行うこと", async () => {
      const headers = new Map();
      
      // 最初は401エラー
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: {
            get: vi.fn().mockReturnValue(null),
            entries: vi.fn().mockReturnValue(headers.entries()),
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
            entries: vi.fn().mockReturnValue(headers.entries()),
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
            entries: vi.fn().mockReturnValue(headers.entries()),
          },
          json: () => Promise.resolve({ data: "success after retry" }),
          clone: vi.fn(),
        });

      const result = await apiRequest("/api/protected", {
        method: "GET",
      });

      expect(result).toEqual({ data: "success after retry" });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // セッション確認の呼び出しを確認
      expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/check-auth", {
        method: "GET",
        credentials: "include",
      });
    });

    it("セッション期限切れ時にログインページにリダイレクトすること", async () => {
      const headers = new Map();
      
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
              entries: vi.fn().mockReturnValue(headers.entries()),
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
              entries: vi.fn().mockReturnValue(headers.entries()),
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
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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

      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
      const headers = new Map();
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
      expect(mockFetch).toHaveBeenCalledWith("/api/items", {
        credentials: "include",
      });
    });

    it("401エラー時にon401='returnNull'でnullを返すこと", async () => {
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
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

      // 401エラーの場合は1回だけリトライ
      const authError = new Error("401: Unauthorized");
      expect(retryFn(0, authError)).toBe(true);
      expect(retryFn(1, authError)).toBe(false);

      // その他のエラーは3回までリトライ
      const otherError = new Error("500: Internal Server Error");
      expect(retryFn(0, otherError)).toBe(true);
      expect(retryFn(1, otherError)).toBe(true);
      expect(retryFn(2, otherError)).toBe(true);
      expect(retryFn(3, otherError)).toBe(false);
    });

    it("リトライ遅延が指数バックオフで動作すること", () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryDelayFn = defaultOptions.queries?.retryDelay as Function;

      expect(retryDelayFn(0)).toBe(1000); // 1秒
      expect(retryDelayFn(1)).toBe(2000); // 2秒
      expect(retryDelayFn(2)).toBe(4000); // 4秒
      expect(retryDelayFn(3)).toBe(8000); // 8秒
      expect(retryDelayFn(10)).toBe(30000); // 最大30秒
    });
  });

  describe("ログ出力", () => {
    it("APIリクエスト時に適切なログが出力されること", async () => {
      const headers = new Map();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: vi.fn().mockReturnValue(null),
          entries: vi.fn().mockReturnValue(headers.entries()),
        },
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
        clone: vi.fn(),
      });

      await apiRequest("/api/test", {
        method: "POST",
        data: { test: "data" },
      });

      expect(console.log).toHaveBeenCalledWith(
        "[API REQUEST] POST /api/test",
        expect.objectContaining({
          data: { test: "data" },
          cookies: "sessionId=test-session",
          timestamp: expect.any(String),
        })
      );

      expect(console.log).toHaveBeenCalledWith(
        "[API RESPONSE] POST /api/test - Status: 200",
        expect.objectContaining({
          status: 200,
          statusText: "OK",
        })
      );
    });

    it("401エラー時に詳細なエラーログが出力されること", async () => {
      const headers = new Map([["www-authenticate", "Bearer"]]);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: vi.fn().mockReturnValue("Bearer"),
          entries: vi.fn().mockReturnValue(headers.entries()),
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
        expect.stringContaining("[AUTH ERROR] 401 Unauthorized"),
        expect.objectContaining({
          status: 401,
          statusText: "Unauthorized",
          timestamp: expect.any(String),
        })
      );
    });
  });
});