import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { Redirect, Route, useLocation, RouteComponentProps } from "wouter";

type ProtectedRouteProps = {
  path: string;
  component: React.ComponentType<any>;
};

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // 未認証の場合はログインページにリダイレクト
  if (!isAuthenticated) {
    return (
      <Route path={path}>
        {() => <Redirect to="/login" />}
      </Route>
    );
  }

  // 認証済みの場合はコンポーネントをラップして表示
  return (
    <Route path={path}>
      {(params) => <Component {...params} />}
    </Route>
  );
}