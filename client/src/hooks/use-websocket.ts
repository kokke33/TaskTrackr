import { useState, useEffect, useCallback, useRef } from 'react';

// 編集ユーザー情報の型定義
export interface EditingUser {
  userId: string;
  username: string;
  startTime: Date;
  lastActivity: Date;
}

// WebSocketメッセージの型定義
interface WebSocketMessage {
  type: 'editing_users' | 'connection_confirmed';
  reportId?: number;
  users?: EditingUser[];
}

interface UseWebSocketOptions {
  reportId?: number;
  onEditingUsersChanged?: (users: EditingUser[]) => void;
}

export function useWebSocket({ reportId, onEditingUsersChanged }: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isEditingRef = useRef(false);
  
  // WebSocket接続を確立
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        
        // 再接続タイマーをクリア
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'editing_users':
              if (message.reportId === reportId && message.users) {
                const users = message.users.map(user => ({
                  ...user,
                  startTime: new Date(user.startTime),
                  lastActivity: new Date(user.lastActivity)
                }));
                setEditingUsers(users);
                onEditingUsersChanged?.(users);
              }
              break;
              
            case 'connection_confirmed':
              console.log('WebSocket connection confirmed');
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        
        // 異常終了の場合は再接続を試行
        if (event.code !== 1000 && event.code !== 1001) {
          scheduleReconnect();
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket接続エラーが発生しました');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('WebSocket接続に失敗しました');
      scheduleReconnect();
    }
  }, [reportId, onEditingUsersChanged]);
  
  // 再接続のスケジュール
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return;
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      connect();
    }, 3000); // 3秒後に再接続
  }, [connect]);
  
  // メッセージ送信
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);
  
  // 編集開始を通知
  const startEditing = useCallback(() => {
    if (!reportId || isEditingRef.current) return;
    
    isEditingRef.current = true;
    sendMessage({
      type: 'start_editing',
      reportId
    });
    
    // 定期的にアクティビティを送信
    const sendActivity = () => {
      if (isEditingRef.current && reportId) {
        sendMessage({
          type: 'activity',
          reportId
        });
        activityTimeoutRef.current = setTimeout(sendActivity, 30000); // 30秒ごと
      }
    };
    
    activityTimeoutRef.current = setTimeout(sendActivity, 30000);
  }, [reportId, sendMessage]);
  
  // 編集終了を通知
  const stopEditing = useCallback(() => {
    if (!reportId || !isEditingRef.current) return;
    
    isEditingRef.current = false;
    sendMessage({
      type: 'stop_editing',
      reportId
    });
    
    // アクティビティタイマーをクリア
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }
  }, [reportId, sendMessage]);
  
  // 接続の初期化
  useEffect(() => {
    connect();
    
    return () => {
      // クリーンアップ
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);
  
  // reportIdが変更された時の処理
  useEffect(() => {
    if (isEditingRef.current) {
      stopEditing();
    }
    setEditingUsers([]);
  }, [reportId, stopEditing]);
  
  // ページがアンロードされる時の処理
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopEditing();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopEditing();
    };
  }, [stopEditing]);
  
  return {
    isConnected,
    editingUsers,
    error,
    startEditing,
    stopEditing,
    sendMessage
  };
}