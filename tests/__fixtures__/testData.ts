// テスト用の固定データ

export const mockUser = {
  id: 1,
  username: "testuser",
  password: "hashedpassword",
  isAdmin: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockAdminUser = {
  id: 2,
  username: "admin",
  password: "hashedpassword", 
  isAdmin: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockProject = {
  id: 1,
  name: "テストプロジェクト",
  overview: "テスト用のプロジェクト概要",
  organization: "テスト組織",
  personnel: "テスト要員",
  progress: "テスト進捗",
  businessDetails: "テスト業務詳細",
  issues: "テスト課題",
  documents: "テストドキュメント",
  handoverNotes: "テスト引き継ぎ事項",
  remarks: "テスト特記事項",
  isDeleted: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockCase = {
  id: 1,
  projectName: "テストプロジェクト",
  caseName: "テストケース",
  description: "テスト用のケース説明",
  milestone: "テストマイルストーン",
  includeProgressAnalysis: true,
  isDeleted: false,
  createdAt: new Date("2024-01-01"),
};

export const mockWeeklyReport = {
  id: 1,
  caseId: 1,
  weekStartDate: new Date("2024-01-01"),
  progressSummary: "テスト用の進捗概要",
  tasksCompleted: "完了したタスク",
  tasksInProgress: "進行中のタスク", 
  tasksPlanned: "予定しているタスク",
  challenges: "課題",
  achievements: "成果",
  nextWeekPlan: "来週の計画",
  clientCommunication: "クライアントとのコミュニケーション",
  riskAssessment: "リスク評価",
  qualityMetrics: "品質指標",
  resourceUtilization: "リソース活用状況",
  stakeholderFeedback: "ステークホルダーフィードバック",
  lessonsLearned: "学んだこと",
  improvementActions: "改善アクション",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  createdBy: 1,
};

export const mockManagerMeeting = {
  id: 1,
  projectId: 1,
  meetingDate: new Date("2024-01-01"),
  agenda: "テスト用の議題",
  decisions: "決定事項",
  actionItems: "アクションアイテム",
  attendees: "参加者",
  nextMeetingDate: new Date("2024-01-08"),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  createdBy: 1,
};
