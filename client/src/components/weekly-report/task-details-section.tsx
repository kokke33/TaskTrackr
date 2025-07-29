import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PreviousReportTooltip } from "@/components/previous-report-tooltip";
import { AIAnalysisResult } from "@/components/ai-analysis-result";
import type { WeeklyReport } from "@shared/schema";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { ANALYSIS_FIELD_TYPES } from "@shared/ai-constants";

type TaskDetailsSectionProps = {
  latestReport?: WeeklyReport;
  existingReport?: WeeklyReport;
  aiAnalysis: ReturnType<typeof useAIAnalysis>;
};

export function TaskDetailsSection({ latestReport, existingReport, aiAnalysis }: TaskDetailsSectionProps) {
  const form = useFormContext<WeeklyReport>();
  const { getAnalysisState, clearAnalysis, analyzeField, analyzeFieldStreaming, regenerateAnalysis, sendMessage, clearConversations } = aiAnalysis;

  const fieldNameMapping: Record<string, keyof WeeklyReport> = {
    [ANALYSIS_FIELD_TYPES.weeklyTasks]: "weeklyTasks",
    [ANALYSIS_FIELD_TYPES.delayDetails]: "delayDetails",
    [ANALYSIS_FIELD_TYPES.issues]: "issues",
    [ANALYSIS_FIELD_TYPES.riskAnalysis]: "riskSummary",
    [ANALYSIS_FIELD_TYPES.riskCountermeasures]: "riskCountermeasures",
    [ANALYSIS_FIELD_TYPES.qualityAnalysis]: "qualityDetails",
    [ANALYSIS_FIELD_TYPES.changeDetails]: "changeDetails",
    [ANALYSIS_FIELD_TYPES.nextWeekPlan]: "nextWeekPlan",
    [ANALYSIS_FIELD_TYPES.supportRequests]: "supportRequests",
    [ANALYSIS_FIELD_TYPES.resourceConcerns]: "resourceDetails",
    [ANALYSIS_FIELD_TYPES.customerConcerns]: "customerDetails",
    [ANALYSIS_FIELD_TYPES.environmentConcerns]: "environmentDetails",
    [ANALYSIS_FIELD_TYPES.costConcerns]: "costDetails",
    [ANALYSIS_FIELD_TYPES.knowledgeConcerns]: "knowledgeDetails",
    [ANALYSIS_FIELD_TYPES.trainingConcerns]: "trainingDetails",
    [ANALYSIS_FIELD_TYPES.urgentIssues]: "urgentDetails",
    [ANALYSIS_FIELD_TYPES.businessOpportunities]: "businessDetails",
  };

  const createRegenerateHandler = useCallback((fieldName: string) => {
    return () => {
      // 品質セクション専用の処理
      if (fieldName === ANALYSIS_FIELD_TYPES.qualityAnalysis) {
        const formValues = form.getValues();
        const qualityDetails = formValues.qualityDetails || "";
        const testProgress = formValues.testProgress || "";
        const combinedContent = `${qualityDetails}\n${testProgress}`.trim();
        
        // 既存レポートからの統合コンテンツ
        const existingQualityDetails = existingReport?.qualityDetails || "";
        const existingTestProgress = existingReport?.testProgress || "";
        const existingCombinedContent = `${existingQualityDetails}\n${existingTestProgress}`.trim();
        
        // 前回レポートからの統合コンテンツ
        const prevQualityDetails = latestReport?.qualityDetails || "";
        const prevTestProgress = latestReport?.testProgress || "";
        const prevCombinedContent = `${prevQualityDetails}\n${prevTestProgress}`.trim();
        
        if (combinedContent && combinedContent.length >= 10) {
          regenerateAnalysis(
            fieldName, 
            combinedContent, 
            existingCombinedContent || undefined,
            prevCombinedContent || undefined
          );
        }
        return;
      }
      
      const englishFieldName = fieldNameMapping[fieldName];
      if (!englishFieldName) {
        return;
      }
      
      const formValues = form.getValues();
      const currentValue = formValues[englishFieldName] as string;
      const originalValue = existingReport?.[englishFieldName] as string;
      const previousReportValue = latestReport?.[englishFieldName] as string;
      
      if (currentValue && currentValue.trim().length >= 10) {
        regenerateAnalysis(fieldName, currentValue, originalValue, previousReportValue);
      }
    };
  }, [form, regenerateAnalysis, existingReport, latestReport]);

  return (
    <>
      {/* 今週の作業内容 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          2. 今週の作業内容
        </h2>
        <FormField
          control={form.control}
          name="weeklyTasks"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel className="required">今週の作業内容</FormLabel>
                <PreviousReportTooltip 
                  previousContent={latestReport?.weeklyTasks}
                  fieldName="今週の作業内容"
                />
              </div>
              <FormControl>
                <Textarea
                  placeholder="作業項目、計画との差異、遅延理由、リスク評価などを記述してください"
                  className="h-32"
                  {...field}
                  onBlur={(e) => {
                    field.onBlur?.();
                    analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.weeklyTasks, e.target.value, existingReport?.weeklyTasks ?? undefined, latestReport?.weeklyTasks ?? undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
              <AIAnalysisResult
                analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.weeklyTasks).analysis}
                isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.weeklyTasks).isLoading}
                error={getAnalysisState(ANALYSIS_FIELD_TYPES.weeklyTasks).error}
                onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.weeklyTasks)}
                onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.weeklyTasks)}
                fieldName={ANALYSIS_FIELD_TYPES.weeklyTasks}
                conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.weeklyTasks).conversations}
                isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.weeklyTasks).isConversationLoading}
                onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.weeklyTasks, message)}
                onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.weeklyTasks)}
              />
            </FormItem>
          )}
        />
      </div>

      {/* 進捗状況 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          3. 進捗状況
        </h2>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="progressRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="required">
                  進捗率 (0～100%)
                </FormLabel>
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Input
                      type="range"
                      min="0"
                      max="100"
                      className="w-full"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      className="w-20"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value))
                      }
                    />
                  </FormControl>
                  <span>%</span>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  <p className="mb-1">進捗率の計算方法の例:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>マイルストーンベース: 達成したマイルストーン ÷ 全マイルストーン数</li>
                    <li>タスクベース: 完了したタスク数 ÷ 全タスク数</li>
                    <li>工数ベース: 消費した工数 ÷ 計画工数</li>
                    <li>成果物ベース: 完成した成果物の割合</li>
                  </ul>
                  <p className="mt-2">※ 一貫した計算方法を使用することで、週ごとの比較が容易になります。</p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="progressStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="required">
                  計画比の進捗状況
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="on-schedule">予定通り（計画の±5%以内）</SelectItem>
                    <SelectItem value="slightly-delayed">
                      少し遅れている（計画より5〜15%遅延）
                    </SelectItem>
                    <SelectItem value="severely-delayed">
                      大幅に遅れている（計画より15%以上遅延）
                    </SelectItem>
                    <SelectItem value="ahead">前倒しで進行中（計画より5%以上前倒し）</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground mt-2">
                  進捗状況は、計画工数や計画タスク数との比較、または主要なマイルストーンの達成予定日との比較に基づいて評価してください。
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="delayIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="required">
                  進捗遅延・問題点の有無
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="delay-yes" />
                      <label htmlFor="delay-yes">あり</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="delay-no" />
                      <label htmlFor="delay-no">なし</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("delayIssues") === "yes" && (
            <FormField
              control={form.control}
              name="delayDetails"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel className="required">
                      遅延・問題点の詳細
                    </FormLabel>
                    <PreviousReportTooltip 
                      previousContent={latestReport?.delayDetails ?? undefined}
                      fieldName="遅延・問題点の詳細"
                    />
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="遅延や問題の詳細、原因、影響範囲などを記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.delayDetails, e.target.value, existingReport?.delayDetails ?? undefined, latestReport?.delayDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.delayDetails}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.delayDetails).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.delayDetails).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.delayDetails).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.delayDetails)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.delayDetails)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.delayDetails).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.delayDetails).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.delayDetails, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.delayDetails)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>

      {/* 課題・問題点 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          4. 課題・問題点
        </h2>
        <FormField
          control={form.control}
          name="issues"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel className="required">課題・問題点</FormLabel>
                <PreviousReportTooltip 
                  previousContent={latestReport?.issues}
                  fieldName="課題・問題点"
                />
              </div>
              <FormControl>
                <Textarea
                  placeholder="現在直面している課題や問題点を記述してください"
                  className="h-24"
                  {...field}
                  onBlur={(e) => {
                    field.onBlur?.();
                    analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.issues, e.target.value, existingReport?.issues ?? undefined, latestReport?.issues ?? undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
              <AIAnalysisResult
                analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.issues).analysis}
                isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.issues).isLoading}
                error={getAnalysisState(ANALYSIS_FIELD_TYPES.issues).error}
                onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.issues)}
                onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.issues)}
                fieldName={ANALYSIS_FIELD_TYPES.issues}
                conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.issues).conversations}
                isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.issues).isConversationLoading}
                onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.issues, message)}
                onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.issues)}
              />
            </FormItem>
          )}
        />
      </div>

      {/* 新たなリスク */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          5. 新たなリスク
        </h2>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="newRisks"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="required">
                  新たなリスクの有無
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="risk-yes" />
                      <label htmlFor="risk-yes">あり</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="risk-no" />
                      <label htmlFor="risk-no">なし</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("newRisks") === "yes" && (
            <>
              <FormField
                control={form.control}
                name="riskSummary"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="required">
                        リスクの概要
                      </FormLabel>
                      <PreviousReportTooltip 
                        previousContent={latestReport?.riskSummary ?? undefined}
                        fieldName="リスクの概要"
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="新たに発見されたリスクの概要を記述してください"
                        className="h-24"
                        {...field}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="riskCountermeasures"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel className="required">対策</FormLabel>
                      <PreviousReportTooltip 
                        previousContent={latestReport?.riskCountermeasures ?? undefined}
                        fieldName="リスク対策"
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="リスクに対する対策を記述してください"
                        className="h-24"
                        {...field}
                        value={field.value ?? ""}
                        onBlur={(e) => {
                          field.onBlur?.();
                          const riskSummary = form.getValues("riskSummary") || "";
                          const riskCountermeasures = e.target.value || "";
                          const combinedContent = `【リスクの概要】\n${riskSummary}\n\n【対策】\n${riskCountermeasures}`;
                          
                          if ((riskSummary.trim() + riskCountermeasures.trim()).length >= 10) {
                            const prevRiskSummary = latestReport?.riskSummary || "";
                            const prevRiskCountermeasures = latestReport?.riskCountermeasures || "";
                            const prevCombinedContent = prevRiskSummary || prevRiskCountermeasures
                              ? `【リスクの概要】\n${prevRiskSummary}\n\n【対策】\n${prevRiskCountermeasures}`
                              : undefined;
                            const existingRiskSummary = existingReport?.riskSummary || "";
                            const existingRiskCountermeasures = existingReport?.riskCountermeasures || "";
                            const existingCombinedContent = existingRiskSummary || existingRiskCountermeasures
                              ? `【リスクの概要】\n${existingRiskSummary}\n\n【対策】\n${existingRiskCountermeasures}`
                              : undefined;
                            analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.riskCountermeasures, combinedContent, existingCombinedContent, prevCombinedContent);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <AIAnalysisResult
                      fieldName={ANALYSIS_FIELD_TYPES.riskCountermeasures}
                      analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.riskCountermeasures).analysis}
                      isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.riskCountermeasures).isLoading}
                      error={getAnalysisState(ANALYSIS_FIELD_TYPES.riskCountermeasures).error}
                      onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.riskCountermeasures)}
                      onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.riskCountermeasures)}
                      conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.riskCountermeasures).conversations}
                      isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.riskCountermeasures).isConversationLoading}
                      onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.riskCountermeasures, message)}
                      onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.riskCountermeasures)}
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="riskLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">
                      リスクレベル
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>
      </div>

      {/* 品質 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          6. 品質
        </h2>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="qualityConcerns"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="required">
                  品質懸念事項の有無
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="minor">軽微な懸念あり</SelectItem>
                    <SelectItem value="major">重大な懸念あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("qualityConcerns") !== "none" && (
            <FormField
              control={form.control}
              name="qualityDetails"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel className="required">
                      品質懸念事項の詳細
                    </FormLabel>
                    <PreviousReportTooltip 
                      previousContent={latestReport?.qualityDetails ?? undefined}
                      fieldName="品質懸念事項の詳細"
                    />
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="品質に関する懸念事項の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="testProgress"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center">
                  <FormLabel>進捗状況</FormLabel>
                  <PreviousReportTooltip 
                    previousContent={latestReport?.testProgress ?? undefined}
                    fieldName="進捗状況"
                  />
                </div>
                <FormControl>
                  <Textarea
                    placeholder="進捗状況を記述してください"
                    className="h-24"
                    {...field}
                    value={field.value ?? ""}
                    onBlur={(e) => {
                      field.onBlur?.();
                      const qualityDetails = form.getValues("qualityDetails") || "";
                      const testProgress = e.target.value || "";
                      const combinedContent = `【品質懸念事項の詳細】\n${qualityDetails}\n\n【進捗状況】\n${testProgress}`;
                      
                      if ((qualityDetails.trim() + testProgress.trim()).length >= 10) {
                        const prevQualityDetails = latestReport?.qualityDetails || "";
                        const prevTestProgress = latestReport?.testProgress || "";
                        const prevCombinedContent = prevQualityDetails || prevTestProgress
                          ? `【品質懸念事項の詳細】\n${prevQualityDetails}\n\n【進捗状況】\n${prevTestProgress}`
                          : undefined;
                        const existingQualityDetails = existingReport?.qualityDetails || "";
                        const existingTestProgress = existingReport?.testProgress || "";
                        const existingCombinedContent = existingQualityDetails || existingTestProgress
                          ? `【品質懸念事項の詳細】\n${existingQualityDetails}\n\n【進捗状況】\n${existingTestProgress}`
                          : undefined;
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.qualityAnalysis, combinedContent, existingCombinedContent, prevCombinedContent);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
                <AIAnalysisResult
                  fieldName={ANALYSIS_FIELD_TYPES.qualityAnalysis}
                  analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.qualityAnalysis).analysis}
                  isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.qualityAnalysis).isLoading}
                  error={getAnalysisState(ANALYSIS_FIELD_TYPES.qualityAnalysis).error}
                  onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.qualityAnalysis)}
                  onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.qualityAnalysis)}
                  conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.qualityAnalysis).conversations}
                  isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.qualityAnalysis).isConversationLoading}
                  onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.qualityAnalysis, message)}
                  onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.qualityAnalysis)}
                />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* 変更管理 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          7. 変更管理
        </h2>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="changes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="required">変更の有無</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="changes-yes" />
                      <label htmlFor="changes-yes">あり</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="changes-no" />
                      <label htmlFor="changes-no">なし</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("changes") === "yes" && (
            <FormField
              control={form.control}
              name="changeDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required">
                    変更内容の詳細
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="変更内容、影響範囲、対応状況などを記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.changeDetails, e.target.value, existingReport?.changeDetails ?? undefined, latestReport?.changeDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.changeDetails}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.changeDetails).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.changeDetails).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.changeDetails).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.changeDetails)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.changeDetails)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.changeDetails).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.changeDetails).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.changeDetails, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.changeDetails)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>

      {/* 来週の予定 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          8. 来週の予定
        </h2>
        <FormField
          control={form.control}
          name="nextWeekPlan"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel className="required">来週の作業予定</FormLabel>
                <PreviousReportTooltip 
                  previousContent={latestReport?.nextWeekPlan}
                  fieldName="来週の作業予定"
                />
              </div>
              <FormControl>
                <Textarea
                  placeholder="来週予定している作業内容を記述してください"
                  className="h-32"
                  {...field}
                  onBlur={(e) => {
                    field.onBlur?.();
                    analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.nextWeekPlan, e.target.value, existingReport?.nextWeekPlan ?? undefined, latestReport?.nextWeekPlan ?? undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
              <AIAnalysisResult
                analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.nextWeekPlan).analysis}
                isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.nextWeekPlan).isLoading}
                error={getAnalysisState(ANALYSIS_FIELD_TYPES.nextWeekPlan).error}
                onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.nextWeekPlan)}
                onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.nextWeekPlan)}
                fieldName={ANALYSIS_FIELD_TYPES.nextWeekPlan}
                conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.nextWeekPlan).conversations}
                isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.nextWeekPlan).isConversationLoading}
                onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.nextWeekPlan, message)}
                onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.nextWeekPlan)}
              />
            </FormItem>
          )}
        />
      </div>

      {/* 支援・判断要望 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          9. 支援・判断要望
        </h2>
        <FormField
          control={form.control}
          name="supportRequests"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center">
                <FormLabel className="required">
                  支援・判断の要望事項
                </FormLabel>
                <PreviousReportTooltip 
                  previousContent={latestReport?.supportRequests}
                  fieldName="支援・判断の要望事項"
                />
              </div>
              <FormControl>
                <Textarea
                  placeholder="必要な支援や判断を仰ぎたい事項を記述してください"
                  className="h-32"
                  {...field}
                  onBlur={(e) => {
                    field.onBlur?.();
                    analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.supportRequests, e.target.value, existingReport?.supportRequests ?? undefined, latestReport?.supportRequests ?? undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
              <AIAnalysisResult
                analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.supportRequests).analysis}
                isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.supportRequests).isLoading}
                error={getAnalysisState(ANALYSIS_FIELD_TYPES.supportRequests).error}
                onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.supportRequests)}
                onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.supportRequests)}
                fieldName={ANALYSIS_FIELD_TYPES.supportRequests}
                conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.supportRequests).conversations}
                isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.supportRequests).isConversationLoading}
                onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.supportRequests, message)}
                onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.supportRequests)}
              />
            </FormItem>
          )}
        />
      </div>

      {/* その他の懸念事項 */}
      <div className="p-6 bg-card rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
          10. その他の懸念事項
        </h2>
        {/* リソース */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="resourceConcerns"
            render={({ field }) => (
              <FormItem>
                <FormLabel>リソースに関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("resourceConcerns") === "exists" && (
            <FormField
              control={form.control}
              name="resourceDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="リソースに関する懸念事項の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.resourceConcerns, e.target.value, existingReport?.resourceDetails ?? undefined, latestReport?.resourceDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.resourceConcerns}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.resourceConcerns).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.resourceConcerns).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.resourceConcerns).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.resourceConcerns)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.resourceConcerns)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.resourceConcerns).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.resourceConcerns).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.resourceConcerns, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.resourceConcerns)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        {/* 顧客 */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="customerIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel>顧客に関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("customerIssues") === "exists" && (
            <FormField
              control={form.control}
              name="customerDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="顧客に関する懸念事項の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.customerConcerns, e.target.value, existingReport?.customerDetails ?? undefined, latestReport?.customerDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.customerConcerns}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.customerConcerns).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.customerConcerns).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.customerConcerns).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.customerConcerns)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.customerConcerns)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.customerConcerns).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.customerConcerns).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.customerConcerns, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.customerConcerns)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        {/* 環境 */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="environmentIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel>環境に関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("environmentIssues") === "exists" && (
            <FormField
              control={form.control}
              name="environmentDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="環境に関する懸念事項の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.environmentConcerns, e.target.value, existingReport?.environmentDetails ?? undefined, latestReport?.environmentDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.environmentConcerns}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.environmentConcerns).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.environmentConcerns).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.environmentConcerns).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.environmentConcerns)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.environmentConcerns)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.environmentConcerns).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.environmentConcerns).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.environmentConcerns, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.environmentConcerns)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        {/* コスト */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="costIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel>コストに関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("costIssues") === "exists" && (
            <FormField
              control={form.control}
              name="costDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="コストに関する懸念事項の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.costConcerns, e.target.value, existingReport?.costDetails ?? undefined, latestReport?.costDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.costConcerns}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.costConcerns).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.costConcerns).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.costConcerns).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.costConcerns)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.costConcerns)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.costConcerns).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.costConcerns).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.costConcerns, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.costConcerns)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        {/* 知識・スキル */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="knowledgeIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel>知識・スキルに関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("knowledgeIssues") === "exists" && (
            <FormField
              control={form.control}
              name="knowledgeDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="知識・スキルに関する懸念事項の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.knowledgeConcerns, e.target.value, existingReport?.knowledgeDetails ?? undefined, latestReport?.knowledgeDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.knowledgeConcerns}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.knowledgeConcerns).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.knowledgeConcerns).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.knowledgeConcerns).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.knowledgeConcerns)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.knowledgeConcerns)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.knowledgeConcerns).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.knowledgeConcerns).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.knowledgeConcerns, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.knowledgeConcerns)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        {/* 教育 */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="trainingIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel>教育に関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("trainingIssues") === "exists" && (
            <FormField
              control={form.control}
              name="trainingDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required">教育に関する懸念の詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="教育に関する懸念の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.trainingConcerns, e.target.value, existingReport?.trainingDetails ?? undefined, latestReport?.trainingDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.trainingConcerns}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.trainingConcerns).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.trainingConcerns).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.trainingConcerns).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.trainingConcerns)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.trainingConcerns)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.trainingConcerns).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.trainingConcerns).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.trainingConcerns, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.trainingConcerns)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        <div className="mb-6">
          <FormField
            control={form.control}
            name="urgentIssues"
            render={({ field }) => (
              <FormItem>
                <FormLabel>緊急課題に関する懸念</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("urgentIssues") === "exists" && (
            <FormField
              control={form.control}
              name="urgentDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required">詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="緊急課題の詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.urgentIssues, e.target.value, existingReport?.urgentDetails ?? undefined, latestReport?.urgentDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.urgentIssues}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.urgentIssues).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.urgentIssues).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.urgentIssues).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.urgentIssues)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.urgentIssues)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.urgentIssues).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.urgentIssues).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.urgentIssues, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.urgentIssues)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
        {/* 営業チャンス・顧客ニーズ */}
        <div className="mb-6">
          <FormField
            control={form.control}
            name="businessOpportunities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>営業チャンス・顧客ニーズ</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    <SelectItem value="exists">あり</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("businessOpportunities") === "exists" && (
            <FormField
              control={form.control}
              name="businessDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>詳細</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="営業チャンス・顧客ニーズの詳細を記述してください"
                      className="h-24"
                      {...field}
                      value={field.value ?? ""}
                      onBlur={(e) => {
                        field.onBlur?.();
                        analyzeFieldStreaming(ANALYSIS_FIELD_TYPES.businessOpportunities, e.target.value, existingReport?.businessDetails ?? undefined, latestReport?.businessDetails ?? undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <AIAnalysisResult
                    fieldName={ANALYSIS_FIELD_TYPES.businessOpportunities}
                    analysis={getAnalysisState(ANALYSIS_FIELD_TYPES.businessOpportunities).analysis}
                    isLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.businessOpportunities).isLoading}
                    error={getAnalysisState(ANALYSIS_FIELD_TYPES.businessOpportunities).error}
                    onClear={() => clearAnalysis(ANALYSIS_FIELD_TYPES.businessOpportunities)}
                    onRegenerate={createRegenerateHandler(ANALYSIS_FIELD_TYPES.businessOpportunities)}
                    conversations={getAnalysisState(ANALYSIS_FIELD_TYPES.businessOpportunities).conversations}
                    isConversationLoading={getAnalysisState(ANALYSIS_FIELD_TYPES.businessOpportunities).isConversationLoading}
                    onSendMessage={(message) => sendMessage(ANALYSIS_FIELD_TYPES.businessOpportunities, message)}
                    onClearConversations={() => clearConversations(ANALYSIS_FIELD_TYPES.businessOpportunities)}
                  />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>
    </>
  );
}