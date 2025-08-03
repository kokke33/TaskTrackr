import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "../../../utils/testUtils";
import userEvent from "@testing-library/user-event";
import { ConflictResolutionDialog } from "@/components/conflict-resolution-dialog";
import { WeeklyReport } from "@shared/schema";

// モックデータ
const createMockWeeklyReport = (overrides: Partial<WeeklyReport> = {}): WeeklyReport => ({
  id: 1,
  caseId: 1,
  reportPeriodStart: "2024-01-01",
  reportPeriodEnd: "2024-01-07",
  reporterName: "テストユーザー",
  weeklyTasks: "今週のタスク",
  progressRate: 50,
  progressStatus: "進行中",
  delayIssues: "なし",
  delayDetails: null,
  issues: "特になし",
  newRisks: "なし",
  riskSummary: null,
  riskCountermeasures: null,
  riskLevel: null,
  qualityConcerns: "なし",
  qualityDetails: null,
  testProgress: null,
  changes: "なし",
  changeDetails: null,
  nextWeekPlan: "来週の計画",
  supportRequests: "",
  resourceConcerns: "なし",
  resourceDetails: null,
  customerIssues: "なし",
  customerDetails: null,
  environmentIssues: "なし",
  environmentDetails: null,
  costIssues: "なし",
  costDetails: null,
  knowledgeIssues: "なし",
  knowledgeDetails: null,
  trainingIssues: "なし",
  trainingDetails: null,
  urgentIssues: "なし",
  urgentDetails: null,
  businessOpportunities: "なし",
  businessDetails: null,
  adminConfirmationEmail: null,
  version: 1,
  aiAnalysis: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

describe("ConflictResolutionDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnResolve = vi.fn();
  const mockOnReload = vi.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    localData: createMockWeeklyReport({
      weeklyTasks: "ローカルのタスク",
      progressRate: 60,
    }),
    serverData: createMockWeeklyReport({
      weeklyTasks: "サーバーのタスク",
      progressRate: 70,
    }),
    serverUsername: "田中太郎",
    onResolve: mockOnResolve,
    onReload: mockOnReload,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ダイアログが正しく表示される", () => {
    render(<ConflictResolutionDialog {...defaultProps} />);

    expect(screen.getByText("データ競合の解決")).toBeInTheDocument();
    
    // 複合テキストを検索するカスタムマッチャー（最初の要素を取得）
    const conflictMessages = screen.getAllByText((content, element) => {
      if (!element) return false;
      
      // 要素のテキストコンテンツ全体を取得
      const elementText = element.textContent || "";
      return elementText.includes("田中太郎") && elementText.includes("がこの報告書を更新しました");
    });
    
    expect(conflictMessages[0]).toBeInTheDocument();
  });

  it("競合する変更の数が正しく表示される", () => {
    render(<ConflictResolutionDialog {...defaultProps} />);

    // 2つのフィールドで競合があることを確認
    expect(screen.getByText("競合する変更 (2件)")).toBeInTheDocument();
  });

  it("競合するフィールドが正しく表示される", () => {
    render(<ConflictResolutionDialog {...defaultProps} />);

    expect(screen.getByText("今週のタスク")).toBeInTheDocument();
    expect(screen.getByText("進捗率")).toBeInTheDocument();
    expect(screen.getByText("ローカルのタスク")).toBeInTheDocument();
    expect(screen.getByText("サーバーのタスク")).toBeInTheDocument();
  });

  it("ローカルの変更を選択できる", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    // 最初の競合フィールドでローカルの変更を選択
    const useLocalButtons = screen.getAllByText("この値を使用");
    await user.click(useLocalButtons[0]); // ローカル版の最初のボタン

    expect(screen.getByText("選択済み")).toBeInTheDocument();
  });

  it("サーバーの変更を選択できる", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    // 最初の競合フィールドでサーバーの変更を選択
    const useServerButtons = screen.getAllByText("この値を使用");
    await user.click(useServerButtons[1]); // サーバー版の最初のボタン

    expect(screen.getByText("選択済み")).toBeInTheDocument();
  });

  it("すべての競合を解決するまで保存ボタンが無効", () => {
    render(<ConflictResolutionDialog {...defaultProps} />);

    const saveButton = screen.getByText("競合を解決して保存");
    expect(saveButton).toBeDisabled();
  });

  it("すべての競合を解決すると保存ボタンが有効になる", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    // すべての競合フィールドで選択
    const useLocalButtons = screen.getAllByText("この値を使用");
    
    // 最初の競合（weeklyTasks）でローカル選択
    await user.click(useLocalButtons[0]);
    
    // 2番目の競合（progressRate）でサーバー選択
    await user.click(useLocalButtons[3]); // サーバー版の2番目

    const saveButton = screen.getByText("競合を解決して保存");
    expect(saveButton).toBeEnabled();
  });

  it("保存ボタンクリックでonResolveが呼ばれる", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    // すべての競合を解決
    const useLocalButtons = screen.getAllByText("この値を使用");
    await user.click(useLocalButtons[0]); // 1つ目はローカル
    await user.click(useLocalButtons[3]); // 2つ目はサーバー

    const saveButton = screen.getByText("競合を解決して保存");
    await user.click(saveButton);

    expect(mockOnResolve).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyTasks: "ローカルのタスク", // ローカル選択
        progressRate: 70, // サーバー選択
      })
    );
  });

  it("再読み込みボタンクリックでonReloadが呼ばれる", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    const reloadButton = screen.getByText("ページを再読み込み");
    await user.click(reloadButton);

    expect(mockOnReload).toHaveBeenCalled();
  });

  it("競合がない場合は適切なメッセージを表示", () => {
    const propsWithNoConflicts = {
      ...defaultProps,
      localData: createMockWeeklyReport(),
      serverData: createMockWeeklyReport(), // 同じデータ
    };

    render(<ConflictResolutionDialog {...propsWithNoConflicts} />);

    expect(screen.getByText("競合する変更はありません")).toBeInTheDocument();
    expect(screen.getByText("競合する変更 (0件)")).toBeInTheDocument();
  });

  it("ダイアログを閉じるとonOpenChangeが呼ばれる", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    // Escapeキーでダイアログを閉じる
    await user.keyboard("{Escape}");

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("差分ハイライトが正しく動作する", () => {
    const propsWithDifference = {
      ...defaultProps,
      localData: createMockWeeklyReport({
        weeklyTasks: "タスクA\nタスクB",
      }),
      serverData: createMockWeeklyReport({
        weeklyTasks: "タスクA\nタスクC",
      }),
    };

    render(<ConflictResolutionDialog {...propsWithDifference} />);

    // HTMLのマークアップが含まれていることを確認（差分ハイライト）
    const localContent = screen.getByText("あなたの変更").closest(".space-y-2");
    const serverContent = screen.getByText("田中太郎の変更").closest(".space-y-2");

    expect(localContent).toBeInTheDocument();
    expect(serverContent).toBeInTheDocument();
  });

  it("serverUsernameのデフォルト値が正しく表示される", () => {
    const propsWithoutUsername = {
      ...defaultProps,
      serverUsername: undefined,
    };

    render(<ConflictResolutionDialog {...propsWithoutUsername} />);

    // 複合テキストを検索するカスタムマッチャー（最初の要素を取得）
    const defaultUsernameMessages = screen.getAllByText((content, element) => {
      if (!element) return false;
      
      // 要素のテキストコンテンツ全体を取得
      const elementText = element.textContent || "";
      return elementText.includes("他のユーザー") && elementText.includes("がこの報告書を更新しました");
    });
    
    expect(defaultUsernameMessages[0]).toBeInTheDocument();
  });

  it("フィールドラベルが正しく表示される", () => {
    render(<ConflictResolutionDialog {...defaultProps} />);

    // 各フィールドの日本語ラベルが表示されていることを確認
    expect(screen.getByText("今週のタスク")).toBeInTheDocument();
    expect(screen.getByText("進捗率")).toBeInTheDocument();
  });

  it("選択状態のバッジが正しく表示される", async () => {
    const user = userEvent.setup();
    render(<ConflictResolutionDialog {...defaultProps} />);

    // ローカルの変更を選択
    const useLocalButtons = screen.getAllByText("この値を使用");
    await user.click(useLocalButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("あなたの変更を選択済み")).toBeInTheDocument();
    });

    // サーバーの変更を選択（別のフィールド）
    await user.click(useLocalButtons[3]);

    await waitFor(() => {
      expect(screen.getByText("田中太郎の変更を選択済み")).toBeInTheDocument();
    });
  });
});