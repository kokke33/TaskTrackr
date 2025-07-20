import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "wouter";
import type { Case, WeeklyReport } from "@shared/schema";
import CaseSelectorModal from "@/components/case-selector-modal";
import { useState } from "react";

type BasicInfoFormProps = {
  cases: Case[];
  selectedCaseId: number | null;
  onSelectCase: (caseId: number) => void;
};

export function BasicInfoForm({ cases, selectedCaseId, onSelectCase }: BasicInfoFormProps) {
  const form = useFormContext<WeeklyReport>();
  const [isCaseSelectorOpen, setIsCaseSelectorOpen] = useState(false);

  return (
    <div className="p-6 bg-card rounded-lg shadow-sm">
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="reportPeriodStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="required">報告期間</FormLabel>
              <div className="flex gap-2 items-center">
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      const date = new Date(e.target.value);
                      const endDate = new Date(date);
                      endDate.setDate(date.getDate() + 7);
                      form.setValue(
                        "reportPeriodEnd",
                        endDate.toISOString().split("T")[0],
                      );
                    }}
                  />
                </FormControl>
                <span>～</span>
                <FormControl>
                  <Input
                    type="date"
                    {...form.register("reportPeriodEnd")}
                    disabled
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="caseId"
          render={({ field }) => {
            const selectedCase = cases?.find(c => c.id === field.value);
            
            return (
              <FormItem>
                <FormLabel className="required">案件</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      onClick={() => setIsCaseSelectorOpen(true)}
                    >
                      {selectedCase ? (
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{selectedCase.caseName}</span>
                          <span className="text-xs text-muted-foreground">{selectedCase.projectName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">案件を選択してください</span>
                      )}
                    </Button>
                  </FormControl>
                  <Link href="/case/new">
                    <Button variant="outline" size="icon" type="button">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="reporterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="required">報告者氏名</FormLabel>
              <FormControl>
                <Input placeholder="例: 山田太郎" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <CaseSelectorModal
        isOpen={isCaseSelectorOpen}
        onClose={() => setIsCaseSelectorOpen(false)}
        onSelect={(selectedCase) => {
          form.setValue("caseId", selectedCase.id);
          onSelectCase(selectedCase.id);
          setIsCaseSelectorOpen(false);
        }}
        cases={cases || []}
        selectedCaseId={selectedCaseId || undefined}
      />
    </div>
  );
}