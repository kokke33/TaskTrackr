import { useAuth } from "./auth";
import { useLocation } from "wouter";
import { ReactNode, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

type AdminOnlyProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * 管理者専用コンポーネント
 * 管理者権限を持つユーザーのみ子コンポーネントを表示します
 * 管理者権限がない場合はfallbackを表示するか、何も表示しません
 */
export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  const { user } = useAuth();
  
  if (user?.isAdmin) {
    return <>{children}</>;
  }
  
  return fallback ? <>{fallback}</> : null;
}

type AdminRouteProps = {
  path: string;
  component: React.ComponentType<any>;
};

/**
 * 管理者専用ルートコンポーネント
 * 管理者権限を持つユーザーのみアクセス可能なルートを作成します
 */
export function AdminRoute({ path, component: Component }: AdminRouteProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // 管理者権限がない場合はホームページにリダイレクト
    if (user && !user.isAdmin) {
      toast({
        title: "アクセス権限がありません",
        description: "この画面は管理者のみアクセスできます",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [user, setLocation]);

  // 管理者権限がある場合のみコンポーネントをレンダリング
  return user?.isAdmin ? <Component /> : null;
}