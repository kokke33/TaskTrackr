import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Search, Code, FileText, Settings, MessageSquare, AlertCircle } from "lucide-react";
import type { AiPrompt } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  name: z.string().min(1, "プロンプト名は必須です"),
  category: z.string().min(1, "カテゴリは必須です"),
  description: z.string().optional(),
  systemMessage: z.string().optional(),
  userMessageTemplate: z.string().optional(),
  functionName: z.string().optional(),
  sourceLocation: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

const categoryIcons = {
  "テキスト処理": FileText,
  "プロジェクト管理": Settings,
  "レポート作成": MessageSquare,
  "システム設定": Settings,
  "その他": Code,
};

const categoryColors = {
  "テキスト処理": "blue",
  "プロジェクト管理": "green",
  "レポート作成": "purple",
  "システム設定": "orange",
  "その他": "gray",
};

export default function AiPrompts() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["/api/ai-prompts"],
    queryFn: () => apiRequest<AiPrompt[]>("/api/ai-prompts"),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      systemMessage: "",
      userMessageTemplate: "",
      functionName: "",
      sourceLocation: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("/api/ai-prompts", {
      method: "POST",
      body: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts"] });
      toast({
        title: "プロンプトを作成しました",
        description: "新しいAIプロンプトが正常に作成されました。",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: "プロンプトの作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => 
      apiRequest(`/api/ai-prompts/${id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts"] });
      toast({
        title: "プロンプトを更新しました",
        description: "AIプロンプトが正常に更新されました。",
      });
      setIsDialogOpen(false);
      setEditingPrompt(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: "プロンプトの更新に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/ai-prompts/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prompts"] });
      toast({
        title: "プロンプトを削除しました",
        description: "AIプロンプトが正常に削除されました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: "プロンプトの削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: FormData) => {
    if (editingPrompt) {
      updateMutation.mutate({ id: editingPrompt.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (prompt: AiPrompt) => {
    setEditingPrompt(prompt);
    form.reset({
      name: prompt.name,
      category: prompt.category,
      description: prompt.description || "",
      systemMessage: prompt.systemMessage || "",
      userMessageTemplate: prompt.userMessageTemplate || "",
      functionName: prompt.functionName || "",
      sourceLocation: prompt.sourceLocation || "",
      isActive: prompt.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("このプロンプトを削除してもよろしいですか？")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredPrompts = prompts.filter(prompt => {
    const matchesCategory = selectedCategory === "all" || prompt.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.systemMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = Array.from(new Set(prompts.map(p => p.category)));

  const openCreateDialog = () => {
    setEditingPrompt(null);
    form.reset();
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">AIプロンプト管理</h1>
          <p className="text-muted-foreground mt-2">
            システムで使用されているAIプロンプトを管理します
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              新しいプロンプト
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPrompt ? "プロンプト編集" : "新しいプロンプト"}
              </DialogTitle>
              <DialogDescription>
                {editingPrompt ? "既存のプロンプトを編集します" : "新しいAIプロンプトを作成します"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>プロンプト名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="例: テキスト要約" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>カテゴリ</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="カテゴリを選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="テキスト処理">テキスト処理</SelectItem>
                            <SelectItem value="プロジェクト管理">プロジェクト管理</SelectItem>
                            <SelectItem value="レポート作成">レポート作成</SelectItem>
                            <SelectItem value="システム設定">システム設定</SelectItem>
                            <SelectItem value="その他">その他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>説明</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="プロンプトの説明を入力してください" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>システムメッセージ</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="AIの役割や振る舞いを定義するメッセージ"
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        AIの役割や振る舞いを定義します
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="userMessageTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ユーザーメッセージテンプレート</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="例: 以下のテキストを要約してください:\n\n${text}"
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        ${"{変数名}"} の形式で変数を使用できます
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="functionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>関数名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="例: generateSummary" />
                        </FormControl>
                        <FormDescription>
                          関連する関数名（参考情報）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sourceLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ソースコード場所</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="例: server/ai-service.ts:53-57" />
                        </FormControl>
                        <FormDescription>
                          コード内の場所（参考情報）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">有効</FormLabel>
                        <FormDescription>
                          このプロンプトを有効にする
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingPrompt ? "更新" : "作成"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="プロンプトを検索..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="カテゴリで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredPrompts.map((prompt) => {
          const IconComponent = categoryIcons[prompt.category as keyof typeof categoryIcons] || Code;
          const categoryColor = categoryColors[prompt.category as keyof typeof categoryColors] || "gray";
          
          return (
            <Card key={prompt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{prompt.name}</CardTitle>
                      <CardDescription>{prompt.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={categoryColor as any}>
                      {prompt.category}
                    </Badge>
                    {!prompt.isActive && (
                      <Badge variant="secondary">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        無効
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {prompt.systemMessage && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">システムメッセージ</Label>
                      <div className="mt-1 p-3 bg-muted rounded text-sm">
                        {prompt.systemMessage.length > 200 
                          ? `${prompt.systemMessage.substring(0, 200)}...` 
                          : prompt.systemMessage}
                      </div>
                    </div>
                  )}
                  
                  {prompt.userMessageTemplate && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">ユーザーメッセージテンプレート</Label>
                      <div className="mt-1 p-3 bg-muted rounded text-sm font-mono">
                        {prompt.userMessageTemplate.length > 150 
                          ? `${prompt.userMessageTemplate.substring(0, 150)}...` 
                          : prompt.userMessageTemplate}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {prompt.functionName && (
                        <span>関数: {prompt.functionName}</span>
                      )}
                      {prompt.sourceLocation && (
                        <span>場所: {prompt.sourceLocation}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(prompt)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(prompt.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPrompts.length === 0 && (
        <Card className="p-8 text-center">
          <CardContent>
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">プロンプトが見つかりません</h3>
            <p className="text-muted-foreground">
              {searchQuery || selectedCategory !== "all" 
                ? "検索条件に一致するプロンプトがありません" 
                : "まだプロンプトが登録されていません"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}