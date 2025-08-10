import { http, HttpResponse } from "msw";

// APIのモックハンドラー
export const handlers = [
  // 認証関連
  http.post("/api/auth/login", () => {
    return HttpResponse.json({
      user: {
        id: 1,
        username: "testuser",
        isAdmin: false,
      },
    });
  }),


  http.get("/api/auth/me", () => {
    return HttpResponse.json({
      user: {
        id: 1,
        username: "testuser",
        isAdmin: false,
      },
    });
  }),

  // プロジェクト関連
  http.get("/api/projects", () => {
    return HttpResponse.json([
      {
        id: 1,
        name: "テストプロジェクト",
        overview: "テスト用のプロジェクトです",
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  http.post("/api/projects", () => {
    return HttpResponse.json({
      id: 2,
      name: "新規プロジェクト",
      overview: "新しく作成されたプロジェクト",
      createdAt: new Date().toISOString(),
    });
  }),

  // ケース関連
  http.get("/api/cases", () => {
    return HttpResponse.json([
      {
        id: 1,
        name: "テストケース",
        projectId: 1,
        status: "進行中",
        priority: "高",
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // 週次レポート関連
  http.get("/api/weekly-reports", () => {
    return HttpResponse.json([
      {
        id: 1,
        caseId: 1,
        weekStartDate: new Date().toISOString(),
        progressSummary: "テスト用の進捗概要",
        tasksCompleted: "完了したタスク",
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // AI分析関連
  http.post("/api/ai/analyze", () => {
    return HttpResponse.json({
      analysis: "テスト用のAI分析結果",
      suggestions: ["改善提案1", "改善提案2"],
    });
  }),
];