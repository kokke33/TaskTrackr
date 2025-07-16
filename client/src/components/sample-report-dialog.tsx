import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

interface SampleReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// サンプルデータ
const sampleReport = {
  project: "SAMPLE_PRJ",
  case: "サンプル案件",
  period: "2025-03-17 ～ 2025-03-21",
  reporter: "山田太郎",
  weeklyTasks: `■主な作業
・①基本設計書の最終レビュー完了（～03/19水）
・②詳細設計書の作成開始（03/18火～）
・③データベース設計の詳細化（03/20木～03/21金）
・④UIプロトタイプの評価会議実施（03/03月～）

■計画との差異（遅延・前倒し等）
・データベース設計が計画より1日遅延
・UIプロトタイプ評価は予定通り完了
・外部インターフェース設計は外部仕様待ちのため未着手

■リスク評価
評価: 中
理由: データベース設計の遅延は取り戻せる範囲だが、外部インターフェース設計の遅れが懸念される`,
  progressRate: 52,
  progressStatus: "少し遅れている",
  delayDetails: `・データベース設計担当者の急な体調不良による作業遅延
・外部システム連携仕様の未確定によるインターフェース設計の遅延

進捗状況については全体として概ね計画通りですが、一部の遅延が発生しています。特にデータベース設計については、担当者の体調不良に対応するためバックアップ体制を強化し、来週の回復を目指します。`,
  issues: `■内容
・外部システム連携仕様の詳細が顧客側から提供されておらず、インターフェース設計に影響
・データベース設計の担当者変更に伴う引継ぎの必要性

■深刻度
評価: 中
理由: スケジュールへの影響はあるが、現時点では対応可能な範囲

■対応状況
・顧客担当者に仕様提供を再依頼、来週早々の提供を約束してもらった
・データベース設計のバックアップ担当者へのナレッジ共有を前倒しで実施

課題解決には顧客との緊密なコミュニケーションが重要です。特に外部システム連携仕様については、顧客側の内部調整も含めて支援し、早期の確定を目指しています。`,
  riskSummary: `・セキュリティ要件の追加で認証部分の設計変更の可能性
・データベースのパフォーマンス要件を満たせない可能性`,
  riskCountermeasures: `・セキュリティ専門チームと事前協議を開始、影響範囲の調査を実施中
・データベース設計の早期レビューと負荷テスト計画の前倒し

リスク管理においては、問題が顕在化する前の早期対応が重要です。特にセキュリティ要件については、専門チームとの連携を密にし、設計段階での対応を進めています。`,
  riskLevel: "中",
  qualityDetails: `・データベースのパフォーマンス要件を満たせるか懸念あり
・画面遷移の応答時間がユーザビリティ要件を満たせるか検証が必要`,
  testProgress: `・基本設計書のレビューで指摘事項15件中13件対応完了、残り2件は来週対応予定
・UIプロトタイプのユーザビリティテストで8項目中7項目がクリア、1項目は改善検討中

品質管理においては、早期からの検証と継続的なモニタリングが重要です。基本設計フェーズでのレビュー指摘事項は概ね解決しており、残りの項目についても来週中の対応を予定しています。`,
  changeDetails: `■変更された内容
・帳票出力機能の優先度を下げ、データ連携機能の開発を前倒し

■変更理由と影響
・顧客の業務プロセス変更に伴う優先度変更要請
・全体納期への影響なし

■リスク評価
評価: 低
理由: 機能の優先度変更のみで、全体スケジュールへの影響なし

変更管理では、影響範囲の適切な評価と関係者への情報共有が重要です。今回の変更は全体スケジュールに影響しない範囲であり、チーム内での作業調整で対応可能と判断しています。`,
  nextWeekPlan: `■作業予定
・詳細設計の継続（画面設計、データベース設計の完了）
・データベーススキーマの確定
・外部インターフェース設計
・先行開発モジュールのコーディング開始

■想定される懸念
・外部システム連携仕様の遅延がインターフェース設計に影響する可能性
・データベース設計担当者の回復状況

■リスク評価
評価: 中
理由: 外部依存要素があり、完全なコントロールが難しい

来週の計画では、外部システム連携仕様の入手が鍵となります。顧客側との緊密な連携を維持し、仕様確定を優先事項として進めていきます。`,
  supportRequests: `・セキュリティ設計変更の場合の追加リソース確保についての判断が必要
・データベース設計専門家の一時的な支援検討

セキュリティ要件の追加対応については、現在の調査段階から設計変更が必要となった場合のリソース確保について、事前の判断をお願いしたいと考えています。`,
  resourceDetails: `・データベース設計担当者の体調不良に伴い、バックアップ要員の確保が必要
・設計レビュー期間中の一部メンバーに残業増加の傾向

チームの健全性を維持するため、負荷の集中を避ける作業分担を実施しています。特にデータベース設計については、ナレッジ共有を進めることで属人化を防ぎ、柔軟な対応体制を構築していきます。`,
  customerDetails: `・UIプロトタイプの評価会議での顧客満足度は高く、特に画面遷移の分かりやすさについて高評価
・進捗状況の透明性確保について評価を得ている
・外部システム連携仕様の提供遅延に関して顧客側にも焦りが見られる

顧客との関係は良好に保たれており、特にUIプロトタイプへの評価は高く、プロジェクトへの信頼性が確保されています。一方で、外部システム連携仕様については顧客側の内部調整も含めて支援していく必要があります。`,
  environmentDetails: `・テスト環境のストレージ容量不足が懸念されるため、増設の検討が必要
・開発環境のネットワーク遅延が時折発生

開発およびテスト環境については、先行してキャパシティ計画を見直し、必要に応じて増強を検討していきます。特にテストデータの増加に伴うストレージ容量については、早期の対応が必要と考えています。`,
  costDetails: `・基本設計レビューに想定より0.5人月多く工数がかかったが、現時点では全体予算内に収まる見込み

現時点では、一部工数の超過はあるものの、全体としては予算内に収まる見込みです。引き続き工数管理を徹底し、早期の課題検出と対応を進めていきます。`,
  knowledgeDetails: `・データベース設計のノウハウが特定メンバーに集中しており、ナレッジ共有のための勉強会を来週実施予定

属人化防止の観点からは、特にデータベース設計に関するナレッジ共有を強化していきます。来週には勉強会を実施し、チーム全体のスキルアップと知識の分散を図っていきます。`,
  businessDetails: `■顧客からの新たな要望、関心事
・モバイル対応への関心が高まっており、次期フェーズでの対応可能性を検討中

■今後の商談可能性
・顧客の関連部署からデータ分析ダッシュボードの追加要望が非公式に寄せられている

■市場動向・競合情報
・競合他社がクラウドベースのソリューションを提案している情報あり、当社の差別化ポイントをより明確に伝える必要がある

顧客との会話から、新たなビジネス機会が見えてきています。特にモバイル対応とデータ分析機能については、次期フェーズでの提案に向けて準備を進めていく予定です。競合他社の動向も踏まえ、当社のソリューションの強みを明確に伝えていく。`
};

