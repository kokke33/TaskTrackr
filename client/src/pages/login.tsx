import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1, "ユーザー名を入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // 既に認証済みの場合はホームページにリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  // ページ読み込み時にユーザー名フィールドにフォーカス
  useEffect(() => {
    if (usernameInputRef.current && !isAuthenticated) {
      usernameInputRef.current.focus();
    }
  }, [isAuthenticated]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const responseData = await apiRequest("/api/login", {
        method: "POST",
        data,
      });
      
      // ログイン成功メッセージを表示（成功メッセージには長めの表示時間を設定）
      toast({
        title: "ログイン成功",
        description: `${responseData.user?.username || ''}さん、ようこそ！`,
        duration: 5000, // 5秒間表示
      });
      
      // ユーザー情報を含めて認証状態を更新
      if (responseData.user) {
        // ユーザー情報をコンソールに出力してデバッグ
        console.log("Login response user data:", responseData.user);
        
        // 明示的に管理者フラグ情報をログ出力
        console.log(`ユーザー ${responseData.user.username} の管理者権限: ${responseData.user.isAdmin ? 'あり' : 'なし'}`);
        
        // ログイン成功情報をコンソールに出力
        console.log("ログイン成功 - 管理者権限:", responseData.user.isAdmin);
        
        // 認証コンテキストを更新
        login(responseData.user);
        
        // トップページに移動
        setLocation("/");
      } else {
        // ユーザー情報がない場合でも認証状態は更新
        login();
        setLocation("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "ログインに失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold text-center mb-6">週次報告システム</h1>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ユーザー名</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        ref={usernameInputRef}
                        autoComplete="username" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "ログイン中..." : "ログイン"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
