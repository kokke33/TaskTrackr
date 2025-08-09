import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers } from "./__mocks__/handlers";

// React Testing Libraryのクリーンアップ
afterEach(() => {
  cleanup();
});

// MSW（Mock Service Worker）設定 - クライアントテストで自動有効化
const isClientTest = process.cwd().includes('client') || 
                    process.env.NODE_ENV === 'test' && 
                    (process.env.VITEST_ENVIRONMENT === 'jsdom' || typeof window !== 'undefined');

// 環境変数による制御: VITEST_DISABLE_MSW=true で強制無効、VITEST_ENABLE_MSW=true で強制有効
const useMSW = process.env.VITEST_DISABLE_MSW === 'true' ? false :
               process.env.VITEST_ENABLE_MSW === 'true' ? true :
               isClientTest; // デフォルトはクライアントテストでのみ有効

const server = useMSW ? setupServer(...handlers) : null;

beforeAll(() => {
  if (server) {
    server.listen({ onUnhandledRequest: 'bypass' });
  }
});

afterEach(() => {
  if (server) {
    server.resetHandlers();
  }
});

afterAll(() => {
  if (server) {
    server.close();
  }
});

// テスト用のグローバル設定（DOM環境でのみ実行）
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Wouter（ルーター）のテスト用設定
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      pathname: "/",
      search: "",
      hash: "",
    },
  });
}

// React Hook Formのテスト用設定
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// console警告を抑制（テスト実行時のノイズ削減）
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};