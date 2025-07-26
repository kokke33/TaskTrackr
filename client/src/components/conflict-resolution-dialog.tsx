import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft, ArrowRight, RefreshCw, Check } from "lucide-react";
import { WeeklyReport } from "@shared/schema";

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localData: WeeklyReport;
  serverData: WeeklyReport;
  serverUsername?: string;
  onResolve: (resolvedData: WeeklyReport) => void;
  onReload: () => void;
}

// 値を正規化する関数（null, undefined, 空文字を統一）
function normalizeValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return String(value);
}

// 簡単な差分ハイライト関数（改行対応）
function highlightDifferences(text1: string, text2: string): { highlighted1: string; highlighted2: string } {
  // 改行を保持するためにHTMLエスケープと改行変換を先に行う
  const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  const convertNewlines = (text: string) => text.replace(/\n/g, '<br>');
  
  // 単語レベルでの分割（改行とスペースを区別）
  const words1 = text1.split(/(\s+|\n)/);
  const words2 = text2.split(/(\s+|\n)/);
  
  const highlighted1 = words1.map((word, index) => {
    if (word === '\n') {
      return '<br>';
    }
    if (words2[index] !== word && word.trim() !== '') {
      return `<mark class="bg-red-200 text-red-800">${escapeHtml(word)}</mark>`;
    }
    return escapeHtml(word);
  }).join('');
  
  const highlighted2 = words2.map((word, index) => {
    if (word === '\n') {
      return '<br>';
    }
    if (words1[index] !== word && word.trim() !== '') {
      return `<mark class="bg-green-200 text-green-800">${escapeHtml(word)}</mark>`;
    }
    return escapeHtml(word);
  }).join('');
  
  return { highlighted1, highlighted2 };
}

// 差分を検出するヘルパー関数
function detectChanges(local: WeeklyReport, server: WeeklyReport): Array<{
  field: keyof WeeklyReport;
  localValue: any;
  serverValue: any;
  isDifferent: boolean;
}> {
  console.log('🔍 Detecting changes between local and server data');
  console.log('Local data:', local);
  console.log('Server data:', server);

  const changes: Array<{
    field: keyof WeeklyReport;
    localValue: any;
    serverValue: any;
    isDifferent: boolean;
  }> = [];

  // 比較対象のフィールド（実際のスキーマフィールド名に合わせて修正）
  const fieldsToCompare: (keyof WeeklyReport)[] = [
    'reporterName', 'weeklyTasks', 'progressRate', 'progressStatus',
    'delayIssues', 'delayDetails', 'issues', 'newRisks', 'riskSummary', 
    'riskCountermeasures', 'riskLevel', 'qualityConcerns', 'qualityDetails',
    'testProgress', 'changes', 'changeDetails', 'nextWeekPlan', 'supportRequests',
    'resourceConcerns', 'resourceDetails', 'customerIssues', 'customerDetails',
    'environmentIssues', 'environmentDetails', 'costIssues', 'costDetails',
    'knowledgeIssues', 'knowledgeDetails', 'trainingIssues', 'trainingDetails',
    'urgentIssues', 'urgentDetails', 'businessOpportunities', 'businessDetails',
    'adminConfirmationEmail'
  ];

  fieldsToCompare.forEach(field => {
    const localValue = local[field];
    const serverValue = server[field];
    
    // 値を正規化して比較
    const normalizedLocal = normalizeValue(localValue);
    const normalizedServer = normalizeValue(serverValue);
    const isDifferent = normalizedLocal !== normalizedServer;
    
    if (isDifferent) {
      console.log(`🔄 Difference found in field ${field}:`, {
        local: normalizedLocal,
        server: normalizedServer
      });
    }
    
    changes.push({
      field,
      localValue,
      serverValue,
      isDifferent
    });
  });

  const conflictCount = changes.filter(c => c.isDifferent).length;
  console.log(`📊 Total conflicts detected: ${conflictCount}`);

  return changes;
}

