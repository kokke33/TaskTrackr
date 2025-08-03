import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyReport from "@/pages/weekly-report";

// モックの設定
vi.mock("wouter", () => ({
  useParams: vi.fn().mockReturnValue({ id: "1" }),
  useLocation: vi.fn().mockReturnValue(["/weekly-report/1", vi.fn()]),
}));

vi.mock("@/hooks/use-weekly-report-form.ts", () => ({
  useWeeklyReportForm: vi.fn().mockReturnValue({
    form: {
      control: {},
      getValues: vi.fn(),
      setValue: vi.fn(),
      watch: vi.fn(),
      handleSubmit: vi.fn().mockReturnValue(vi.fn()),
      formState: { errors: {}, isDirty: false },
    },
    isEditMode: true,
    isAdminEditMode: false,
    reportId: 1,
    existingReport: {
      id: 1,
      version: 1,
      reportPeriodStart: "2024-01-01",
      reportPeriodEnd: "2024-01-07",
      reporterName: "テスト太郎",
      caseId: 1,
      weeklyTasks: "テストタスク",
      progressRate: 50,
      progressStatus: "順調",
    },
    isLoadingReport: false,
    cases: [
      {
        id: 1,
        caseName: "テスト案件",
        projectName: "テストプロジェクト",
        isDeleted: false,
      },
    ],
    isLoadingCases: false,
    latestReport: null,
    selectedCaseId: 1,
    setSelectedCaseId: vi.fn(),
    isSubmitting: false,
    onSubmit: vi.fn(),
    copyFromLastReport: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-report-auto-save.ts", () => ({
  useReportAutoSave: vi.fn().mockReturnValue({
    lastSavedTime: null,
    isAutosaving: false,
    formChanged: false,
    version: 1,
    handleManualAutoSave: vi.fn(),
    handleImmediateSave: vi.fn(),
    updateVersion: vi.fn(),
    resetConflictResolving: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-meeting-minutes-generator.ts", () => ({
  useMeetingMinutesGenerator: vi.fn().mockReturnValue({
    generateMinutes: vi.fn(),
    isGenerating: false,
    generatedMinutes: null,
  }),
}));

vi.mock("@/hooks/use-ai-analysis.ts", () => ({
  useAIAnalysis: vi.fn().mockReturnValue({
    analyzeField: vi.fn(),
    isAnalyzing: false,
    analysisResults: {},
    hasRunAnalysis: {},
    error: null,
  }),
}));

vi.mock("@/contexts/useWebSocket.ts", () => ({
  useWebSocket: vi.fn().mockReturnValue({
    lastMessage: null,
    sendMessage: vi.fn(),
    status: "open",
    editingUsers: [],
    currentUserId: 1,
  }),
}));

vi.mock("@/hooks/use-performance.ts", () => ({
  useFormPerformance: vi.fn().mockReturnValue({
    measureFormOperation: vi.fn(),
    measureRender: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-navigation-guard.ts", () => ({
  useNavigationGuard: vi.fn().mockReturnValue({
    hasUnsavedChanges: false,
    registerGuard: vi.fn(),
    unregisterGuard: vi.fn(),
  }),
  NavigationGuardAction: {
    SAVE_AND_PROCEED: "save_and_proceed",
    DISCARD_AND_PROCEED: "discard_and_proceed",
    CANCEL: "cancel",
  },
}));

// コンポーネントのモック
vi.mock("@/components/weekly-report/report-header", () => ({
  ReportHeader: () => <div data-testid="report-header">Report Header</div>,
}));

vi.mock("@/components/weekly-report/basic-info-form", () => ({
  BasicInfoForm: () => <div data-testid="basic-info-form">Basic Info Form</div>,
}));

vi.mock("@/components/weekly-report/task-details-section", () => ({
  TaskDetailsSection: () => <div data-testid="task-details-section">Task Details Section</div>,
}));

vi.mock("@/components/weekly-report/meeting-minutes", () => ({
  MeetingMinutes: () => <div data-testid="meeting-minutes">Meeting Minutes</div>,
}));

vi.mock("@/components/ai-analysis-result", () => ({
  AIAnalysisResult: () => <div data-testid="ai-analysis-result">AI Analysis Result</div>,
}));

vi.mock("@/components/editing-users-indicator", () => ({
  EditingUsersIndicator: () => <div data-testid="editing-users-indicator">Editing Users Indicator</div>,
}));

vi.mock("@/components/milestone-dialog", () => ({
  MilestoneDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="milestone-dialog">Milestone Dialog</div> : null,
}));

vi.mock("@/components/sample-report-dialog", () => ({
  SampleReportDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="sample-report-dialog">Sample Report Dialog</div> : null,
}));

vi.mock("@/components/navigation-confirm-dialog", () => ({
  NavigationConfirmDialog: () => <div data-testid="navigation-confirm-dialog">Navigation Confirm Dialog</div>,
}));

vi.mock("@/components/conflict-resolution-dialog", () => ({
  ConflictResolutionDialog: () => <div data-testid="conflict-resolution-dialog">Conflict Resolution Dialog</div>,
}));

// React Hook Form Provider のモック
vi.mock("react-hook-form", () => ({
  FormProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useFormContext: vi.fn().mockReturnValue({
    control: {},
    getValues: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn(),
    formState: { errors: {} },
  }),
}));

describe("WeeklyReport Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWeeklyReport = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WeeklyReport />
      </QueryClientProvider>
    );
  };

  it("ページが正しくレンダリングされること", async () => {
    renderWeeklyReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-header")).toBeInTheDocument();
      expect(screen.getByTestId("basic-info-form")).toBeInTheDocument();
      expect(screen.getByTestId("task-details-section")).toBeInTheDocument();
      expect(screen.getByTestId("editing-users-indicator")).toBeInTheDocument();
    });
  });

  it("編集モードでの主要コンポーネントが表示されること", async () => {
    renderWeeklyReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-header")).toBeInTheDocument();
      expect(screen.getByTestId("basic-info-form")).toBeInTheDocument();
      expect(screen.getByTestId("task-details-section")).toBeInTheDocument();
      expect(screen.getByTestId("meeting-minutes")).toBeInTheDocument();
    });
  });

  it("WebSocket接続状態が正しく管理されること", async () => {
    const { useWebSocket } = await import("@/contexts/useWebSocket");
    const mockUseWebSocket = vi.mocked(useWebSocket);
    
    renderWeeklyReport();

    // WebSocketフックが呼ばれることを確認
    expect(mockUseWebSocket).toHaveBeenCalled();
  });

  it("フォーム機能が正しく初期化されること", async () => {
    const { useWeeklyReportForm } = await import("@/hooks/use-weekly-report-form");
    const mockUseWeeklyReportForm = vi.mocked(useWeeklyReportForm);
    
    renderWeeklyReport();

    // フォームフックが正しいパラメータで呼ばれることを確認
    expect(mockUseWeeklyReportForm).toHaveBeenCalledWith({ id: "1" });
  });

  it("自動保存機能が正しく初期化されること", async () => {
    const { useReportAutoSave } = await import("@/hooks/use-report-auto-save");
    const mockUseReportAutoSave = vi.mocked(useReportAutoSave);
    
    renderWeeklyReport();

    // 自動保存フックが正しいパラメータで呼ばれることを確認
    expect(mockUseReportAutoSave).toHaveBeenCalledWith(
      expect.objectContaining({
        isEditMode: true,
        id: "1",
        currentVersion: 1,
        onVersionConflict: expect.any(Function),
      })
    );
  });

  it("AI分析機能が正しく初期化されること", async () => {
    const { useAIAnalysis } = await import("@/hooks/use-ai-analysis");
    const mockUseAIAnalysis = vi.mocked(useAIAnalysis);
    
    renderWeeklyReport();

    // AI分析フックが呼ばれることを確認
    expect(mockUseAIAnalysis).toHaveBeenCalled();
  });

  it("パフォーマンス監視が正しく初期化されること", async () => {
    const { useFormPerformance } = await import("@/hooks/use-performance");
    const mockUseFormPerformance = vi.mocked(useFormPerformance);
    
    renderWeeklyReport();

    // パフォーマンス監視フックが正しいパラメータで呼ばれることを確認
    expect(mockUseFormPerformance).toHaveBeenCalledWith("WeeklyReport");
  });

  it("会議議事録生成機能が正しく初期化されること", async () => {
    const { useMeetingMinutesGenerator } = await import("@/hooks/use-meeting-minutes-generator");
    const mockUseMeetingMinutesGenerator = vi.mocked(useMeetingMinutesGenerator);
    
    renderWeeklyReport();

    // 会議議事録生成フックが正しいパラメータで呼ばれることを確認
    expect(mockUseMeetingMinutesGenerator).toHaveBeenCalledWith({
      reportId: 1,
      isEditMode: true,
    });
  });

  it("ナビゲーションガードが正しく初期化されること", async () => {
    const { useNavigationGuard } = await import("@/hooks/use-navigation-guard");
    const mockUseNavigationGuard = vi.mocked(useNavigationGuard);
    
    renderWeeklyReport();

    // ナビゲーションガードフックが呼ばれることを確認
    expect(mockUseNavigationGuard).toHaveBeenCalled();
  });

  it("必要な状態が正しく管理されること", async () => {
    renderWeeklyReport();

    // コンポーネントが正常にレンダリングされることで、
    // 内部の状態管理が正しく動作していることを確認
    expect(screen.getByTestId("report-header")).toBeInTheDocument();
  });

  describe("データローディング状態", () => {
    it("ローディング中でも基本構造が表示されること", async () => {
      // ローディング状態のモック
      const { useWeeklyReportForm } = await import("@/hooks/use-weekly-report-form");
      vi.mocked(useWeeklyReportForm).mockReturnValue({
        form: { control: {}, getValues: vi.fn(), setValue: vi.fn(), watch: vi.fn(), handleSubmit: vi.fn().mockReturnValue(vi.fn()), formState: { errors: {} } },
        isEditMode: true,
        isAdminEditMode: false,
        reportId: 1,
        existingReport: null,
        isLoadingReport: true,
        cases: [],
        isLoadingCases: true,
        latestReport: null,
        selectedCaseId: null,
        setSelectedCaseId: vi.fn(),
        isSubmitting: false,
        onSubmit: vi.fn(),
        copyFromLastReport: vi.fn(),
      });

      renderWeeklyReport();

      await waitFor(() => {
        expect(screen.getByTestId("report-header")).toBeInTheDocument();
        expect(screen.getByTestId("basic-info-form")).toBeInTheDocument();
      });
    });
  });

  describe("エラー処理", () => {
    it("WebSocket接続エラー時でも基本機能が動作すること", async () => {
      // WebSocket エラー状態のモック
      const { useWebSocket } = await import("@/contexts/useWebSocket");
      vi.mocked(useWebSocket).mockReturnValue({
        lastMessage: null,
        sendMessage: vi.fn(),
        status: "error",
        editingUsers: [],
        currentUserId: 1,
      });

      renderWeeklyReport();

      await waitFor(() => {
        expect(screen.getByTestId("report-header")).toBeInTheDocument();
        expect(screen.getByTestId("basic-info-form")).toBeInTheDocument();
      });
    });
  });
});