// client/src/contexts/WebSocketContext.ts

// サーバーから受信するメッセージの型
export interface WebSocketMessage {
  type: string;
  payload: any;
}

// 編集中ユーザーの情報
export interface EditingUser {
  userId: string;
  username: string;
  startTime: Date;
  lastActivity: Date;
}

// 接続状態を表す型
export type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';

// Contextが提供する値のインターフェース
export interface WebSocketContextState {
  status: WebSocketStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  editingUsers: EditingUser[];
  currentUserId?: string;
  onDataUpdate?: (reportId: number, updatedBy: string, newVersion: number) => void;
}

// Contextの作成
import { createContext } from 'react';

// デフォルト値を設定してデバッグを支援
const defaultContextValue: WebSocketContextState = {
  status: 'closed',
  lastMessage: null,
  sendMessage: () => console.log('[WebSocketContext] sendMessage called but not connected'),
  editingUsers: [],
  currentUserId: undefined,
  onDataUpdate: undefined,
};

export const WebSocketContext = createContext<WebSocketContextState | null>(null);