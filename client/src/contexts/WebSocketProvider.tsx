// client/src/contexts/WebSocketProvider.tsx

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { WebSocketContext, WebSocketStatus, WebSocketMessage, EditingUser } from './WebSocketContext';
import { useAuth } from '@/lib/auth';
import { createLogger } from '@shared/logger';

interface WebSocketProviderProps {
  children: ReactNode;
  url: string; // WebSocketサーバーのURL
  onDataUpdate?: (reportId: number, updatedBy: string, newVersion: number) => void;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, url, onDataUpdate }) => {
  const logger = createLogger('WebSocketProvider');
  const { user, isSessionExpired } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // 🔥 修正: キャッシュを削除（WebSocketのリアルタイムデータを使用するため不要）

  const MAX_RECONNECT_ATTEMPTS = 5; // 試行回数を削減
  const INITIAL_RECONNECT_DELAY = 2000; // 初期遅延を2秒に延長
  const MAX_RECONNECT_DELAY = 300000; // 最大遅延を5分に延長

  const connect = useCallback(() => {
    // 認証状態を事前確認 - 未認証時やセッション期限切れ時は接続しない
    if (!user || isSessionExpired) {
      logger.debug('User not authenticated or session expired, skipping WebSocket connection', {
        hasUser: !!user,
        isSessionExpired
      });
      setStatus('closed');
      return;
    }

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      logger.debug('WebSocket already active, skipping connection');
      return;
    }

    // ブラウザタブがバックグラウンドの場合は接続を延期
    if (document.hidden) {
      logger.debug('Tab is hidden, deferring WebSocket connection');
      return;
    }

    // URL validation - より厳密なチェック
    if (!url || url.includes('undefined') || url.includes('null') || !url.startsWith('ws')) {
      logger.error('Invalid WebSocket URL detected', undefined, {
        url,
        validFormat: url ? url.startsWith('ws') : false,
        hasUndefined: url ? url.includes('undefined') : false,
        hasNull: url ? url.includes('null') : false
      });
      setStatus('closed');
      return;
    }

    logger.info('Initializing WebSocket connection', { url, username: user.username });
    setStatus('connecting');
    
    try {
      wsRef.current = new WebSocket(url);
    } catch (error) {
      logger.error('Failed to create WebSocket', error instanceof Error ? error : new Error(String(error)));
      setStatus('closed');
      return;
    }

    wsRef.current.onopen = () => {
      logger.info('WebSocket connected');
      setStatus('open');
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // 接続成功後、pingを送信してユーザーIDを取得
      wsRef.current?.send(JSON.stringify({ type: 'ping' }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        logger.debug('Received message', { message });
        setLastMessage(message);
        
        // 編集ユーザー関連のメッセージを処理
        if (message.type === 'editing_users') {
          // サーバーから送信される構造: { type: 'editing_users', reportId, users }
          if (Array.isArray((message as any).users)) {
            const users = (message as any).users.map((user: any) => ({
              userId: String(user.userId), // 文字列に統一
              username: user.username,
              startTime: new Date(user.startTime),
              lastActivity: new Date(user.lastActivity)
            }));
            logger.debug('Setting editing users', { users, userTypes: users.map((u: any) => ({ userId: u.userId, type: typeof u.userId })) });
            setEditingUsers(users);
          }
        } else if (message.type === 'pong') {
          logger.debug('PONG MESSAGE RECEIVED', { message });
          if ((message as any).userId) {
            const originalUserId = (message as any).userId;
            const userId = String(originalUserId);
            logger.info('Setting current user ID', {
              originalUserId,
              originalType: typeof originalUserId,
              stringUserId: userId, 
              stringType: typeof userId,
              username: (message as any).username
            });
            setCurrentUserId(userId);
          } else {
            logger.warn('No userId in pong message');
          }
        } else if (message.type === 'data_updated') {
          // データ更新通知の処理
          const { reportId, updatedBy, newVersion } = message as any;
          logger.info('Data update notification received', { reportId, updatedBy, newVersion });
          
          if (onDataUpdate && reportId && updatedBy && newVersion) {
            onDataUpdate(reportId, updatedBy, newVersion);
          }
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message', error instanceof Error ? error : new Error(String(error)));
      }
    };

    wsRef.current.onclose = (event) => {
      logger.info('WebSocket disconnected', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      setStatus('closed');
      
      // 認証エラー（1008, 1011）の場合は再接続を完全停止
      if (event.code === 1008 || event.code === 1011) {
        logger.warn('Authentication failed - stopping all reconnection attempts', { code: event.code });
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // 再接続試行カウンターをリセット
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        return;
      }
      
      // 正常切断（1000）の場合も再接続しない
      if (event.code === 1000) {
        logger.info('Normal disconnection - not reconnecting');
        return;
      }
      
      // その他の意図しない切断の場合のみ再接続を試行
      logger.info('Scheduling reconnect due to unexpected disconnect', { code: event.code });
      scheduleReconnect();
    };

    wsRef.current.onerror = (error) => {
      logger.error('WebSocket error', undefined, { errorEvent: error, readyState: wsRef.current?.readyState });
      // onerrorは通常oncloseもトリガーするため、再接続はoncloseに任せる
    };
  }, [url, user, isSessionExpired]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('WebSocket reconnect attempts exceeded', undefined, { currentAttempts: reconnectAttemptsRef.current, maxAttempts: MAX_RECONNECT_ATTEMPTS });
      return;
    }
    setStatus('reconnecting');
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );

    logger.info('Scheduling reconnect attempt', { attempt: reconnectAttemptsRef.current + 1, delay });
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, [connect]);

  // ページ可視性変更時の処理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && status === 'closed') {
        logger.info('Tab became visible, attempting WebSocket connection');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connect, user, status]);

  // セッション期限切れ時の即座切断
  useEffect(() => {
    if (isSessionExpired && (status === 'open' || status === 'connecting')) {
      logger.warn('Session expired - immediately closing WebSocket');
      reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // 再接続を停止
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(4000, 'Session expired'); // 許可されたカスタムコードに変更
      }
      setStatus('closed');
      setCurrentUserId(undefined);
      setEditingUsers([]);
    }
  }, [isSessionExpired, status]);

  // 認証状態に基づく接続制御
  useEffect(() => {
    // userオブジェクトが利用可能になった後に接続を試みる
    if (user && status === 'closed' && !document.hidden && !isSessionExpired) {
      logger.info('User authenticated, connecting WebSocket');
      connect();
    } else if (!user && (status === 'open' || status === 'connecting')) {
      // userがnullまたはundefinedの場合、WebSocket接続を閉じる
      logger.info('User not authenticated or session expired, closing WebSocket');
      reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // 再接続を停止
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'User not authenticated');
      }
      setStatus('closed');
      setCurrentUserId(undefined);
      setEditingUsers([]);
    }
  }, [user, status, connect, isSessionExpired]);

  // 緊急対処: HTTP認証からcurrentUserIdを設定（WebSocket pongが来ない場合のフォールバック）
  useEffect(() => {
    if (user && !currentUserId && status === 'open') {
      const fallbackUserId = String(user.id);
      logger.info('Setting fallback currentUserId from auth', {
        userId: user.id,
        stringUserId: fallbackUserId,
        username: user.username,
        reason: 'WebSocket pong not received'
      });
      setCurrentUserId(fallbackUserId);
    }
  }, [user, currentUserId, status]);

  // クリーンアップ用のuseEffect
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // アンマウント時の再接続を防止
        wsRef.current.close(1000, 'Provider unmounting');
      }
    };
  }, []);
  
  // WebSocket状態の同期チェック（頻度を削減）
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = wsRef.current?.readyState;
      
      // WebSocketが実際にCLOSEDなのにstatusがconnectingの場合、強制的に修正
      if (currentState === WebSocket.CLOSED && status === 'connecting') {
        logger.debug('Sync status: closed');
        setStatus('closed');
      }
    }, 10000); // 10秒に1回に変更
    
    return () => clearInterval(interval);
  }, [status]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      logger.warn('WebSocket not connected, message not sent');
    }
  }, []);

  const checkEditingPermission = useCallback(async (reportId: number): Promise<{ allowed: boolean; message?: string; editingUsers?: EditingUser[] }> => {
    logger.info('🔍 [RESTORE] Checking editing permission using API for specific reportId', { 
      reportId, 
      status, 
      currentUserId
    });
    
    if (status !== 'open') {
      return { allowed: false, message: 'WebSocket接続が確立されていません。' };
    }
    
    if (!currentUserId) {
      return { allowed: false, message: 'ユーザー認証に失敗しました。' };
    }

    try {
      // 🔥 元のAPI方式に戻す: 特定のreportIdの編集ユーザーを取得
      const { apiRequest } = await import('@/lib/queryClient');
      const response = await apiRequest(`/api/reports/${reportId}/editing-users`, { method: 'GET' });
      
      logger.debug('🔍 [RESTORE] API response for editing users', { 
        reportId,
        response,
        editingUsersCount: response.editingUsers?.length || 0
      });
      
      if (response.editingUsers && response.editingUsers.length > 0) {
        // 他のユーザーが編集中の場合、自分を除外して確認
        const otherEditingUsers = response.editingUsers.filter((user: EditingUser) => 
          String(user.userId) !== String(currentUserId)
        );
        
        logger.debug('🔍 [RESTORE] Other editing users after filtering', { 
          otherEditingUsers: otherEditingUsers.map((user: { userId: string; username: string }) => ({ userId: user.userId, username: user.username })),
          otherUsersCount: otherEditingUsers.length,
          currentUserId,
          currentUserIdType: typeof currentUserId
        });
        
        if (otherEditingUsers.length > 0) {
          const usernames = otherEditingUsers.map((user: EditingUser) => user.username).join(', ');
          const blockedResult = {
            allowed: false,
            message: `このレポートは現在 ${usernames} が編集中です。編集が完了するまでお待ちください。`,
            editingUsers: otherEditingUsers
          };
          
          logger.info('🚫 [RESTORE] Editing blocked - other users are editing', { 
            reportId,
            blockedBy: usernames,
            otherUsersCount: otherEditingUsers.length
          });
          return blockedResult;
        }
      }
      
      // 他のユーザーが編集中でなければ許可
      const result = { allowed: true };
      logger.info('✅ [RESTORE] Editing permission granted - no other users editing', { 
        reportId,
        currentUserId
      });
      return result;
    } catch (error) {
      logger.error('❌ [RESTORE] Failed to check editing permission', error instanceof Error ? error : new Error(String(error)));
      
      // エラー時も編集を許可しない
      const errorResult = { allowed: false, message: '編集権限の確認中にエラーが発生しました。' };
      return errorResult;
    }
  }, [status, currentUserId]); // editingUsersを依存配列から削除

  const contextValue = {
    status,
    lastMessage,
    sendMessage,
    editingUsers,
    currentUserId,
    onDataUpdate,
    checkEditingPermission,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
