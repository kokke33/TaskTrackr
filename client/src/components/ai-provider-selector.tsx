import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import {
  AI_PROVIDER_OPTIONS,
  OPENAI_MODEL_OPTIONS,
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

// カスタムモデルのlocalStorage管理
const STORAGE_KEYS = {
  openai: 'custom-openai-models',
  groq: 'custom-groq-models',
  gemini: 'custom-gemini-models',
  openrouter: 'custom-openrouter-models',
};

const getCustomModels = (provider: string): string[] => {
  const key = STORAGE_KEYS[provider as keyof typeof STORAGE_KEYS];
  if (!key) return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCustomModels = (provider: string, models: string[]) => {
  const key = STORAGE_KEYS[provider as keyof typeof STORAGE_KEYS];
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(models));
  } catch {
    // localStorage使用不可の場合は無視
  }
};

export function AIProviderSelector({
  value,
  onChange,
  disabled = false,
  prefix,
  description,
}: AIProviderSelectorProps) {
  // カスタムモデル管理のステート
  const [customOpenAIModels, setCustomOpenAIModels] = useState<string[]>([]);
  const [customGroqModels, setCustomGroqModels] = useState<string[]>([]);
  const [customGeminiModels, setCustomGeminiModels] = useState<string[]>([]);
  const [customOpenRouterModels, setCustomOpenRouterModels] = useState<string[]>([]);
  const [newModelInputs, setNewModelInputs] = useState({
    openai: '',
    groq: '',
    gemini: '',
    openrouter: '',
  });

  // localStorage からカスタムモデルを読み込み
  useEffect(() => {
    setCustomOpenAIModels(getCustomModels('openai'));
    setCustomGroqModels(getCustomModels('groq'));
    setCustomGeminiModels(getCustomModels('gemini'));
    setCustomOpenRouterModels(getCustomModels('openrouter'));
  }, []);

  const handleProviderChange = (provider: string) => {
    onChange({
      ...value,
      provider: provider as any,
    });
  };

  const handleOpenAIModelChange = (openaiModel: string) => {
    onChange({
      ...value,
      openaiModel: openaiModel as any,
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

  // カスタムモデル追加
  const addCustomModel = (provider: 'openai' | 'groq' | 'gemini' | 'openrouter') => {
    const input = newModelInputs[provider].trim();
    if (!input) return;

    let currentModels: string[];
    let setModels: (models: string[]) => void;
    
    switch (provider) {
      case 'openai':
        currentModels = customOpenAIModels;
        setModels = setCustomOpenAIModels;
        break;
      case 'groq':
        currentModels = customGroqModels;
        setModels = setCustomGroqModels;
        break;
      case 'gemini':
        currentModels = customGeminiModels;
        setModels = setCustomGeminiModels;
        break;
      case 'openrouter':
        currentModels = customOpenRouterModels;
        setModels = setCustomOpenRouterModels;
        break;
    }

    // 重複チェック
    if (currentModels.includes(input)) return;

    const newModels = [...currentModels, input];
    setModels(newModels);
    saveCustomModels(provider, newModels);
    
    // 入力欄をクリア
    setNewModelInputs(prev => ({ ...prev, [provider]: '' }));
  };

  // カスタムモデル削除
  const removeCustomModel = (provider: 'openai' | 'groq' | 'gemini' | 'openrouter', modelToRemove: string) => {
    let currentModels: string[];
    let setModels: (models: string[]) => void;
    
    switch (provider) {
      case 'openai':
        currentModels = customOpenAIModels;
        setModels = setCustomOpenAIModels;
        break;
      case 'groq':
        currentModels = customGroqModels;
        setModels = setCustomGroqModels;
        break;
      case 'gemini':
        currentModels = customGeminiModels;
        setModels = setCustomGeminiModels;
        break;
      case 'openrouter':
        currentModels = customOpenRouterModels;
        setModels = setCustomOpenRouterModels;
        break;
    }

    const newModels = currentModels.filter(model => model !== modelToRemove);
    setModels(newModels);
    saveCustomModels(provider, newModels);
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

      {/* OpenAIモデル選択 */}
      {value.provider === "openai" && (
        <div className="space-y-3">
          <Label htmlFor={`${prefix}-openai-model`}>OpenAIモデル</Label>
          
          {/* カスタムモデル追加 */}
          <div className="flex gap-2">
            <Input
              placeholder="カスタムモデルID (例: gpt-4-turbo-preview)"
              value={newModelInputs.openai}
              onChange={(e) => setNewModelInputs(prev => ({ ...prev, openai: e.target.value }))}
              disabled={disabled}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => addCustomModel('openai')}
              disabled={disabled || !newModelInputs.openai.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* 追加済みカスタムモデル表示 */}
          {customOpenAIModels.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">追加済みカスタムモデル:</div>
              <div className="flex flex-wrap gap-2">
                {customOpenAIModels.map((model) => (
                  <Badge key={model} variant="outline" className="flex items-center gap-1">
                    {model}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCustomModel('openai', model)}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* モデル選択 */}
          <Select
            value={value.openaiModel || ""}
            onValueChange={handleOpenAIModelChange}
            disabled={disabled}
          >
            <SelectTrigger id={`${prefix}-openai-model`}>
              <SelectValue placeholder="モデルを選択" />
            </SelectTrigger>
            <SelectContent>
              {OPENAI_MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {customOpenAIModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model} (カスタム)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {prefix}で使用するOpenAIモデルを選択してください。
          </p>
        </div>
      )}

      {/* Groqモデル選択 */}
      {value.provider === "groq" && (
        <div className="space-y-3">
          <Label htmlFor={`${prefix}-groq-model`}>Groqモデル</Label>
          
          {/* カスタムモデル追加 */}
          <div className="flex gap-2">
            <Input
              placeholder="カスタムモデルID (例: llama-3.2-90b-text-preview)"
              value={newModelInputs.groq}
              onChange={(e) => setNewModelInputs(prev => ({ ...prev, groq: e.target.value }))}
              disabled={disabled}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => addCustomModel('groq')}
              disabled={disabled || !newModelInputs.groq.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* 追加済みカスタムモデル表示 */}
          {customGroqModels.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">追加済みカスタムモデル:</div>
              <div className="flex flex-wrap gap-2">
                {customGroqModels.map((model) => (
                  <Badge key={model} variant="outline" className="flex items-center gap-1">
                    {model}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCustomModel('groq', model)}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* モデル選択 */}
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
              {customGroqModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model} (カスタム)
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
        <div className="space-y-3">
          <Label htmlFor={`${prefix}-gemini-model`}>Geminiモデル</Label>
          
          {/* カスタムモデル追加 */}
          <div className="flex gap-2">
            <Input
              placeholder="カスタムモデルID (例: gemini-2.0-pro)"
              value={newModelInputs.gemini}
              onChange={(e) => setNewModelInputs(prev => ({ ...prev, gemini: e.target.value }))}
              disabled={disabled}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => addCustomModel('gemini')}
              disabled={disabled || !newModelInputs.gemini.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* 追加済みカスタムモデル表示 */}
          {customGeminiModels.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">追加済みカスタムモデル:</div>
              <div className="flex flex-wrap gap-2">
                {customGeminiModels.map((model) => (
                  <Badge key={model} variant="outline" className="flex items-center gap-1">
                    {model}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCustomModel('gemini', model)}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* モデル選択 */}
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
              {customGeminiModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model} (カスタム)
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
        <div className="space-y-3">
          <Label htmlFor={`${prefix}-openrouter-model`}>OpenRouterモデル</Label>
          
          {/* カスタムモデル追加 */}
          <div className="flex gap-2">
            <Input
              placeholder="カスタムモデルID (例: meta-llama/llama-3.2-90b-instruct)"
              value={newModelInputs.openrouter}
              onChange={(e) => setNewModelInputs(prev => ({ ...prev, openrouter: e.target.value }))}
              disabled={disabled}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => addCustomModel('openrouter')}
              disabled={disabled || !newModelInputs.openrouter.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* 追加済みカスタムモデル表示 */}
          {customOpenRouterModels.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">追加済みカスタムモデル:</div>
              <div className="flex flex-wrap gap-2">
                {customOpenRouterModels.map((model) => (
                  <Badge key={model} variant="outline" className="flex items-center gap-1">
                    {model}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCustomModel('openrouter', model)}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* モデル選択 */}
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
              {customOpenRouterModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model} (カスタム)
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