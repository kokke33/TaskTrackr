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
    <div className="p-4 sm:p-6 bg-card rounded-lg shadow-sm">
      <div className="space-y-3 sm:space-y-4">
        <FormField
          control={form.control}
          name="reportPeriodStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="required text-sm sm:text-base">報告期間</FormLabel>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    className="text-sm"
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
                <span className="text-center sm:text-left">～</span>
                <FormControl>
                  <Input
                    type="date"
                    {...form.register("reportPeriodEnd")}
                    className="text-sm"
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
                <FormLabel className="required text-sm sm:text-base">案件</FormLabel>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <FormControl className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-auto py-3 px-3"
                      onClick={() => setIsCaseSelectorOpen(true)}
                    >
                      {selectedCase ? (
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium text-sm">{selectedCase.caseName}</span>
                          <span className="text-xs text-muted-foreground">{selectedCase.projectName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">案件を選択してください</span>
                      )}
                    </Button>
                  </FormControl>
                  <Link href="/case/new">
                    <Button variant="outline" size="icon" type="button" className="h-12 w-12 sm:h-10 sm:w-10 flex-shrink-0">
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
              <FormLabel className="required text-sm sm:text-base">報告者氏名</FormLabel>
              <FormControl>
                <Input placeholder="例: 山田太郎" {...field} className="text-sm" />
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