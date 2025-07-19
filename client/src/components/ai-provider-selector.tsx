import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AI_PROVIDER_OPTIONS,
  GROQ_MODEL_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  OPENROUTER_MODEL_OPTIONS,
} from "@shared/ai-constants";
import { type AIProviderConfig } from "@shared/ai-types";

interface AIProviderSelectorProps {
  value: AIProviderConfig;
  onChange: (config: AIProviderConfig) => void;
  disabled?: boolean;
  prefix: string;
  description?: string;
}

export function AIProviderSelector({
  value,
  onChange,
  disabled = false,
  prefix,
  description,
}: AIProviderSelectorProps) {
  const handleProviderChange = (provider: string) => {
    onChange({
      ...value,
      provider: provider as any,
    });
  };

  const handleGroqModelChange = (groqModel: string) => {
    onChange({
      ...value,
      groqModel: groqModel as any,
    });
  };

  const handleGeminiModelChange = (geminiModel: string) => {
    onChange({
      ...value,
      geminiModel: geminiModel as any,
    });
  };

  const handleOpenRouterModelChange = (openrouterModel: string) => {
    onChange({
      ...value,
      openrouterModel: openrouterModel as any,
    });
  };

  return (
    <div className="space-y-4">
      {/* プロバイダー選択 */}
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-provider`}>AIプロバイダー</Label>
        <Select value={value.provider} onValueChange={handleProviderChange} disabled={disabled}>
          <SelectTrigger id={`${prefix}-provider`}>
            <SelectValue placeholder="プロバイダーを選択" />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Groqモデル選択 */}
      {value.provider === "groq" && (
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-groq-model`}>Groqモデル</Label>
          <Select
            value={value.groqModel || ""}
            onValueChange={handleGroqModelChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${prefix}-groq-model`}>
              <SelectValue placeholder="モデルを選択" />
            </SelectTrigger>
            <SelectContent>
              {GROQ_MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {prefix}で使用するGroqモデルを選択してください。
          </p>
        </div>
      )}

      {/* Geminiモデル選択 */}
      {value.provider === "gemini" && (
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-gemini-model`}>Geminiモデル</Label>
          <Select
            value={value.geminiModel || ""}
            onValueChange={handleGeminiModelChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${prefix}-gemini-model`}>
              <SelectValue placeholder="モデルを選択" />
            </SelectTrigger>
            <SelectContent>
              {GEMINI_MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {prefix}で使用するGeminiモデルを選択してください。
          </p>
        </div>
      )}

      {/* OpenRouterモデル選択 */}
      {value.provider === "openrouter" && (
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-openrouter-model`}>OpenRouterモデル</Label>
          <Select
            value={value.openrouterModel || ""}
            onValueChange={handleOpenRouterModelChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${prefix}-openrouter-model`}>
              <SelectValue placeholder="モデルを選択" />
            </SelectTrigger>
            <SelectContent>
              {OPENROUTER_MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {prefix}で使用するOpenRouterモデルを選択してください。
          </p>
        </div>
      )}
    </div>
  );
}