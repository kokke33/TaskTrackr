import { useAuth } from "./auth";
import { useLocation, Route } from "wouter";
import { ReactNode, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // 管理者権限チェック用の関数
  const checkAdminAccess = () => {
    // ユーザー情報がまだ読み込まれていない場合はローディング表示
    if (!user && isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      );
    }

    // 認証済みだが管理者でない場合はリダイレクト
    if (user && !user.isAdmin) {
      toast({duration: 1000,});
      setLocation("/");
      return null;
    }

    // 管理者権限がある場合はコンポーネントを表示
    if (user?.isAdmin) {
      return <Component />;
    }

    // デフォルトはローディング表示
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  };

  // Routeコンポーネントを使って、パスにマッチした場合のみレンダリング
  return (
    <Route path={path}>
      {checkAdminAccess()}
    </Route>
  );
}