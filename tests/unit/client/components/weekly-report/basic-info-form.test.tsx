import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FormProvider, useForm } from "react-hook-form";
import { BasicInfoForm } from "@/components/weekly-report/basic-info-form";
import type { Case, WeeklyReport } from "@shared/schema";

// Mock CaseSelectorModal to prevent actual modal rendering and interaction issues
vi.mock("@/components/case-selector-modal", () => ({
  default: ({ isOpen, onClose, onSelect, cases, selectedCaseId }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="case-selector-modal">
        {cases.map((c: Case) => (
          <button key={c.id} onClick={() => onSelect(c)} data-testid={`select-case-${c.id}`}>
            {c.caseName}
          </button>
        ))}
        <button onClick={onClose} data-testid="close-modal">Close</button>
      </div>
    );
  },
}));

// Define a type for the form values that matches the input component's expectations
type FormWeeklyReport = {
  [K in keyof WeeklyReport]: K extends "reportPeriodStart" | "reportPeriodEnd" ? string : WeeklyReport[K];
};

// Helper component to wrap BasicInfoForm with FormProvider
const TestFormWrapper = ({ children, defaultValues }: { children: React.ReactNode, defaultValues?: FormWeeklyReport }) => {
  const methods = useForm<FormWeeklyReport>({ defaultValues });
  return (
    <FormProvider {...methods}>
      {children}
    </FormProvider>
  );
};

describe("BasicInfoForm", () => {
  const mockCases: Case[] = [
    { id: 1, caseName: "案件A", projectName: "プロジェクトX", createdAt: new Date("2023-01-01T00:00:00Z"), description: null, milestone: null, includeProgressAnalysis: true, weeklyMeetingDay: null, isDeleted: false },
    { id: 2, caseName: "案件B", projectName: "プロジェクトY", createdAt: new Date("2023-01-01T00:00:00Z"), description: null, milestone: null, includeProgressAnalysis: true, weeklyMeetingDay: null, isDeleted: false },
  ];

  const mockOnSelectCase = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with initial values", () => {
    const defaultValues: FormWeeklyReport = {
      id: 1,
      reportPeriodStart: "2023-01-01",
      reportPeriodEnd: "2023-01-08",
      caseId: 1,
      reporterName: "テスト太郎",
      createdAt: new Date("2023-01-01T00:00:00Z"), // Dateオブジェクトとして扱う
      updatedAt: new Date("2023-01-01T00:00:00Z"), // Dateオブジェクトとして扱う
      weeklyTasks: "ダミーの週次タスク",
      progressRate: 50,
      progressStatus: "順調",
      delayIssues: "なし",
      delayDetails: null, // オプションフィールド
      issues: "なし",
      newRisks: "なし",
      riskSummary: null, // オプションフィールド
      riskCountermeasures: null, // オプションフィールド
      riskLevel: null, // オプションフィールド
      qualityConcerns: "なし",
      qualityDetails: null, // オプションフィールド
      testProgress: null, // オプションフィールド
      changes: "なし",
      changeDetails: null, // オプションフィールド
      nextWeekPlan: "次週計画",
      supportRequests: "なし",
      resourceConcerns: null, // オプションフィールド
      resourceDetails: null, // オプションフィールド
      customerIssues: null, // オプションフィールド
      customerDetails: null, // オプションフィールド
      environmentIssues: null, // オプションフィールド
      environmentDetails: null, // オプションフィールド
      costIssues: null, // オプションフィールド
      costDetails: null, // オプションフィールド
      knowledgeIssues: null, // オプションフィールド
      knowledgeDetails: null, // オプションフィールド
      trainingIssues: null, // オプションフィールド
      trainingDetails: null, // オプションフィールド
      urgentIssues: "なし",
      urgentDetails: null, // オプションフィールド
      businessOpportunities: null, // オプションフィールド
      businessDetails: null, // オプションフィールド
      adminConfirmationEmail: null, // オプションフィールド
      aiAnalysis: null, // オプションフィールド
      version: 1,
      projectName: undefined, // WeeklyReport型に後から追加されたもの
      caseName: undefined, // WeeklyReport型に後から追加されたもの
    };

    render(
      <TestFormWrapper defaultValues={defaultValues}>
        <BasicInfoForm cases={mockCases} selectedCaseId={defaultValues.caseId} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );

    expect(screen.getByTestId("report-period-start-input")).toHaveValue("2023-01-01");
    expect(screen.getByTestId("report-period-end-input")).toBeDisabled();
    expect(screen.getByTestId("report-period-end-input")).toHaveValue("2023-01-08");
    expect(screen.getByText("案件A")).toBeInTheDocument();
    expect(screen.getByText("プロジェクトX")).toBeInTheDocument();
    expect(screen.getByLabelText("報告者氏名")).toHaveValue("テスト太郎");
  });

  it("updates reportPeriodEnd when reportPeriodStart changes", async () => {
    render(
      <TestFormWrapper>
        <BasicInfoForm cases={mockCases} selectedCaseId={null} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );

    const startDateInput = screen.getByTestId("report-period-start-input");
    fireEvent.change(startDateInput, { target: { value: "2023-03-10" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("2023-03-17")).toBeInTheDocument();
    });
  });

  it("opens CaseSelectorModal when '案件を選択してください' button is clicked", async () => {
    render(
      <TestFormWrapper>
        <BasicInfoForm cases={mockCases} selectedCaseId={null} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );

    const selectCaseButton = screen.getByRole("button", { name: "案件を選択" });
    fireEvent.click(selectCaseButton);

    await waitFor(() => {
      expect(screen.getByTestId("case-selector-modal")).toBeInTheDocument();
    });
  });

  it("selects a case from CaseSelectorModal and updates form", async () => {
    render(
      <TestFormWrapper>
        <BasicInfoForm cases={mockCases} selectedCaseId={null} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );

    const selectCaseButton = screen.getByRole("button", { name: "案件を選択" });
    fireEvent.click(selectCaseButton);

    await waitFor(() => {
      expect(screen.getByTestId("case-selector-modal")).toBeInTheDocument();
    });

    const caseBButton = screen.getByTestId("select-case-2");
    fireEvent.click(caseBButton);

    await waitFor(() => {
      expect(screen.queryByTestId("case-selector-modal")).not.toBeInTheDocument();
      expect(screen.getByText("案件B")).toBeInTheDocument();
      expect(screen.getByText("プロジェクトY")).toBeInTheDocument();
      expect(mockOnSelectCase).toHaveBeenCalledWith(2);
    });
  });

  it("allows reporterName input", () => {
    render(
      <TestFormWrapper>
        <BasicInfoForm cases={mockCases} selectedCaseId={null} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );

    const reporterNameInput = screen.getByLabelText("報告者氏名");
    fireEvent.change(reporterNameInput, { target: { value: "新しい報告者" } });
    expect(reporterNameInput).toHaveValue("新しい報告者");
  });

  it("displays '案件を選択してください' when no case is selected", () => {
    render(
      <TestFormWrapper>
        <BasicInfoForm cases={mockCases} selectedCaseId={null} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );
    expect(screen.getByText("案件を選択してください")).toBeInTheDocument();
  });

  it("navigates to new case form when Plus button is clicked", () => {
    render(
      <TestFormWrapper>
        <BasicInfoForm cases={mockCases} selectedCaseId={null} onSelectCase={mockOnSelectCase} />
      </TestFormWrapper>
    );
    const plusButton = screen.getByRole("button", { name: "新規案件作成" });
    expect(plusButton.closest("a")).toHaveAttribute("href", "/case/new");
  });
});
