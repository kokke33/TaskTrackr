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
  isSessionExpired: boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const { toast } = useToast();

  // セッション監視タイマー
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout;
    
    if (isAuthenticated) {
      // 5分ごとにセッション状態をチェック（離席後対策）
      sessionCheckInterval = setInterval(async () => {
        try {
          const data = await apiRequest<{ authenticated: boolean; user?: any }>("/api/check-auth", {
            method: "GET"
          });
          
          if (!data.authenticated) {
            console.log("🔔 セッション期限切れを検出しました");
            setIsSessionExpired(true);
            setIsAuthenticated(false);
            setUser(null);
            
            toast({
              title: "セッション期限切れ",
              description: "再度ログインしてください。",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.log("セッション監視エラー:", error);
        }
      }, 5 * 60 * 1000); // 5分間隔
    }
    
    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [isAuthenticated, toast]);

  const login = (userData?: User) => {
    setIsAuthenticated(true);
    setIsSessionExpired(false); // セッション期限切れ状態をリセット
    if (userData) {
      // 管理者フラグが確実にbooleanとして設定されるようにする
      setUser({
        ...userData,
        isAdmin: !!userData.isAdmin
      });
      console.log("認証コンテキスト更新 - 管理者権限:", !!userData.isAdmin);
    }
  };

  // セッションリフレッシュ機能（離席後の自動復旧用）
  const refreshSession = async (): Promise<boolean> => {
    try {
      const data = await apiRequest<{ authenticated: boolean; user?: any }>("/api/check-auth", {
        method: "GET"
      });
      
      if (data.authenticated && data.user) {
        setIsAuthenticated(true);
        setIsSessionExpired(false);
        setUser({
          ...data.user,
          isAdmin: !!data.user.isAdmin
        });
        console.log("✅ セッションリフレッシュ成功");
        return true;
      } else {
        console.log("❌ セッションリフレッシュ失敗 - 要再ログイン");
        return false;
      }
    } catch (error) {
      console.error("セッションリフレッシュエラー:", error);
      return false;
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
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      isLoading, 
      login, 
      logout, 
      checkAuth, 
      isSessionExpired, 
      refreshSession 
    }}>
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