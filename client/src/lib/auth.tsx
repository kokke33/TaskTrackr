import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "./queryClient";

// ユーザー情報の型
interface User {
  id: number;
  username: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const login = () => {
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      await apiRequest("/api/logout", { 
        method: "POST"
      });
      setIsAuthenticated(false);
      setUser(null);
      setLocation("/login");
      
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
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await apiRequest<{ authenticated: boolean; user?: any }>("/api/check-auth", {
          method: "GET"
        });
        
        setIsAuthenticated(true);
        setUser(data.user || null);
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
        setUser(null);
        
        // ログインページ以外にいる場合はリダイレクト
        if (window.location.pathname !== "/login") {
          setLocation("/login");
        }
      }
    }

    checkAuth();
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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