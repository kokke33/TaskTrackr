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
  overview: "テスト用のプロジェクトです",
  description: "詳細説明",
  status: "進行中",
  clientName: "テストクライアント",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
  budget: 1000000,
  teamMembers: "山田太郎, 佐藤花子",
  technologies: "React, Node.js, PostgreSQL",
  risks: "特になし",
  notes: "注意事項",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  createdBy: 1,
  isDeleted: false,
};

export const mockCase = {
  id: 1,
  name: "テストケース",
  description: "テスト用のケースです", 
  projectId: 1,
  assignedTo: "山田太郎",
  status: "進行中",
  priority: "高",
  estimatedHours: 40,
  actualHours: 20,
  tags: "フロントエンド,UI",
  clientFeedback: "問題なし",
  internalNotes: "内部メモ",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  createdBy: 1,
  isDeleted: false,
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