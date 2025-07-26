// client/src/contexts/WebSocketProvider.tsx

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { WebSocketContext, WebSocketStatus, WebSocketMessage, EditingUser } from './WebSocketContext';

interface WebSocketProviderProps {
  children: ReactNode;
  url: string; // WebSocketサーバーのURL
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, url }) => {
  console.log('[WebSocketProvider] ***** COMPONENT MOUNTED *****');
  console.log('[WebSocketProvider] Initializing with URL:', url);
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const INITIAL_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 30000;

  const connect = useCallback(() => {
    console.log('[WebSocketProvider] connect() called');
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('[WebSocketProvider] WebSocket already exists and not closed, skipping');
      return;
    }

    console.log('[WebSocketProvider] Attempting to connect to:', url);
    setStatus('connecting');
    
    try {
      wsRef.current = new WebSocket(url);
      console.log('[WebSocketProvider] WebSocket instance created');
    } catch (error) {
      console.error('[WebSocketProvider] Failed to create WebSocket:', error);
      setStatus('closed');
      return;
    }

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setStatus('open');
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // 接続成功後、pingを送信してユーザーIDを取得
      console.log('[WebSocketProvider] Sending ping to get user ID');
      wsRef.current?.send(JSON.stringify({ type: 'ping' }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('[WebSocketProvider] Received message:', message);
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
            console.log('[WebSocketProvider] Setting editing users:', users);
            console.log('[WebSocketProvider] User IDs and types:', users.map(u => ({ userId: u.userId, type: typeof u.userId })));
            setEditingUsers(users);
          }
        } else if (message.type === 'pong') {
          console.log('[WebSocketProvider] Received pong:', message);
          if ((message as any).userId) {
            const userId = String((message as any).userId);
            console.log('[WebSocketProvider] Setting currentUserId:', { 
              originalUserId: (message as any).userId, 
              stringUserId: userId, 
              type: typeof userId 
            });
            setCurrentUserId(userId);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('[WebSocketProvider] WebSocket disconnected. Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean);
      setStatus('closed');
      // 意図しない切断の場合、再接続を試みる
      if (event.code !== 1000) {
        console.log('[WebSocketProvider] Scheduling reconnect due to unexpected disconnect');
        scheduleReconnect();
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('[WebSocketProvider] WebSocket error:', error);
      console.error('[WebSocketProvider] WebSocket readyState:', wsRef.current?.readyState);
      // onerrorは通常oncloseもトリガーするため、再接続はoncloseに任せる
    };
  }, [url]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocketProvider] WebSocket reconnect attempts exceeded.');
      return;
    }
    setStatus('reconnecting');
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );

    console.log(`[WebSocketProvider] Scheduling reconnect attempt ${reconnectAttemptsRef.current + 1} in ${delay}ms`);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    console.log('[WebSocketProvider] useEffect triggered, calling connect()');
    console.log('[WebSocketProvider] Current WebSocket state:', wsRef.current?.readyState);
    connect();
    return () => {
      console.log('[WebSocketProvider] Component unmounting, cleaning up');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // アンマウント時の再接続を防止
        wsRef.current.close(1000, 'Provider unmounting');
      }
    };
  }, [connect]);
  
  // デバッグ用: 強制的に接続状態をチェック
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = wsRef.current?.readyState;
      console.log('[WebSocketProvider] Status check:', {
        status,
        readyState: currentState,
        url: wsRef.current?.url
      });
      
      // WebSocketが実際にCLOSEDなのにstatusがconnectingの場合、強制的に修正
      if (currentState === WebSocket.CLOSED && status === 'connecting') {
        console.log('[WebSocketProvider] Force updating status to closed');
        setStatus('closed');
        // 再接続を試行
        setTimeout(() => {
          console.log('[WebSocketProvider] Attempting reconnect after state mismatch');
          connect();
        }, 1000);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [status, connect]);

  const sendMessage = useCallback((message: any) => {
    console.log('[WebSocketProvider] sendMessage called:', message);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketProvider] Sending message:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocketProvider] WebSocket is not open. Message not sent.', {
        message,
        readyState: wsRef.current?.readyState,
        status
      });
      // 必要であればメッセージキューイングのロジックをここに追加
    }
  }, [status]);

  const contextValue = {
    status,
    lastMessage,
    sendMessage,
    editingUsers,
    currentUserId,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};