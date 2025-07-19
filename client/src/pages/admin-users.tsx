import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Edit, Trash2, RefreshCw, AlertCircle, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

// ユーザフォーム用のスキーマ
const userFormSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "パスワード確認は必須です"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

// ユーザ編集用のスキーマ（パスワードは任意）
const userEditSchema = z.object({
  username: z.string().min(1, "ユーザ名は必須です"),
  isAdmin: z.boolean(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.password || data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

type UserFormData = z.infer<typeof userFormSchema>;
type UserEditData = z.infer<typeof userEditSchema>;

// ユーザ一覧を取得する関数
async function getUsers(): Promise<User[]> {
  console.log("[ADMIN-USERS] Requesting user list...");
  try {
    const result = await apiRequest("/api/users", { method: "GET" });
    console.log("[ADMIN-USERS] User list retrieved successfully:", result);
    return result;
  } catch (error) {
    console.error("[ADMIN-USERS] Failed to get user list:", error);
    throw error;
  }
}

// 新規ユーザ作成
async function createUser(userData: UserFormData): Promise<User> {
  const { confirmPassword, ...data } = userData;
  return await apiRequest("/api/users", { method: "POST", data });
}

// ユーザ更新
async function updateUser(id: number, userData: UserEditData): Promise<User> {
  console.log(`[ADMIN-USERS] Updating user ${id}...`, userData);
  const { confirmPassword, ...data } = userData;
  // パスワードが空の場合は除外
  if (!data.password) {
    delete data.password;
  }
  console.log(`[ADMIN-USERS] Sending update request for user ${id}:`, data);
  try {
    const result = await apiRequest(`/api/users/${id}`, { method: "PUT", data });
    console.log(`[ADMIN-USERS] User ${id} updated successfully:`, result);
    return result;
  } catch (error) {
    console.error(`[ADMIN-USERS] Failed to update user ${id}:`, error);
    throw error;
  }
}

// ユーザ削除
async function deleteUser(id: number): Promise<User> {
  return await apiRequest(`/api/users/${id}`, { method: "DELETE" });
}

export default function AdminUsers() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  console.log("[ADMIN-USERS] Page loaded with auth state:", {
    isAuthenticated,
    user: user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null,
    timestamp: new Date().toISOString()
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // ユーザ一覧クエリ
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  // 新規作成フォーム
  const createForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      isAdmin: false,
    },
  });

  // 編集フォーム
  const editForm = useForm<UserEditData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      username: "",
      isAdmin: false,
      password: "",
      confirmPassword: "",
    },
  });

  // ユーザ作成ミューテーション
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "ユーザを作成しました",
        description: "新しいユーザが正常に作成されました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "作成に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ユーザ更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserEditData }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      editForm.reset();
      toast({
        title: "ユーザを更新しました",
        description: "ユーザ情報が正常に更新されました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ユーザ削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
      toast({
        title: "ユーザを削除しました",
        description: "ユーザが正常に削除されました",
      });
    },
    onError: (error: any) => {
      toast({
        title: "削除に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: UserFormData) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: UserEditData) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      username: user.username,
      isAdmin: user.isAdmin,
      password: "",
      confirmPassword: "",
    });
  };

  const handleDelete = (user: User) => {
    // adminユーザの削除を防ぐ
    if (user.username === 'admin') {
      toast({
        title: "削除できません",
        description: "adminユーザは削除できません",
        variant: "destructive",
      });
      return;
    }
    setDeletingUser(user);
  };

  const confirmDelete = () => {
    if (deletingUser) {
      deleteMutation.mutate(deletingUser.id);
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
            <p>ユーザ一覧の読み込み中にエラーが発生しました。</p>
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
          <Users className="h-8 w-8" />
          ユーザ管理
        </h1>
        <p className="text-muted-foreground mt-2">
          システムユーザーの管理を行います（管理者のみ）
        </p>
        <div className="text-xs text-muted-foreground mt-1">
          現在のユーザー: {user?.username} (管理者: {user?.isAdmin ? "はい" : "いいえ"})
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ユーザ一覧</CardTitle>
              <CardDescription>
                システムに登録されているユーザの一覧です
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  新規ユーザ作成
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規ユーザ作成</DialogTitle>
                  <DialogDescription>
                    新しいユーザアカウントを作成します
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-username">ユーザ名</Label>
                    <Input
                      id="create-username"
                      {...createForm.register("username")}
                      placeholder="ユーザ名を入力"
                    />
                    {createForm.formState.errors.username && (
                      <p className="text-sm text-destructive">{createForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">パスワード</Label>
                    <Input
                      id="create-password"
                      type="password"
                      {...createForm.register("password")}
                      placeholder="パスワードを入力"
                    />
                    {createForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{createForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-confirm-password">パスワード確認</Label>
                    <Input
                      id="create-confirm-password"
                      type="password"
                      {...createForm.register("confirmPassword")}
                      placeholder="パスワードを再入力"
                    />
                    {createForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{createForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="create-is-admin"
                      checked={createForm.watch("isAdmin")}
                      onCheckedChange={(checked) => createForm.setValue("isAdmin", checked)}
                    />
                    <Label htmlFor="create-is-admin" className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      管理者権限
                    </Label>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      {createMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      作成
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>ユーザ名</TableHead>
                <TableHead>管理者権限</TableHead>
                <TableHead>作成日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Shield className="h-4 w-4" />
                        管理者
                      </span>
                    ) : (
                      "一般ユーザー"
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        disabled={user.username === 'admin'}
                        className="flex items-center gap-1 text-destructive hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                        title={user.username === 'admin' ? 'adminユーザは削除できません' : '削除'}
                      >
                        <Trash2 className="h-3 w-3" />
                        削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {users?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              ユーザが見つかりません
            </div>
          )}
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザ編集</DialogTitle>
            <DialogDescription>
              ユーザ情報を編集します。パスワードは変更する場合のみ入力してください。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">ユーザ名</Label>
              <Input
                id="edit-username"
                {...editForm.register("username")}
                placeholder="ユーザ名を入力"
              />
              {editForm.formState.errors.username && (
                <p className="text-sm text-destructive">{editForm.formState.errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">新しいパスワード（任意）</Label>
              <Input
                id="edit-password"
                type="password"
                {...editForm.register("password")}
                placeholder="新しいパスワードを入力（変更する場合のみ）"
              />
              {editForm.formState.errors.password && (
                <p className="text-sm text-destructive">{editForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-confirm-password">パスワード確認</Label>
              <Input
                id="edit-confirm-password"
                type="password"
                {...editForm.register("confirmPassword")}
                placeholder="パスワードを再入力"
              />
              {editForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{editForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is-admin"
                checked={editForm.watch("isAdmin")}
                onCheckedChange={(checked) => editForm.setValue("isAdmin", checked)}
              />
              <Label htmlFor="edit-is-admin" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                管理者権限
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Edit className="h-4 w-4" />
                )}
                更新
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザ削除の確認</DialogTitle>
            <DialogDescription>
              本当に「{deletingUser?.username}」を削除しますか？この操作は取り消せません。
              {deletingUser?.username === 'admin' && (
                <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
                  ⚠️ adminユーザは削除できません
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingUser(null)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || deletingUser?.username === 'admin'}
              className="flex items-center gap-2"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}