// フィールド名を日本語に変換（実際のスキーマフィールド名に対応）
function getFieldLabel(field: keyof WeeklyReport): string {
  const labels: Record<string, string> = {
    reporterName: "報告者名",
    weeklyTasks: "今週のタスク",
    progressRate: "進捗率",
    progressStatus: "進捗状況",
    delayIssues: "遅延課題",
    delayDetails: "遅延詳細",
    issues: "課題",
    newRisks: "新しいリスク",
    riskSummary: "リスク概要",
    riskCountermeasures: "リスク対策",
    riskLevel: "リスクレベル",
    qualityConcerns: "品質懸念",
    qualityDetails: "品質詳細",
    testProgress: "テスト進捗",
    changes: "変更事項",
    changeDetails: "変更詳細",
    nextWeekPlan: "来週の予定",
    supportRequests: "サポート要請",
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
  serverUsername = "他のユーザー",
  onResolve,
  onReload
}: ConflictResolutionDialogProps) {
  const [resolvedData, setResolvedData] = useState<WeeklyReport>({ ...localData });
  const [selectedFields, setSelectedFields] = useState<Record<string, 'local' | 'server'>>({});
  const changes = detectChanges(localData, serverData);
  const conflictingChanges = changes.filter(change => change.isDifferent);
  
  const handleFieldResolve = (field: keyof WeeklyReport, useLocal: boolean) => {
    setResolvedData(prev => ({
      ...prev,
      [field]: useLocal ? localData[field] : serverData[field]
    }));
    setSelectedFields(prev => ({
      ...prev,
      [field]: useLocal ? 'local' : 'server'
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
              あなたが編集している間に、<strong>{serverUsername}</strong>がこの報告書を更新しました。
              競合する変更を確認し、どちらの値を使用するかを選択してください。
            </p>
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">
              競合する変更 ({conflictingChanges.length}件)
            </h3>
          </div>
          
          <div className="space-y-4">
            {conflictingChanges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                競合する変更はありません
              </div>
            ) : (
              conflictingChanges.map(change => {
                const localText = normalizeValue(change.localValue);
                const serverText = normalizeValue(change.serverValue);
                const { highlighted1, highlighted2 } = highlightDifferences(localText, serverText);
                const isSelected = selectedFields[change.field];
                
                return (
                  <Card key={change.field} className="w-full">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getFieldLabel(change.field)}
                        {isSelected && (
                          <Badge variant={isSelected === 'local' ? 'default' : 'secondary'} className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            {isSelected === 'local' ? 'あなたの変更を選択済み' : `${serverUsername}の変更を選択済み`}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ローカル版 */}
                        <div className={`space-y-2 p-3 rounded-lg border-2 ${
                          isSelected === 'local' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-blue-700 flex items-center gap-1">
                              あなたの変更
                              {isSelected === 'local' && <Check className="h-4 w-4" />}
                            </h4>
                            <Button
                              size="sm"
                              variant={isSelected === 'local' ? "default" : "outline"}
                              onClick={() => handleFieldResolve(change.field, true)}
                              className={isSelected === 'local' ? 
                                "bg-blue-600 hover:bg-blue-700" : 
                                "text-blue-700 border-blue-300 hover:bg-blue-50"
                              }
                            >
                              <ArrowLeft className="h-4 w-4 mr-1" />
                              {isSelected === 'local' ? '選択済み' : 'この値を使用'}
                            </Button>
                          </div>
                          <div 
                            className="bg-white border rounded p-3 text-sm min-h-[100px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: highlighted1 || '（空）' }}
                          />
                        </div>
                        
                        {/* サーバー版 */}
                        <div className={`space-y-2 p-3 rounded-lg border-2 ${
                          isSelected === 'server' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-green-700 flex items-center gap-1">
                              {serverUsername}の変更
                              {isSelected === 'server' && <Check className="h-4 w-4" />}
                            </h4>
                            <Button
                              size="sm"
                              variant={isSelected === 'server' ? "default" : "outline"}
                              onClick={() => handleFieldResolve(change.field, false)}
                              className={isSelected === 'server' ? 
                                "bg-green-600 hover:bg-green-700" : 
                                "text-green-700 border-green-300 hover:bg-green-50"
                              }
                            >
                              {isSelected === 'server' ? '選択済み' : 'この値を使用'}
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                          <div 
                            className="bg-white border rounded p-3 text-sm min-h-[100px] max-h-[200px] overflow-y-auto whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: highlighted2 || '（空）' }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReload}>
            <RefreshCw className="h-4 w-4 mr-2" />
            ページを再読み込み
          </Button>
          <Button
            onClick={handleResolve}
            disabled={conflictingChanges.length > 0 && Object.keys(selectedFields).length !== conflictingChanges.length}
          >
            競合を解決して保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}