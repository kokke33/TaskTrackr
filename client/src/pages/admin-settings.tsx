import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Settings, Save, RefreshCw, AlertCircle, Zap, X } from "lucide-react";

interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// AI設定を取得する関数
async function getSystemSettings(): Promise<SystemSetting[]> {
  const response = await fetch("/api/settings", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("設定の取得に失敗しました");
  }
  return response.json();
}

// AI設定を更新する関数
async function updateSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
  console.log(`API呼び出し開始: PUT /api/settings/${key}`, { value, description });
  
  const response = await fetch(`/api/settings/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ value, description }),
  });
  
  console.log(`APIレスポンス: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // JSON解析に失敗した場合はそのまま
    }
    console.error("API呼び出しエラー:", errorMessage);
    throw new Error(errorMessage);
  }
  
  const result = await response.json();
  console.log("API呼び出し成功:", result);
  return result;
}

// セッション設定を取得する関数
async function getSessionAISettings(): Promise<{ realtimeProvider?: string; groqModel?: string; openrouterModel?: string }> {
  const response = await fetch("/api/session-ai-settings", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("セッション設定の取得に失敗しました");
  }
  return response.json();
}

// セッション設定を更新する関数
async function updateSessionAISettings(realtimeProvider: string, groqModel?: string, openrouterModel?: string): Promise<{ success: boolean; settings: { realtimeProvider: string; groqModel?: string; openrouterModel?: string } }> {
  const body: any = { realtimeProvider };
  if (realtimeProvider === "groq" && groqModel) {
    body.groqModel = groqModel;
  }
  if (realtimeProvider === "openrouter" && openrouterModel) {
    body.openrouterModel = openrouterModel;
  }
  
  const response = await fetch("/api/session-ai-settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // JSON解析に失敗した場合はそのまま
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}

// セッション設定をクリアする関数
async function clearSessionAISettings(): Promise<{ success: boolean }> {
  const response = await fetch("/api/session-ai-settings", {
    method: "DELETE",
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("セッション設定のクリアに失敗しました");
  }
  
  return response.json();
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [aiProvider, setAiProvider] = useState<string>("");
  const [aiOpenRouterModel, setAiOpenRouterModel] = useState<string>("");
  
  // リアルタイム分析用の状態
  const [realtimeProvider, setRealtimeProvider] = useState<string>("");
  const [realtimeGroqModel, setRealtimeGroqModel] = useState<string>("");
  const [realtimeOpenRouterModel, setRealtimeOpenRouterModel] = useState<string>("");
  
  // お試し設定用の状態
  const [trialRealtimeProvider, setTrialRealtimeProvider] = useState<string>("");
  const [trialGroqModel, setTrialGroqModel] = useState<string>("");
  const [trialOpenRouterModel, setTrialOpenRouterModel] = useState<string>("");
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

  // AI_PROVIDER設定を更新
  const updateProviderMutation = useMutation({
    mutationFn: async ({ provider, openrouterModel }: { provider: string; openrouterModel?: string }) => {
      // プロバイダーを更新
      await updateSystemSetting("AI_PROVIDER", provider, "AIサービスプロバイダー (openai, ollama, gemini, groq, openrouter)");
      
      // OpenRouterの場合はモデルも更新
      if (provider === "openrouter" && openrouterModel) {
        await updateSystemSetting("AI_OPENROUTER_MODEL", openrouterModel, "基本AI設定用OpenRouterモデル");
      }
    },
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
    mutationFn: async ({ provider, groqModel, openrouterModel }: { provider: string; groqModel?: string; openrouterModel?: string }) => {
      // プロバイダーを更新
      await updateSystemSetting("REALTIME_AI_PROVIDER", provider, "リアルタイム分析用AIプロバイダー (openai, ollama, gemini, groq, openrouter)");
      
      // Groqの場合はモデルも更新
      if (provider === "groq" && groqModel) {
        await updateSystemSetting("REALTIME_GROQ_MODEL", groqModel, "リアルタイム分析用Groqモデル");
      }
      
      // OpenRouterの場合はモデルも更新
      if (provider === "openrouter" && openrouterModel) {
        await updateSystemSetting("REALTIME_OPENROUTER_MODEL", openrouterModel, "リアルタイム分析用OpenRouterモデル");
      }
    },
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
    mutationFn: ({ provider, groqModel, openrouterModel }: { provider: string; groqModel?: string; openrouterModel?: string }) => 
      updateSessionAISettings(provider, groqModel, openrouterModel),
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
    mutationFn: clearSessionAISettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessionAISettings"] });
      setIsTrialMode(false);
      setTrialRealtimeProvider("");
      setTrialGroqModel("qwen/qwen3-32b");
      setTrialOpenRouterModel("anthropic/claude-3.5-sonnet");
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
      const aiProviderSetting = settings.find(setting => setting.key === "AI_PROVIDER");
      if (aiProviderSetting) {
        setAiProvider(aiProviderSetting.value);
      }

      // 基本AI設定のOpenRouterモデル設定を取得
      const aiOpenRouterModelSetting = settings.find(setting => setting.key === "AI_OPENROUTER_MODEL");
      if (aiOpenRouterModelSetting) {
        setAiOpenRouterModel(aiOpenRouterModelSetting.value);
      } else {
        setAiOpenRouterModel("anthropic/claude-3.5-sonnet"); // デフォルト値
      }

      // リアルタイム分析設定を取得
      const realtimeProviderSetting = settings.find(setting => setting.key === "REALTIME_AI_PROVIDER");
      if (realtimeProviderSetting) {
        setRealtimeProvider(realtimeProviderSetting.value);
      } else {
        setRealtimeProvider("gemini"); // デフォルト値
      }

      // リアルタイムGroqモデル設定を取得
      const realtimeGroqModelSetting = settings.find(setting => setting.key === "REALTIME_GROQ_MODEL");
      if (realtimeGroqModelSetting) {
        setRealtimeGroqModel(realtimeGroqModelSetting.value);
      } else {
        setRealtimeGroqModel("qwen/qwen3-32b"); // デフォルト値
      }

      // リアルタイムOpenRouterモデル設定を取得
      const realtimeOpenRouterModelSetting = settings.find(setting => setting.key === "REALTIME_OPENROUTER_MODEL");
      if (realtimeOpenRouterModelSetting) {
        setRealtimeOpenRouterModel(realtimeOpenRouterModelSetting.value);
      } else {
        setRealtimeOpenRouterModel("anthropic/claude-3.5-sonnet"); // デフォルト値
      }
    }
  }, [settings]);

  // セッション設定を初期化
  useEffect(() => {
    if (sessionSettings) {
      if (sessionSettings.realtimeProvider) {
        setTrialRealtimeProvider(sessionSettings.realtimeProvider);
        setTrialGroqModel(sessionSettings.groqModel || "qwen/qwen3-32b");
        setTrialOpenRouterModel(sessionSettings.openrouterModel || "anthropic/claude-3.5-sonnet");
        setIsTrialMode(true);
      } else {
        setIsTrialMode(false);
      }
    }
  }, [sessionSettings]);

  const handleProviderChange = (value: string) => {
    setAiProvider(value);
  };

  const handleSave = () => {
    if (aiProvider) {
      updateProviderMutation.mutate({ 
        provider: aiProvider,
        openrouterModel: aiProvider === "openrouter" ? aiOpenRouterModel : undefined
      });
    }
  };

  const handleRealtimeSave = () => {
    if (realtimeProvider) {
      updateRealtimeMutation.mutate({ 
        provider: realtimeProvider, 
        groqModel: realtimeProvider === "groq" ? realtimeGroqModel : undefined,
        openrouterModel: realtimeProvider === "openrouter" ? realtimeOpenRouterModel : undefined
      });
    }
  };

  const handleTrialSave = () => {
    if (trialRealtimeProvider) {
      updateTrialMutation.mutate({ 
        provider: trialRealtimeProvider, 
        groqModel: trialRealtimeProvider === "groq" ? trialGroqModel : undefined,
        openrouterModel: trialRealtimeProvider === "openrouter" ? trialOpenRouterModel : undefined
      });
    }
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
        {/* AI設定セクション */}
        <Card>
          <CardHeader>
            <CardTitle>AI設定</CardTitle>
            <CardDescription>
              AIサービスの設定を管理します。変更は即座に反映され、サーバー再起動は不要です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-provider">AIプロバイダー</Label>
              <Select value={aiProvider} onValueChange={handleProviderChange}>
                <SelectTrigger id="ai-provider">
                  <SelectValue placeholder="AIプロバイダーを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="ollama">Ollama (ローカル)</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                使用するAIサービスプロバイダーを選択してください
              </p>
            </div>

            {/* OpenRouterモデル選択（OpenRouterプロバイダーの場合のみ表示） */}
            {aiProvider === "openrouter" && (
              <div className="space-y-2">
                <Label htmlFor="ai-openrouter-model">OpenRouterモデル</Label>
                <Select value={aiOpenRouterModel} onValueChange={setAiOpenRouterModel}>
                  <SelectTrigger id="ai-openrouter-model">
                    <SelectValue placeholder="モデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (推奨)</SelectItem>
                    <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                    <SelectItem value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  基本AI設定で使用するOpenRouterモデルを選択してください。
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={updateProviderMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateProviderMutation.isPending ? (
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
            <div className="space-y-2">
              <Label htmlFor="realtime-provider">AIプロバイダー</Label>
              <Select value={realtimeProvider} onValueChange={setRealtimeProvider}>
                <SelectTrigger id="realtime-provider">
                  <SelectValue placeholder="プロバイダーを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (推奨)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="groq">Groq (高速)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="ollama">Ollama (ローカル)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                リアルタイム分析で使用するAIサービスプロバイダーを選択してください。
              </p>
            </div>

            {/* Groqモデル選択（Groqプロバイダーの場合のみ表示） */}
            {realtimeProvider === "groq" && (
              <div className="space-y-2">
                <Label htmlFor="realtime-groq-model">Groqモデル</Label>
                <Select value={realtimeGroqModel} onValueChange={setRealtimeGroqModel}>
                  <SelectTrigger id="realtime-groq-model">
                    <SelectValue placeholder="モデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwen/qwen3-32b">Qwen3 32B (推奨)</SelectItem>
                    <SelectItem value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  リアルタイム分析で使用するGroqモデルを選択してください。
                </p>
              </div>
            )}

            {/* OpenRouterモデル選択（OpenRouterプロバイダーの場合のみ表示） */}
            {realtimeProvider === "openrouter" && (
              <div className="space-y-2">
                <Label htmlFor="realtime-openrouter-model">OpenRouterモデル</Label>
                <Select value={realtimeOpenRouterModel} onValueChange={setRealtimeOpenRouterModel}>
                  <SelectTrigger id="realtime-openrouter-model">
                    <SelectValue placeholder="モデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (推奨)</SelectItem>
                    <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                    <SelectItem value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  リアルタイム分析で使用するOpenRouterモデルを選択してください。
                </p>
              </div>
            )}

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
            <div className="space-y-2">
              <Label htmlFor="trial-realtime-provider">お試し用AIプロバイダー</Label>
              <Select 
                value={trialRealtimeProvider} 
                onValueChange={setTrialRealtimeProvider}
                disabled={updateTrialMutation.isPending}
              >
                <SelectTrigger id="trial-realtime-provider">
                  <SelectValue placeholder="プロバイダーを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (推奨)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="groq">Groq (高速)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="ollama">Ollama (ローカル)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {isTrialMode 
                  ? "現在お試し設定が有効です。次回のリアルタイム分析でこの設定が使用されます。"
                  : "お試し用プロバイダーを選択してください。DB保存はされません。"
                }
              </p>
            </div>

            {/* お試し用Groqモデル選択（Groqプロバイダーの場合のみ表示） */}
            {trialRealtimeProvider === "groq" && (
              <div className="space-y-2">
                <Label htmlFor="trial-groq-model">お試し用Groqモデル</Label>
                <Select 
                  value={trialGroqModel} 
                  onValueChange={setTrialGroqModel}
                  disabled={updateTrialMutation.isPending}
                >
                  <SelectTrigger id="trial-groq-model">
                    <SelectValue placeholder="モデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwen/qwen3-32b">Qwen3 32B (推奨)</SelectItem>
                    <SelectItem value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  お試し用Groqモデルを選択してください。DB保存はされません。
                </p>
              </div>
            )}

            {/* お試し用OpenRouterモデル選択（OpenRouterプロバイダーの場合のみ表示） */}
            {trialRealtimeProvider === "openrouter" && (
              <div className="space-y-2">
                <Label htmlFor="trial-openrouter-model">お試し用OpenRouterモデル</Label>
                <Select 
                  value={trialOpenRouterModel} 
                  onValueChange={setTrialOpenRouterModel}
                  disabled={updateTrialMutation.isPending}
                >
                  <SelectTrigger id="trial-openrouter-model">
                    <SelectValue placeholder="モデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (推奨)</SelectItem>
                    <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                    <SelectItem value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  お試し用OpenRouterモデルを選択してください。DB保存はされません。
                </p>
              </div>
            )}

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
                  disabled={updateTrialMutation.isPending || !trialRealtimeProvider}
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