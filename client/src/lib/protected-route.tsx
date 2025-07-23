import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Redirect, Route, useLocation, RouteComponentProps } from "wouter";
import type { ComponentType } from "react";

type ProtectedRouteProps = {
  path: string;
  component: ComponentType<any>;
};

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <Route path={path}>
      {(params) => {
        // ローディング中はローディングスピナーを表示
        if (isLoading) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          );
        }

        // 未認証の場合はログインページにリダイレクト
        if (!isAuthenticated) {
          return <Redirect to="/login" />;
        }

        // 認証済みの場合はコンポーネントを表示
        return <Component {...params} />;
      }}
    </Route>
  );
}