export function SampleReportDialog({ open, onOpenChange }: SampleReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>週次報告記載サンプル</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="space-y-6 p-4">
            {/* 基本情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">報告基本情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">報告期間:</span> {sampleReport.period}
                  </div>
                  <div>
                    <span className="font-medium">プロジェクト名:</span> {sampleReport.project}
                  </div>
                  <div>
                    <span className="font-medium">案件名:</span> {sampleReport.case}
                  </div>
                  <div>
                    <span className="font-medium">報告者名:</span> {sampleReport.reporter}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 今週の進捗 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">今週の進捗</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">作業内容:</h4>
                  <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm">
                    {sampleReport.weeklyTasks}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">進捗率:</span> {sampleReport.progressRate}%
                  </div>
                  <div>
                    <span className="font-medium">進捗状況:</span> 
                    <Badge variant="outline" className="ml-2">{sampleReport.progressStatus}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 遅延・問題点 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">遅延・問題点</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">遅延・問題点の有無:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">遅延・問題点の詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.delayDetails}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 課題・リスク */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">課題・リスク</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">課題・問題点:</h4>
                  <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm">
                    {sampleReport.issues}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">新たなリスクの有無:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">リスクの概要:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.riskSummary}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="font-medium">リスク対策:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.riskCountermeasures}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="font-medium">リスクレベル:</span>
                    <Badge variant="outline" className="ml-2">{sampleReport.riskLevel}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 品質状況 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">品質状況</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">品質懸念事項の有無:</span>
                    <Badge variant="secondary">軽微な懸念あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">品質懸念事項の詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.qualityDetails}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="font-medium">テスト進捗状況:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.testProgress}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 変更管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">変更管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">変更の有無:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">変更内容の詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.changeDetails}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 今後の計画 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">今後の計画</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">来週の作業予定:</h4>
                  <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm">
                    {sampleReport.nextWeekPlan}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">支援・判断の要望事項:</h4>
                  <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm">
                    {sampleReport.supportRequests}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 懸念事項 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">懸念事項</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">リソースに関する懸念:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">リソースの詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.resourceDetails}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">顧客に関する懸念:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">顧客の詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.customerDetails}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">環境に関する懸念:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">環境の詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.environmentDetails}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">コストに関する懸念:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">コストの詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.costDetails}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">知識・スキルに関する懸念:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">知識・スキルの詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.knowledgeDetails}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">教育に関する懸念:</span>
                    <Badge variant="secondary">なし</Badge>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">緊急課題に関する懸念:</span>
                    <Badge variant="secondary">なし</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ビジネス機会 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ビジネス機会</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">営業チャンス・顧客ニーズ:</span>
                    <Badge variant="destructive">あり</Badge>
                  </div>
                  <div>
                    <span className="font-medium">営業チャンス・顧客ニーズの詳細:</span>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm mt-2">
                      {sampleReport.businessDetails}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}