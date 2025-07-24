import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";

export function SessionMonitor() {
  const { isAuthenticated, isLoading, refreshSession } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('online');
  const [showConnectionAlert, setShowConnectionAlert] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  // 接続状態監視
  useEffect(() => {
    const checkConnection = async () => {
      if (!isAuthenticated || isLoading) return;
      
      setConnectionStatus('checking');
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
        
        const response = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            setConnectionStatus('online');
            setShowConnectionAlert(false);
          } else {
            setConnectionStatus('offline');
            setShowConnectionAlert(true);
          }
        } else {
          setConnectionStatus('offline');
          setShowConnectionAlert(true);
        }
        
        setLastCheck(new Date());
      } catch (error) {
        console.log('接続チェックでエラー:', error);
        setConnectionStatus('offline');
        setShowConnectionAlert(true);
        setLastCheck(new Date());
      }
    };

    // 初回チェック
    checkConnection();

    // 3分ごとに接続状態をチェック
    const interval = setInterval(checkConnection, 3 * 60 * 1000);

    // ブラウザのオンライン/オフライン状態も監視
    const handleOnline = () => {
      console.log('ブラウザがオンラインになりました');
      checkConnection();
    };

    const handleOffline = () => {
      console.log('ブラウザがオフラインになりました');
      setConnectionStatus('offline');
      setShowConnectionAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, isLoading]);

  // 手動でセッションを再試行
  const handleRetrySession = async () => {
    setConnectionStatus('checking');
    
    const success = await refreshSession();
    if (success) {
      setConnectionStatus('online');
      setShowConnectionAlert(false);
    } else {
      setConnectionStatus('offline');
      // 再認証が必要な場合はログインページにリダイレクト
      window.location.href = '/login';
    }
  };

  // 認証されていない場合は何も表示しない
  if (!isAuthenticated || isLoading) {
    return null;
  }

  return (
    <div className="fixed top-16 right-4 z-50 max-w-md">
      {/* 接続状態インジケーター - ヘッダーバーの下に配置 */}
      <div className="flex items-center justify-end mb-2">
        <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border shadow-sm">
          {connectionStatus === 'online' && (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span>接続中</span>
            </>
          )}
          {connectionStatus === 'offline' && (
            <>
              <WifiOff className="h-3 w-3 text-red-500" />
              <span>接続切断</span>
            </>
          )}
          {connectionStatus === 'checking' && (
            <>
              <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>確認中</span>
            </>
          )}
        </div>
      </div>

      {/* 接続エラーアラート */}
      {showConnectionAlert && (
        <Alert variant="destructive" className="shadow-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>接続エラー</AlertTitle>
          <AlertDescription className="mt-2">
            サーバーとの接続が切断されました。しばらく離席された場合、セッションが期限切れになった可能性があります。
            <div className="mt-3 flex space-x-2">
              <Button 
                size="sm" 
                onClick={handleRetrySession}
                disabled={connectionStatus === 'checking'}
              >
                再接続を試行
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => window.location.href = '/login'}
              >
                ログインページへ
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              最終確認: {lastCheck.toLocaleTimeString()}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}