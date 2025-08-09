import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "./queryClient";
import { debugLogger, DebugLogCategory } from "@/utils/debug-logger";

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

  // セッション監視タイマー（Visibility API最適化版）
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout | null = null;
    let lastCheckTime = 0;
    let isPageVisible = true;

    // セッションチェック実行関数（デバウンス付き）
    const performSessionCheck = async () => {
      const now = Date.now();
      // 30秒以内の連続チェックを防止
      if (now - lastCheckTime < 30000) {
        return;
      }
      lastCheckTime = now;

      try {
        const data = await apiRequest<{ authenticated: boolean; user?: any }>("/api/check-auth", {
          method: "GET"
        });
        
        if (!data.authenticated) {
          debugLogger.info(DebugLogCategory.AUTH, 'session_check', 'セッション期限切れを検出', {
            currentUser: user?.username,
            lastCheckTime
          });
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
        debugLogger.error(DebugLogCategory.AUTH, 'session_check', 'セッション監視エラー', error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Visibility API ハンドラー
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible;
      isPageVisible = !document.hidden;
      
      if (!wasVisible && isPageVisible && isAuthenticated) {
        // フォアグラウンド復帰時に1回のみチェック
        debugLogger.info(DebugLogCategory.AUTH, 'visibility_change', 'フォアグラウンド復帰 - セッション確認', {
          username: user?.username
        });
        performSessionCheck();
      }
    };

    // タイマー開始関数
    const startSessionTimer = () => {
      if (sessionCheckInterval) return;
      
      sessionCheckInterval = setInterval(async () => {
        // タブが見えている時のみ実行（離席対策の根幹機能）
        if (isPageVisible) {
          await performSessionCheck();
        }
      }, 5 * 60 * 1000); // 5分間隔
    };

    // タイマー停止関数
    const stopSessionTimer = () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
      }
    };

    if (isAuthenticated) {
      // Visibility API リスナー追加
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // タイマー開始
      startSessionTimer();
      
      // 初期状態を設定
      isPageVisible = !document.hidden;
    }
    
    return () => {
      // クリーンアップ
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopSessionTimer();
    };
  }, [isAuthenticated, toast]);

  const login = (userData?: User) => {
    setIsAuthenticated(true);
    setIsSessionExpired(false); // セッション期限切れ状態をリセット
    if (userData) {
      // 管理者フラグが確実にbooleanとして設定されるようにする
      const userWithAdminFlag = {
        ...userData,
        isAdmin: !!userData.isAdmin
      };
      setUser(userWithAdminFlag);
      
      debugLogger.authSuccess('login', String(userData.id), userData.username);
      debugLogger.setUser(String(userData.id), userData.username);
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
        debugLogger.info(DebugLogCategory.AUTH, 'refresh_session', 'セッションリフレッシュ成功', {
          username: data.user.username,
          isAdmin: !!data.user.isAdmin
        });
        return true;
      } else {
        debugLogger.warn(DebugLogCategory.AUTH, 'refresh_session', 'セッションリフレッシュ失敗 - 要再ログイン');
        return false;
      }
    } catch (error) {
      debugLogger.error(DebugLogCategory.AUTH, 'refresh_session', 'セッションリフレッシュエラー', error instanceof Error ? error : new Error(String(error)));
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
      
      debugLogger.authLogout();
      debugLogger.clearUser();
      
      window.location.href = "/login";
      
      toast({
        title: "ログアウト成功",
        description: "正常にログアウトしました。",
      });
    } catch (error) {
      debugLogger.error(DebugLogCategory.AUTH, 'logout', 'ログアウト処理に失敗', error instanceof Error ? error : new Error(String(error)));
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