import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAIService,
  getAIServiceForProvider,
  generateResponseStream,
  generateSummary,
  analyzeTask,
  analyzeText,
} from "../../../server/ai-service";
import type { IAiProvider, AIMessage, AIResponse } from "../../../server/ai-providers/iai-provider";

// モックの設定
const mockOpenAIService = {
  generateResponse: vi.fn(),
  supportsStreaming: false,
  generateStreamResponse: undefined,
  provider: "OpenAI" as const,
  cleanThinkTags: vi.fn((content: string) => content),
};

const mockGeminiService = {
  generateResponse: vi.fn(),
  supportsStreaming: true,
  generateStreamResponse: vi.fn(),
  provider: "Gemini" as const,
  cleanThinkTags: vi.fn((content: string) => content),
};

const mockOllamaService = {
  generateResponse: vi.fn(),
  supportsStreaming: false,
  generateStreamResponse: undefined,
  provider: "Ollama" as const,
  cleanThinkTags: vi.fn((content: string) => content),
};

const mockGroqService = {
  generateResponse: vi.fn(),
  supportsStreaming: false,
  generateStreamResponse: undefined,
  provider: "Groq" as const,
  cleanThinkTags: vi.fn((content: string) => content),
};

const mockOpenRouterService = {
  generateResponse: vi.fn(),
  supportsStreaming: false,
  generateStreamResponse: undefined,
  provider: "OpenRouter" as const,
  cleanThinkTags: vi.fn((content: string) => content),
};

vi.mock("../../../server/ai-providers/openai-provider", () => ({
  OpenAIService: vi.fn().mockImplementation(() => mockOpenAIService),
}));

vi.mock("../../../server/ai-providers/gemini-provider", () => ({
  GeminiService: vi.fn().mockImplementation(() => mockGeminiService),
}));

vi.mock("../../../server/ai-providers/ollama-provider", () => ({
  OllamaService: vi.fn().mockImplementation(() => mockOllamaService),
}));

vi.mock("../../../server/ai-providers/groq-provider", () => ({
  GroqService: vi.fn().mockImplementation(() => mockGroqService),
}));

vi.mock("../../../server/ai-providers/openrouter-provider", () => ({
  OpenRouterService: vi.fn().mockImplementation(() => mockOpenRouterService),
}));

vi.mock("../../../server/config", () => ({
  aiConfig: {
    provider: "openai",
    openai: { model: "gpt-4o-mini" },
    gemini: { model: "gemini-2.5-flash" },
    groq: { model: "llama-3.1-70b-versatile" },
    openrouter: { model: "anthropic/claude-3.5-sonnet" },
  },
  getDynamicAIConfig: vi.fn(),
}));

// Use casesのモック
vi.mock("../../../server/use-cases/generate-summary.usecase", () => ({
  generateSummary: vi.fn(),
}));

vi.mock("../../../server/use-cases/analyze-task.usecase", () => ({
  analyzeTask: vi.fn(),
}));

vi.mock("../../../server/use-cases/analyze-text.usecase", () => ({
  analyzeText: vi.fn(),
}));

vi.mock("../../../server/use-cases/analyze-text-stream.usecase", () => ({
  analyzeTextStream: vi.fn(),
}));

vi.mock("../../../server/use-cases/generate-admin-confirmation-email.usecase", () => ({
  generateAdminConfirmationEmail: vi.fn(),
}));

