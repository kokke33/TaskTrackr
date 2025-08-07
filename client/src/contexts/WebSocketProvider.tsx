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
  const { user } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // 🔥 修正: キャッシュを削除（WebSocketのリアルタイムデータを使用するため不要）

  const MAX_RECONNECT_ATTEMPTS = 10;
  const INITIAL_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 30000;

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      logger.debug('WebSocket already active, skipping connection');
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

    logger.info('Initializing WebSocket connection', { url });
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
      // 意図しない切断の場合、再接続を試みる（認証エラーは除外）
      if (event.code !== 1000 && event.code !== 1008 && event.code !== 1011) {
        logger.info('Scheduling reconnect due to unexpected disconnect');
        scheduleReconnect();
      } else if (event.code === 1008) {
        logger.warn('Authentication required - not reconnecting');
      }
    };

    wsRef.current.onerror = (error) => {
      logger.error('WebSocket error', undefined, { errorEvent: error, readyState: wsRef.current?.readyState });
      // onerrorは通常oncloseもトリガーするため、再接続はoncloseに任せる
    };
  }, [url]);

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

  // 認証状態に基づく接続制御
  useEffect(() => {
    if (user && status === 'closed') {
      logger.info('User authenticated, connecting WebSocket');
      connect();
    } else if (!user && (status === 'open' || status === 'connecting')) {
      logger.info('User not authenticated, closing WebSocket');
      if (wsRef.current) {
        wsRef.current.close(1000, 'User not authenticated');
      }
      setStatus('closed');
    }
  }, [user, status, connect]);

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
      logger.info('Component unmounting, cleaning up');
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
    logger.info('🔍 [Fixed] Checking editing permission using WebSocket editingUsers state', { 
      reportId, 
      status, 
      currentUserId, 
      editingUsersCount: editingUsers.length 
    });
    
    if (status !== 'open') {
      return { allowed: false, message: 'WebSocket接続が確立されていません。' };
    }
    
    if (!currentUserId) {
      return { allowed: false, message: 'ユーザー認証に失敗しました。' };
    }

    // 🔥 修正: WebSocketで管理しているeditingUsers状態を直接参照
    // APIリクエストを削除し、リアルタイムデータを使用
    logger.debug('🔍 [Fixed] Current editing users from WebSocket state', { 
      editingUsers: editingUsers.map(user => ({ userId: user.userId, username: user.username })),
      currentUserId,
      currentUserIdType: typeof currentUserId
    });
    
    // 他のユーザーが編集中かどうかを確認（自分を除外）
    const otherEditingUsers = editingUsers.filter((user: EditingUser) => 
      String(user.userId) !== String(currentUserId)
    );
    
    logger.debug('🔍 [Fixed] Other editing users after filtering', { 
      otherEditingUsers: otherEditingUsers.map(user => ({ userId: user.userId, username: user.username })),
      otherUsersCount: otherEditingUsers.length
    });
    
    if (otherEditingUsers.length > 0) {
      const usernames = otherEditingUsers.map((user: EditingUser) => user.username).join(', ');
      const blockedResult = {
        allowed: false,
        message: `このレポートは現在 ${usernames} が編集中です。編集が完了するまでお待ちください。`,
        editingUsers: otherEditingUsers
      };
      
      logger.info('🚫 [Fixed] Editing blocked - other users are editing', { 
        blockedBy: usernames,
        otherUsersCount: otherEditingUsers.length
      });
      return blockedResult;
    }
    
    // 他のユーザーが編集中でなければ許可
    const result = { allowed: true };
    logger.info('✅ [Fixed] Editing permission granted - no other users editing', { 
      reportId,
      currentUserId
    });
    return result;
  }, [status, currentUserId, editingUsers]); // editingUsersを依存配列に追加

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