import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { WeeklyReport } from "@shared/schema";

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localData: WeeklyReport;
  serverData: WeeklyReport;
  onResolve: (resolvedData: WeeklyReport) => void;
  onReload: () => void;
}

// 差分を検出するヘルパー関数
function detectChanges(local: WeeklyReport, server: WeeklyReport): Array<{
  field: keyof WeeklyReport;
  localValue: any;
  serverValue: any;
  isDifferent: boolean;
}> {
  const changes: Array<{
    field: keyof WeeklyReport;
    localValue: any;
    serverValue: any;
    isDifferent: boolean;
  }> = [];

  // 比較対象のフィールド（システム生成フィールドは除外）
  const fieldsToCompare: (keyof WeeklyReport)[] = [
    'reporterName', 'progressRate', 'taskOverview', 'accomplishments',
    'currentStatus', 'nextWeekPlan', 'delayIssues', 'delayDetails',
    'newRisks', 'riskDetails', 'qualityConcerns', 'qualityDetails',
    'changes', 'changeDetails', 'resourceConcerns', 'resourceDetails',
    'customerIssues', 'customerDetails', 'environmentIssues', 'environmentDetails',
    'costIssues', 'costDetails', 'knowledgeIssues', 'knowledgeDetails',
    'trainingIssues', 'trainingDetails', 'urgentIssues', 'urgentDetails',
    'businessOpportunities', 'businessDetails', 'adminConfirmationEmail'
  ];

  fieldsToCompare.forEach(field => {
    const localValue = local[field];
    const serverValue = server[field];
    const isDifferent = localValue !== serverValue;
    
    changes.push({
      field,
      localValue,
      serverValue,
      isDifferent
    });
  });

  return changes;
}

// フィールド名を日本語に変換
function getFieldLabel(field: keyof WeeklyReport): string {
  const labels: Record<string, string> = {
    reporterName: "報告者名",
    progressRate: "進捗率",
    taskOverview: "タスク概要",
    accomplishments: "今週の実績",
    currentStatus: "現在の状況",
    nextWeekPlan: "来週の予定",
    delayIssues: "遅延課題",
    delayDetails: "遅延詳細",
    newRisks: "新しいリスク",
    riskDetails: "リスク詳細",
    qualityConcerns: "品質懸念",
    qualityDetails: "品質詳細",
    changes: "変更事項",
    changeDetails: "変更詳細",
    resourceConcerns: "リソース懸念",
    resourceDetails: "リソース詳細",
    customerIssues: "顧客課題",
    customerDetails: "顧客詳細",
    environmentIssues: "環境課題",
    environmentDetails: "環境詳細",
    costIssues: "コスト課題",
    costDetails: "コスト詳細",
    knowledgeIssues: "知識課題",
    knowledgeDetails: "知識詳細",
    trainingIssues: "研修課題",
    trainingDetails: "研修詳細",
    urgentIssues: "緊急課題",
    urgentDetails: "緊急詳細",
    businessOpportunities: "ビジネス機会",
    businessDetails: "ビジネス詳細",
    adminConfirmationEmail: "管理者確認メール"
  };
  
  return labels[field] || field;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  localData,
  serverData,
  onResolve,
  onReload
}: ConflictResolutionDialogProps) {
  const [resolvedData, setResolvedData] = useState<WeeklyReport>({ ...localData });
  const changes = detectChanges(localData, serverData);
  const conflictingChanges = changes.filter(change => change.isDifferent);
  
  const handleFieldResolve = (field: keyof WeeklyReport, useLocal: boolean) => {
    setResolvedData(prev => ({
      ...prev,
      [field]: useLocal ? localData[field] : serverData[field]
    }));
  };
  
  const handleResolve = () => {
    onResolve(resolvedData);
    onOpenChange(false);
  };
  
  const handleReload = () => {
    onReload();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            データ競合の解決
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              あなたが編集している間に、他のユーザーがこの報告書を更新しました。
              競合する変更を確認し、どちらの値を使用するかを選択してください。
            </p>
          </div>
          
          <Tabs defaultValue="conflicts" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conflicts">
                競合する変更 ({conflictingChanges.length})
              </TabsTrigger>
              <TabsTrigger value="preview">プレビュー</TabsTrigger>
            </TabsList>
            
            <TabsContent value="conflicts" className="space-y-4">
              {conflictingChanges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  競合する変更はありません
                </div>
              ) : (
                conflictingChanges.map(change => (
                  <Card key={change.field} className="w-full">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {getFieldLabel(change.field)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ローカル版 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-blue-700">あなたの変更</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFieldResolve(change.field, true)}
                              className="text-blue-700 border-blue-300 hover:bg-blue-50"
                            >
                              <ArrowLeft className="h-4 w-4 mr-1" />
                              この値を使用
                            </Button>
                          </div>
                          <Textarea
                            value={change.localValue || ""}
                            readOnly
                            className="bg-blue-50 border-blue-200"
                            rows={3}
                          />
                        </div>
                        
                        {/* サーバー版 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-green-700">他ユーザーの変更</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFieldResolve(change.field, false)}
                              className="text-green-700 border-green-300 hover:bg-green-50"
                            >
                              この値を使用
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                          <Textarea
                            value={change.serverValue || ""}
                            readOnly
                            className="bg-green-50 border-green-200"
                            rows={3}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-4">
              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="font-medium mb-2">解決後の内容プレビュー</h3>
                <div className="text-sm text-muted-foreground">
                  選択した値で統合された最終的な内容が表示されます。
                </div>
                {/* プレビュー内容は実装を簡略化 */}
                <div className="mt-4 space-y-2">
                  {conflictingChanges.map(change => (
                    <div key={change.field} className="border-b pb-2">
                      <div className="font-medium text-sm">
                        {getFieldLabel(change.field)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {String(resolvedData[change.field] || "").slice(0, 100)}
                        {String(resolvedData[change.field] || "").length > 100 && "..."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReload}>
            <RefreshCw className="h-4 w-4 mr-2" />
            ページを再読み込み
          </Button>
          <Button onClick={handleResolve} disabled={conflictingChanges.length === 0}>
            競合を解決して保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}