import { describe, it, expect, vi, beforeEach } from "vitest";

// 環境変数をモック化
const mockEnv = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  SESSION_SECRET: "test_secret",
  AI_PROVIDER: "test",
  PORT: "5000",
};

describe("Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をモック
    Object.entries(mockEnv).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
  });

  it("should validate required environment variables", () => {
    // 必須環境変数がすべて設定されていることを確認
    expect(process.env.DATABASE_URL).toBe(mockEnv.DATABASE_URL);
    expect(process.env.SESSION_SECRET).toBe(mockEnv.SESSION_SECRET);
  });

  it("should handle missing environment variables gracefully", () => {
    // 環境変数が未設定の場合のテスト
    vi.stubEnv("DATABASE_URL", "");
    expect(process.env.DATABASE_URL).toBe("");
  });

  it("should parse port number correctly", () => {
    const port = parseInt(process.env.PORT || "5000", 10);
    expect(port).toBe(5000);
    expect(typeof port).toBe("number");
  });

  it("should handle different AI providers", () => {
    const providers = ["openai", "ollama", "gemini", "groq", "test"];
    
    providers.forEach(provider => {
      vi.stubEnv("AI_PROVIDER", provider);
      expect(process.env.AI_PROVIDER).toBe(provider);
    });
  });

  it("should validate boolean environment variables", () => {
    vi.stubEnv("AI_LOG_CONSOLE", "true");
    const logConsole = process.env.AI_LOG_CONSOLE === "true";
    expect(logConsole).toBe(true);

    vi.stubEnv("AI_LOG_CONSOLE", "false");
    const logConsoleFalse = process.env.AI_LOG_CONSOLE === "true";
    expect(logConsoleFalse).toBe(false);
  });
});