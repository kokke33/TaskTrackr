import { useState, useEffect, useRef, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { WeeklyReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type UseReportAutoSaveProps = {
  form: UseFormReturn<WeeklyReport>;
  isEditMode: boolean;
  id?: string;
};

export function useReportAutoSave({ form, isEditMode, id }: UseReportAutoSaveProps) {
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const autoSave = useCallback(async () => {
    if (!formChanged) return;

    try {
      setIsAutosaving(true);
      const data = form.getValues();

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
        throw new Error("自動保存に失敗しました");
      }

      const result = await response.json();
      const now = new Date().toLocaleTimeString();
      setLastSavedTime(now);
      setFormChanged(false);

      if (!isEditMode && result.id) {
        window.history.replaceState(null, '', `/report/edit/${result.id}`);
      }
    } catch (error) {
      console.error("Error auto-saving report:", error);
    } finally {
      setIsAutosaving(false);
    }
  }, [isEditMode, id, form, formChanged]);

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

  return {
    lastSavedTime,
    isAutosaving,
    formChanged,
    handleManualAutoSave,
    handleImmediateSave,
  };
}