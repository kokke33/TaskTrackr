import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { AuthProvider } from "@/lib/auth";

// テスト用のQueryClient設定
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

// テスト用のプロバイダーコンポーネント
interface AllTheProvidersProps {
  children: React.ReactNode;
  initialPath?: string;
}

const AllTheProviders = ({ children, initialPath = "/" }: AllTheProvidersProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <Router base={initialPath}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
};

// カスタムレンダー関数
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialPath?: string;
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialPath, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders initialPath={initialPath}>
      {children}
    </AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// テスト用のユーティリティ関数
export const createMockUser = (overrides = {}) => ({
  id: 1,
  username: "testuser",
  isAdmin: false,
  ...overrides,
});

export const createMockFormData = (data: Record<string, any>) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });
  return formData;
};

// 非同期処理の待機用ユーティリティ
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// 再エクスポート
export * from "@testing-library/react";
export { customRender as render };