describe("AI Service", () => {
  let mockGetDynamicAIConfig: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // インポート後にモックを取得
    const configModule = await import("../../../server/config");
    mockGetDynamicAIConfig = vi.mocked(configModule.getDynamicAIConfig);
    
    mockGetDynamicAIConfig.mockResolvedValue({
      provider: "openai",
      openai: { model: "gpt-4o-mini" },
      gemini: { model: "gemini-2.5-flash" },
      groq: { model: "llama-3.1-70b-versatile" },
      openrouter: { model: "anthropic/claude-3.5-sonnet" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAIService", () => {
    it("OpenAIプロバイダーのサービスを取得できること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "openai",
        openai: { model: "gpt-4o-mini" },
      });

      const service = await getAIService();

      expect(service).toBeDefined();
      expect(service.provider).toBe("OpenAI");
    });

    it("Geminiプロバイダーのサービスを取得できること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "gemini",
        gemini: { model: "gemini-2.5-flash" },
      });

      const service = await getAIService();

      expect(service).toBeDefined();
      expect(service.provider).toBe("Gemini");
    });

    it("プロバイダーが変更された場合、新しいサービスインスタンスを作成すること", async () => {
      // 最初はOpenAI
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "openai",
        openai: { model: "gpt-4o-mini" },
      });

      const openaiService = await getAIService();
      expect(openaiService.provider).toBe("OpenAI");

      // Geminiに変更
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "gemini",
        gemini: { model: "gemini-2.5-flash" },
      });

      const geminiService = await getAIService();
      expect(geminiService.provider).toBe("Gemini");
    });

    it("同じプロバイダーの場合、既存のサービスインスタンスを再利用すること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "openai",
        openai: { model: "gpt-4o-mini" },
      });

      const service1 = await getAIService();
      const service2 = await getAIService();

      expect(service1).toBe(service2);
    });
  });

  describe("getAIServiceForProvider", () => {
    it("指定されたプロバイダーのサービスを作成できること", () => {
      const openaiService = getAIServiceForProvider("openai");
      expect(openaiService.provider).toBe("OpenAI");

      const geminiService = getAIServiceForProvider("gemini", undefined, "gemini-2.5-flash");
      expect(geminiService.provider).toBe("Gemini");

      const ollamaService = getAIServiceForProvider("ollama");
      expect(ollamaService.provider).toBe("Ollama");

      const groqService = getAIServiceForProvider("groq", "llama-3.1-70b-versatile");
      expect(groqService.provider).toBe("Groq");

      const openrouterService = getAIServiceForProvider("openrouter", undefined, undefined, "anthropic/claude-3.5-sonnet");
      expect(openrouterService.provider).toBe("OpenRouter");
    });

    it("サポートされていないプロバイダーでエラーを投げること", () => {
      expect(() => {
        getAIServiceForProvider("unsupported" as any);
      }).toThrow("Unsupported AI provider: unsupported");
    });
  });

  describe("generateResponseStream", () => {
    it("ストリーミングをサポートするプロバイダーでストリーミング応答を生成すること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "gemini",
        gemini: { model: "gemini-2.5-flash" },
      });

      const mockStreamResponse = async function* () {
        yield "Part 1";
        yield "Part 2";
        yield "Part 3";
      };

      mockGeminiService.generateStreamResponse = vi.fn().mockReturnValue(mockStreamResponse());

      const messages: AIMessage[] = [
        { role: "user", content: "テストメッセージ" },
      ];

      const stream = await generateResponseStream(messages, "user1", { test: true });

      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["Part 1", "Part 2", "Part 3"]);
      expect(mockGeminiService.generateStreamResponse).toHaveBeenCalledWith(
        messages,
        "user1",
        { test: true }
      );
    });

    it("ストリーミングをサポートしないプロバイダーで通常の応答を返すこと", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "openai",
        openai: { model: "gpt-4o-mini" },
      });

      const mockResponse: AIResponse = {
        content: "Complete response",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };

      mockOpenAIService.generateResponse = vi.fn().mockResolvedValue(mockResponse);

      const messages: AIMessage[] = [
        { role: "user", content: "テストメッセージ" },
      ];

      const stream = await generateResponseStream(messages, "user1");

      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["Complete response"]);
      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        messages,
        "user1",
        undefined
      );
    });
  });

  describe("Use Cases", () => {
    it("generateSummary が正しくエクスポートされていること", () => {
      expect(generateSummary).toBeDefined();
      expect(typeof generateSummary).toBe("function");
    });

    it("analyzeTask が正しくエクスポートされていること", () => {
      expect(analyzeTask).toBeDefined();
      expect(typeof analyzeTask).toBe("function");
    });

    it("analyzeText が正しくエクスポートされていること", () => {
      expect(analyzeText).toBeDefined();
      expect(typeof analyzeText).toBe("function");
    });
  });

  describe("プロバイダー固有の機能", () => {
    it("各プロバイダーが適切な設定で初期化されること", () => {
      // Mock constructorsが呼ばれることをテスト
      getAIServiceForProvider("openai");
      getAIServiceForProvider("gemini", undefined, "gemini-2.5-flash");
      getAIServiceForProvider("groq", "llama-3.1-70b-versatile");
      getAIServiceForProvider("openrouter", undefined, undefined, "anthropic/claude-3.5-sonnet");

      // サービスが正しく作成されることを確認
      expect(getAIServiceForProvider("openai").provider).toBe("OpenAI");
      expect(getAIServiceForProvider("gemini").provider).toBe("Gemini");
      expect(getAIServiceForProvider("groq").provider).toBe("Groq");
      expect(getAIServiceForProvider("openrouter").provider).toBe("OpenRouter");
    });

    it("ストリーミング機能の検出が正しく動作すること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "gemini",
        gemini: { model: "gemini-2.5-flash" },
      });

      const service = await getAIService();
      expect(service.supportsStreaming).toBe(true);
      expect(service.generateStreamResponse).toBeDefined();
    });

    it("非ストリーミングプロバイダーの検出が正しく動作すること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "openai",
        openai: { model: "gpt-4o-mini" },
      });

      const service = await getAIService();
      expect(service.supportsStreaming).toBe(false);
      expect(service.generateStreamResponse).toBeUndefined();
    });
  });

  describe("エラーハンドリング", () => {
    it("サポートされていないプロバイダーでエラーを投げること", () => {
      expect(() => {
        getAIServiceForProvider("unsupported" as any);
      }).toThrow("Unsupported AI provider: unsupported");
    });
  });

  describe("メタデータとユーザーID", () => {
    it("メタデータとユーザーIDが正しく渡されること", async () => {
      mockGetDynamicAIConfig.mockResolvedValue({
        provider: "openai",
        openai: { model: "gpt-4o-mini" },
      });

      const mockResponse: AIResponse = {
        content: "Test response",
        usage: {
          promptTokens: 5,
          completionTokens: 10,
          totalTokens: 15,
        },
      };

      mockOpenAIService.generateResponse = vi.fn().mockResolvedValue(mockResponse);

      const messages: AIMessage[] = [
        { role: "user", content: "テストメッセージ" },
      ];

      const metadata = { sessionId: "session123", feature: "test" };
      const userId = "user456";

      await generateResponseStream(messages, userId, metadata);

      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        messages,
        userId,
        metadata
      );
    });
  });
});