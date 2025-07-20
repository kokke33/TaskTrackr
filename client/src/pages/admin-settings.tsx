import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Settings, Save, RefreshCw, AlertCircle, Zap, X } from "lucide-react";
import { DEFAULT_VALUES } from "@shared/ai-constants";
import { type AIProviderConfig } from "@shared/ai-types";
import { AIProviderSelector } from "@/components/ai-provider-selector";
import { AISettingsManager } from "@/lib/ai-settings-manager";

interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// システム設定を取得する関数
async function getSystemSettings(): Promise<SystemSetting[]> {
  const response = await fetch("/api/settings", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("設定の取得に失敗しました");
  }
  return response.json();
}

// セッション設定を取得する関数
async function getSessionAISettings(): Promise<{ realtimeProvider?: string; groqModel?: string; geminiModel?: string; openrouterModel?: string }> {
  const response = await fetch("/api/session-ai-settings", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("セッション設定の取得に失敗しました");
  }
  return response.json();
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // 統合されたAI設定状態
  const [basicConfig, setBasicConfig] = useState<AIProviderConfig>(AISettingsManager.getDefaultConfig());
  const [realtimeConfig, setRealtimeConfig] = useState<AIProviderConfig>(AISettingsManager.getDefaultConfig());
  const [trialConfig, setTrialConfig] = useState<AIProviderConfig>(AISettingsManager.getDefaultConfig());
  const [isTrialMode, setIsTrialMode] = useState<boolean>(false);

  // システム設定を取得
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettings,
  });

  // セッション設定を取得
  const { data: sessionSettings } = useQuery({
    queryKey: ["sessionAISettings"],
    queryFn: getSessionAISettings,
  });

  // 基本AI設定を更新
  const updateBasicMutation = useMutation({
    mutationFn: (config: AIProviderConfig) => AISettingsManager.updateSystemSettings('basic', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
      toast({
        title: "設定を更新しました",
        description: "AIプロバイダーが正常に更新されました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "更新に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // リアルタイム分析設定を更新
  const updateRealtimeMutation = useMutation({
    mutationFn: (config: AIProviderConfig) => AISettingsManager.updateSystemSettings('realtime', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
      toast({
        title: "リアルタイム分析設定を更新しました",
        description: "AIプロバイダーが正常に更新されました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "更新に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // お試しセッション設定を更新
  const updateTrialMutation = useMutation({
    mutationFn: (config: AIProviderConfig) => AISettingsManager.updateSessionSettings(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessionAISettings"] });
      setIsTrialMode(true);
      toast({
        title: "お試し設定を有効にしました",
        description: "次回のリアルタイム分析でこの設定が使用されます（DB保存なし）",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "お試し設定の更新に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // お試しセッション設定をクリア
  const clearTrialMutation = useMutation({
    mutationFn: () => AISettingsManager.clearSessionSettings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessionAISettings"] });
      setIsTrialMode(false);
      setTrialConfig(AISettingsManager.getDefaultConfig());
      toast({
        title: "お試し設定をクリアしました",
        description: "通常のシステム設定が使用されます",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "お試し設定のクリアに失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 設定データから現在の設定を取得
  useEffect(() => {
    if (settings) {
      // 基本AI設定の読み込み
      const basicProvider = settings.find(s => s.key === "AI_PROVIDER")?.value || DEFAULT_VALUES.AI_PROVIDER;
      const basicGroqModel = settings.find(s => s.key === "AI_GROQ_MODEL")?.value || DEFAULT_VALUES.GROQ_MODEL;
      const basicGeminiModel = settings.find(s => s.key === "AI_GEMINI_MODEL")?.value || DEFAULT_VALUES.GEMINI_MODEL;
      const basicOpenRouterModel = settings.find(s => s.key === "AI_OPENROUTER_MODEL")?.value || DEFAULT_VALUES.OPENROUTER_MODEL;

      setBasicConfig(AISettingsManager.buildConfigFromSettings(
        basicProvider, basicGroqModel, basicGeminiModel, basicOpenRouterModel
      ));

      // リアルタイム分析設定の読み込み
      const realtimeProvider = settings.find(s => s.key === "REALTIME_PROVIDER")?.value || DEFAULT_VALUES.REALTIME_PROVIDER;
      const realtimeGroqModel = settings.find(s => s.key === "REALTIME_GROQ_MODEL")?.value || DEFAULT_VALUES.GROQ_MODEL;
      const realtimeGeminiModel = settings.find(s => s.key === "REALTIME_GEMINI_MODEL")?.value || DEFAULT_VALUES.GEMINI_MODEL;
      const realtimeOpenRouterModel = settings.find(s => s.key === "REALTIME_OPENROUTER_MODEL")?.value || DEFAULT_VALUES.OPENROUTER_MODEL;

      setRealtimeConfig(AISettingsManager.buildConfigFromSettings(
        realtimeProvider, realtimeGroqModel, realtimeGeminiModel, realtimeOpenRouterModel
      ));
    }
  }, [settings]);

  // セッション設定を初期化
  useEffect(() => {
    if (sessionSettings?.realtimeProvider) {
      setTrialConfig(AISettingsManager.buildConfigFromSettings(
        sessionSettings.realtimeProvider,
        sessionSettings.groqModel,
        sessionSettings.geminiModel,
        sessionSettings.openrouterModel
      ));
      setIsTrialMode(true);
    } else {
      setIsTrialMode(false);
    }
  }, [sessionSettings]);

  const handleBasicSave = () => {
    const validation = AISettingsManager.validateConfig(basicConfig);
    if (!validation.isValid) {
      toast({
        title: "設定エラー",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }
    updateBasicMutation.mutate(basicConfig);
  };

  const handleRealtimeSave = () => {
    const validation = AISettingsManager.validateConfig(realtimeConfig);
    if (!validation.isValid) {
      toast({
        title: "設定エラー",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }
    updateRealtimeMutation.mutate(realtimeConfig);
  };

  const handleTrialSave = () => {
    const validation = AISettingsManager.validateConfig(trialConfig);
    if (!validation.isValid) {
      toast({
        title: "設定エラー",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }
    updateTrialMutation.mutate(trialConfig);
  };

  const handleTrialClear = () => {
    clearTrialMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              エラー
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>設定の読み込み中にエラーが発生しました。</p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>認証状態:</strong> {isAuthenticated ? "認証済み" : "未認証"}</p>
              <p><strong>ユーザー:</strong> {user?.username || "不明"}</p>
              <p><strong>管理者権限:</strong> {user?.isAdmin ? "あり" : "なし"}</p>
              <p><strong>エラー内容:</strong> {error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          システム設定
        </h1>
        <p className="text-muted-foreground mt-2">
          システムの動作設定を管理します（管理者のみ）
        </p>
        <div className="text-xs text-muted-foreground mt-1">
          現在のユーザー: {user?.username} (管理者: {user?.isAdmin ? "はい" : "いいえ"})
        </div>
      </div>

      <div className="grid gap-6">
        {/* 基本AI設定セクション */}
        <Card>
          <CardHeader>
            <CardTitle>AI設定</CardTitle>
            <CardDescription>
              AIサービスの設定を管理します。変更は即座に反映され、サーバー再起動は不要です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AIProviderSelector
              value={basicConfig}
              onChange={setBasicConfig}
              prefix="基本AI設定"
              description="使用するAIサービスプロバイダーを選択してください"
            />

            <div className="flex items-center gap-2 pt-4">
              <Button
                onClick={handleBasicSave}
                disabled={updateBasicMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateBasicMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                設定を保存
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* リアルタイム分析設定セクション */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              リアルタイム分析設定
            </CardTitle>
            <CardDescription>
              週次報告のフォーカスアウト時に実行されるAI分析の設定を管理します。モデルやパラメータの詳細設定は.envファイルで管理されます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AIProviderSelector
              value={realtimeConfig}
              onChange={setRealtimeConfig}
              prefix="リアルタイム分析"
              description="リアルタイム分析で使用するAIサービスプロバイダーを選択してください。"
            />

            <div className="flex items-center gap-2 pt-4">
              <Button
                onClick={handleRealtimeSave}
                disabled={updateRealtimeMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateRealtimeMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                リアルタイム分析設定を保存
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* お試し設定セクション */}
        <Card className={isTrialMode ? "border-orange-200 bg-orange-50" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              リアルタイム分析お試し設定
              {isTrialMode && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  お試し中
                </span>
              )}
            </CardTitle>
            <CardDescription>
              DB保存せずに一時的にリアルタイム分析設定を変更できます。セッション期間中のみ有効で、他のユーザーには影響しません。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AIProviderSelector
              value={trialConfig}
              onChange={setTrialConfig}
              disabled={updateTrialMutation.isPending}
              prefix="お試し用"
              description={isTrialMode 
                ? "現在お試し設定が有効です。次回のリアルタイム分析でこの設定が使用されます。"
                : "お試し用プロバイダーを選択してください。DB保存はされません。"
              }
            />

            <div className="flex items-center gap-2 pt-4">
              {isTrialMode ? (
                <Button
                  onClick={handleTrialClear}
                  disabled={clearTrialMutation.isPending}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {clearTrialMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  お試し設定をクリア
                </Button>
              ) : (
                <Button
                  onClick={handleTrialSave}
                  disabled={updateTrialMutation.isPending || !trialConfig.provider}
                  className="flex items-center gap-2"
                >
                  {updateTrialMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  お試し設定を有効化
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 現在の設定一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>現在の設定</CardTitle>
            <CardDescription>
              システムに保存されている設定の一覧です
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settings && settings.length > 0 ? (
              <div className="space-y-3">
                {settings
                  .filter((setting) => setting.key !== 'REALTIME_AI_MODEL') // REALTIME_AI_MODELを非表示
                  .map((setting) => (
                  <div key={setting.key} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{setting.key}</div>
                      <div className="text-sm text-muted-foreground">{setting.description}</div>
                    </div>
                    <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {setting.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">設定が見つかりません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}