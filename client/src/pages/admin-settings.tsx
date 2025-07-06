import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Settings, Save, RefreshCw, AlertCircle } from "lucide-react";

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

export default function AdminSettings() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [aiProvider, setAiProvider] = useState<string>("");

  // システム設定を取得
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettings,
  });

  // AI_PROVIDER設定を更新
  const updateProviderMutation = useMutation({
    mutationFn: (provider: string) => 
      updateSystemSetting("AI_PROVIDER", provider, "AIサービスプロバイダー (openai, ollama, gemini, groq)"),
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

  // 設定データから現在のAI_PROVIDERを取得
  useEffect(() => {
    if (settings) {
      const aiProviderSetting = settings.find(setting => setting.key === "AI_PROVIDER");
      if (aiProviderSetting) {
        setAiProvider(aiProviderSetting.value);
      }
    }
  }, [settings]);

  const handleProviderChange = (value: string) => {
    setAiProvider(value);
  };

  const handleSave = () => {
    if (aiProvider) {
      updateProviderMutation.mutate(aiProvider);
    }
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
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                使用するAIサービスプロバイダーを選択してください
              </p>
            </div>

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
                {settings.map((setting) => (
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