import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "./queryClient";

// ユーザー情報の型
interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (userData?: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const login = (userData?: User) => {
    setIsAuthenticated(true);
    if (userData) {
      // 管理者フラグが確実にbooleanとして設定されるようにする
      setUser({
        ...userData,
        isAdmin: !!userData.isAdmin
      });
      console.log("認証コンテキスト更新 - 管理者権限:", !!userData.isAdmin);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/api/logout", { 
        method: "POST"
      });
      setIsAuthenticated(false);
      setUser(null);
      window.location.href = "/login";
      
      toast({
        title: "ログアウト成功",
        description: "正常にログアウトしました。",
      });
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました。",
        variant: "destructive",
      });
    }
  };

  // セッションの確認
  const checkAuth = async () => {
    setIsLoading(true);
    try {
      // サーバー側が未認証時も200で応答するため、apiRequestを使用可能
      const data = await apiRequest<{ authenticated: boolean; user?: any }>("/api/check-auth", {
        method: "GET"
      });
      
      if (data.authenticated && data.user) {
        console.log("Auth check successful, user:", data.user);
        setIsAuthenticated(true);
        // 管理者フラグが確実にbooleanとして設定されるようにする
        setUser({
          ...data.user,
          isAdmin: !!data.user.isAdmin
        });
        console.log("Auth check - 管理者権限:", !!data.user.isAdmin);
      } else {
        console.log("Auth check: user not authenticated");
        setIsAuthenticated(false);
        setUser(null);
        
        // ログインページ以外にいる場合はリダイレクト
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUser(null);
      
      // ログインページ以外にいる場合はリダイレクト
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []); // 認証チェックを初回のみ実行

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}