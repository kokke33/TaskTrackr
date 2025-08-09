import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { WeeklyReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { devLog, devError } from "@shared/logger";

type UseReportAutoSaveProps = {
  form: UseFormReturn<WeeklyReport>;
  isEditMode: boolean;
  id?: string;
  currentVersion?: number;
  onVersionConflict?: (message: string) => void;
  isInitializing?: boolean; // 初期化中フラグ
  isSubmitting?: boolean; // メイン送信中フラグ
};

export function useReportAutoSave({ form, isEditMode, id, currentVersion, onVersionConflict, isInitializing = false, isSubmitting = false }: UseReportAutoSaveProps) {
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  const [version, setVersion] = useState<number>(currentVersion || 1);
  const [isConflictResolving, setIsConflictResolving] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const versionRef = useRef<number>(currentVersion || 1);
  const lastSavedDataRef = useRef<string>(''); // 最後に保存したデータのハッシュ
  const retryCountRef = useRef<number>(0); // リトライ回数
  const { toast } = useToast();

  // currentVersion が変更された時に ref も更新
  useEffect(() => {
    if (currentVersion && currentVersion !== versionRef.current) {
      devLog("🔄 Initial version update from props:", currentVersion);
      setVersion(currentVersion);
      versionRef.current = currentVersion;
    }
  }, [currentVersion]);

  const autoSave = useCallback(async () => {
    if (!formChanged || isConflictResolving || isSubmitting) {
      devLog("⏩ Skipping auto-save:", { formChanged, isConflictResolving, isSubmitting });
      return;
    }

    // 実質的な変更チェック - データが本当に変わったかハッシュで確認
    const currentData = form.getValues();
    const currentDataString = JSON.stringify(currentData);
    
    if (currentDataString === lastSavedDataRef.current) {
      devLog("⏩ Skipping auto-save: No substantial changes detected");
      setFormChanged(false); // formChanged状態をリセット
      return;
    }

    try {
      setIsAutosaving(true);
      const currentVersionValue = versionRef.current;
      const data = { ...currentData, version: currentVersionValue };
      
      devLog("💾 Auto-saving with version:", currentVersionValue, "dataHash:", currentDataString.length);

      let url = "/api/weekly-reports/autosave";
      let method = "POST";

      if (isEditMode && id) {
        url = `/api/weekly-reports/${id}/autosave`;
        method = "PUT";
      }

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 409) {
          // 楽観的ロック競合エラー - 自動リトライを試行
          const errorData = await response.json();
          devLog("⚠️ Version conflict detected:", errorData);
          
          retryCountRef.current += 1;
          
          // 最大3回までリトライ
          if (retryCountRef.current <= 3) {
            devLog(`🔄 Attempting auto-retry ${retryCountRef.current}/3 for version conflict`);
            
            // 最新バージョンを取得してリトライ
            try {
              const latestResponse = await fetch(`/api/weekly-reports/${id}`, {
                credentials: "include",
              });
              
              if (latestResponse.ok) {
                const latestData = await latestResponse.json();
                const newVersion = latestData.version;
                
                devLog("📥 Retrieved latest version for retry:", newVersion);
                versionRef.current = newVersion;
                setVersion(newVersion);
                
                // 短い遅延後にリトライ
                setTimeout(() => {
                  autoSave();
                }, 1000 * retryCountRef.current); // 指数バックオフ的な遅延
                
                return;
              }
            } catch (retryError) {
              devError("Failed to get latest version for retry:", retryError);
            }
          }
          
          // リトライ回数制限に達した場合
          setIsConflictResolving(true);
          retryCountRef.current = 0; // リセット
          
          if (onVersionConflict) {
            onVersionConflict(errorData.message);
          } else {
            toast({
              title: "競合エラー", 
              description: "他のユーザーがデータを更新しました。ページをリロードしてください。",
              variant: "destructive",
              duration: 1000,
            });
          }
          return;
        }
        throw new Error("自動保存に失敗しました");
      }

      const result = await response.json();
      const now = new Date().toLocaleTimeString();
      setLastSavedTime(now);
      setFormChanged(false);
      
      // 保存成功時にデータハッシュを更新
      lastSavedDataRef.current = currentDataString;
      
      // 成功時にリトライカウンターをリセット
      retryCountRef.current = 0;
      
      // バージョンを更新
      if (result.version) {
        devLog("✅ Auto-save successful, version updated to:", result.version);
        setVersion(result.version);
        versionRef.current = result.version; // ref も同時に更新
      }

      if (!isEditMode && result.id) {
        window.history.replaceState(null, '', `/report/edit/${result.id}`);
      }
    } catch (error) {
      devError("💥 Error auto-saving report:", error);
      toast({
        title: "自動保存エラー",
        description: "自動保存に失敗しました。手動で保存してください。",
        variant: "destructive",
        duration: 1000,
      });
    } finally {
      setIsAutosaving(false);
    }
  }, [isEditMode, id, form, formChanged, isConflictResolving, isSubmitting, onVersionConflict, toast]); // version を依存配列から削除

  // フォームの変更を監視（初期化中は完全無効化）- 同期実行でフリッカー防止
  useLayoutEffect(() => {
    const subscription = form.watch(() => {
      if (isInitializing) {
        return;
      }
      
      // 初期化が完了している場合のみ変更検知
      setFormChanged(true);
    });
    return () => subscription.unsubscribe();
  }, [form, isInitializing]);

  // デバウンス機能付きの自動保存タイマー
  useEffect(() => {
    if (!formChanged || !isEditMode || isSubmitting) return;

    // デバウンス期間を10秒に延長（頻繁な保存を防止）
    const debounceTimeout = setTimeout(() => {
      autoSave();
    }, 10000); // 10秒

    return () => {
      clearTimeout(debounceTimeout);
    };
  }, [formChanged, autoSave, isEditMode, isSubmitting]);

  // 5分間隔のバックアップ保存（変更がある場合のみ）
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (formChanged && !isSubmitting) {
        devLog("⏰ Periodic auto-save triggered");
        autoSave();
      }
    }, 5 * 60 * 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSave]);

  const handleManualAutoSave = async () => {
    await autoSave();
    toast({
      title: "自動保存しました",
      description: `${new Date().toLocaleTimeString()}に保存されました`,
      duration: 1000,
    });
  };

  const handleImmediateSave = async (): Promise<boolean> => {
    try {
      await autoSave();
      return true;
    } catch (error) {
      devError("Immediate save failed:", error);
      return false;
    }
  };

  // バージョンを更新する関数（外部から呼び出し可能）
  const updateVersion = useCallback((newVersion: number) => {
    devLog("🔄 Updating version and ref from", versionRef.current, "to", newVersion);
    setVersion(newVersion);
    versionRef.current = newVersion; // ref も同時に更新
  }, []);

  // 競合解決状態をリセットする関数
  const resetConflictResolving = useCallback(() => {
    setIsConflictResolving(false);
  }, []);

  const resetFormChanged = useCallback(() => {
    setFormChanged(false);
  }, []);

  return {
    lastSavedTime,
    isAutosaving,
    formChanged,
    version,
    handleManualAutoSave,
    handleImmediateSave,
    updateVersion,
    resetConflictResolving,
    resetFormChanged,
  };
}