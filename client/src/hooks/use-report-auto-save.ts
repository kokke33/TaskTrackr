import { useState, useEffect, useRef, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { WeeklyReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type UseReportAutoSaveProps = {
  form: UseFormReturn<WeeklyReport>;
  isEditMode: boolean;
  id?: string;
  currentVersion?: number;
  onVersionConflict?: (message: string) => void;
};

export function useReportAutoSave({ form, isEditMode, id, currentVersion, onVersionConflict }: UseReportAutoSaveProps) {
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  const [version, setVersion] = useState<number>(currentVersion || 1);
  const [isConflictResolving, setIsConflictResolving] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const versionRef = useRef<number>(currentVersion || 1); // バージョンの ref を追加
  const { toast } = useToast();

  // currentVersion が変更された時に ref も更新
  useEffect(() => {
    if (currentVersion && currentVersion !== versionRef.current) {
      console.log("🔄 Initial version update from props:", currentVersion);
      setVersion(currentVersion);
      versionRef.current = currentVersion;
    }
  }, [currentVersion]);

  const autoSave = useCallback(async () => {
    if (!formChanged || isConflictResolving) {
      console.log("⏩ Skipping auto-save:", { formChanged, isConflictResolving });
      return;
    }

    try {
      setIsAutosaving(true);
      const currentVersionValue = versionRef.current; // ref から最新バージョンを取得
      const data = { ...form.getValues(), version: currentVersionValue };
      
      console.log("💾 Auto-saving with version:", currentVersionValue);

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
          // 楽観的ロック競合エラー
          const errorData = await response.json();
          console.log("⚠️ Version conflict detected:", errorData);
          
          setIsConflictResolving(true);
          
          if (onVersionConflict) {
            onVersionConflict(errorData.message);
          } else {
            toast({
              title: "競合エラー", 
              description: errorData.message,
              variant: "destructive"
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
      
      // バージョンを更新
      if (result.version) {
        console.log("✅ Auto-save successful, version updated to:", result.version);
        setVersion(result.version);
        versionRef.current = result.version; // ref も同時に更新
      }

      if (!isEditMode && result.id) {
        window.history.replaceState(null, '', `/report/edit/${result.id}`);
      }
    } catch (error) {
      console.error("💥 Error auto-saving report:", error);
      toast({
        title: "自動保存エラー",
        description: "自動保存に失敗しました。手動で保存してください。",
        variant: "destructive"
      });
    } finally {
      setIsAutosaving(false);
    }
  }, [isEditMode, id, form, formChanged, isConflictResolving, onVersionConflict, toast]); // version を依存配列から削除

  useEffect(() => {
    const subscription = form.watch(() => {
      setFormChanged(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      autoSave();
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
    });
  };

  const handleImmediateSave = async (): Promise<boolean> => {
    try {
      await autoSave();
      return true;
    } catch (error) {
      console.error("Immediate save failed:", error);
      return false;
    }
  };

  // バージョンを更新する関数（外部から呼び出し可能）
  const updateVersion = useCallback((newVersion: number) => {
    console.log("🔄 Updating version and ref from", versionRef.current, "to", newVersion);
    setVersion(newVersion);
    versionRef.current = newVersion; // ref も同時に更新
  }, []);

  // 競合解決状態をリセットする関数
  const resetConflictResolving = useCallback(() => {
    setIsConflictResolving(false);
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
  };
}