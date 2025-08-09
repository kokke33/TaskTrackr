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

const registerSchema = z.object({
  username: z.string().min(1, "ユーザー名を入力してください"),
  password: z.string().min(6, "パスワードは6文字以上入力してください"),
  confirmPassword: z.string().min(1, "確認用パスワードを入力してください"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
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

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      // confirmPasswordを除いてAPIに送信
      const { confirmPassword, ...userData } = data;
      
      const responseData = await apiRequest("/api/register", {
        method: "POST",
        data: userData,
      });
      
      // 登録成功メッセージを表示
      toast({
        title: "登録成功",
        description: "ユーザー登録が完了しました。ログイン画面に移動します。",
        duration: 2000,
      });
      
      // 登録成功後はログイン画面に遷移
      setTimeout(() => {
        setLocation("/login");
      }, 1000);
      
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "ユーザー登録に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleBackToLogin = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold text-center mb-6">ユーザー登録</h1>
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
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード（確認）</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        autoComplete="new-password"
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
                {form.formState.isSubmitting ? "登録中..." : "ユーザー登録"}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToLogin}
              >
                ログイン画面に戻る
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}