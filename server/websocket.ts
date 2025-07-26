import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { sessionStore } from './auth';

// 編集セッション情報の型定義
interface EditSession {
  reportId: number;
  userId: string;
  username: string;
  startTime: Date;
  lastActivity: Date;
}

// 接続管理
class ConnectionManager {
  private connections = new Map<WebSocket, { userId: string; username: string }>();
  private editSessions = new Map<number, EditSession[]>(); // reportId -> EditSession[]
  
  addConnection(ws: WebSocket, userId: string, username: string) {
    this.connections.set(ws, { userId, username });
    console.log(`WebSocket connection established for user: ${username}`);
  }
  
  removeConnection(ws: WebSocket) {
    const connection = this.connections.get(ws);
    if (connection) {
      // ユーザーの編集セッションをすべて終了
      this.editSessions.forEach((sessions, reportId) => {
        const filteredSessions = sessions.filter(session => session.userId !== connection.userId);
        if (filteredSessions.length !== sessions.length) {
          this.editSessions.set(reportId, filteredSessions);
          this.broadcastEditingUsers(reportId);
        }
      });
      
      this.connections.delete(ws);
      console.log(`WebSocket connection closed for user: ${connection.username}`);
    }
  }
  
  startEditing(userId: string, username: string, reportId: number) {
    const now = new Date();
    const sessions = this.editSessions.get(reportId) || [];
    
    // 既存セッションを更新または新規作成
    const existingIndex = sessions.findIndex(s => s.userId === userId);
    const newSession: EditSession = {
      reportId,
      userId,
      username,
      startTime: existingIndex >= 0 ? sessions[existingIndex].startTime : now,
      lastActivity: now
    };
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = newSession;
    } else {
      sessions.push(newSession);
    }
    
    this.editSessions.set(reportId, sessions);
    this.broadcastEditingUsers(reportId);
  }
  
  stopEditing(userId: string, reportId: number) {
    const sessions = this.editSessions.get(reportId) || [];
    const filteredSessions = sessions.filter(s => s.userId !== userId);
    
    if (filteredSessions.length !== sessions.length) {
      this.editSessions.set(reportId, filteredSessions);
      this.broadcastEditingUsers(reportId);
    }
  }
  
  updateActivity(userId: string, reportId: number) {
    const sessions = this.editSessions.get(reportId) || [];
    const session = sessions.find(s => s.userId === userId);
    
    if (session) {
      session.lastActivity = new Date();
      this.broadcastEditingUsers(reportId);
    }
  }
  
  private broadcastEditingUsers(reportId: number) {
    const sessions = this.editSessions.get(reportId) || [];
    const activeUsers = sessions.map(s => ({
      userId: s.userId,
      username: s.username,
      startTime: s.startTime,
      lastActivity: s.lastActivity
    }));
    
    const message = JSON.stringify({
      type: 'editing_users',
      reportId,
      users: activeUsers
    });
    
    // すべての接続に編集状況をブロードキャスト
    this.connections.forEach((_, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
  
  // 非アクティブなセッションをクリーンアップ（5分間非アクティブ）
  cleanupInactiveSessions() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    this.editSessions.forEach((sessions, reportId) => {
      const activeSessions = sessions.filter(s => s.lastActivity > fiveMinutesAgo);
      
      if (activeSessions.length !== sessions.length) {
        this.editSessions.set(reportId, activeSessions);
        this.broadcastEditingUsers(reportId);
      }
    });
  }
}

const connectionManager = new ConnectionManager();

// 定期的なクリーンアップ
setInterval(() => {
  connectionManager.cleanupInactiveSessions();
}, 60 * 1000); // 1分ごと

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    verifyClient: async (info) => {
      try {
        // Cookieからセッション情報を取得して認証確認
        const cookies = parse(info.req.headers.cookie || '');
        const sessionId = cookies['connect.sid'];
        
        if (!sessionId) {
          return false;
        }
        
        // セッション検証（簡易版）
        return true; // 実際の実装では適切なセッション検証を行う
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        return false;
      }
    }
  });
  
  wss.on('connection', async (ws, req) => {
    try {
      // セッションからユーザー情報を取得
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies['connect.sid'];
      
      // TODO: 実際のセッション検証でユーザー情報を取得
      // 現在は仮のユーザー情報を使用
      const userId = 'user-' + Math.random().toString(36).substr(2, 9);
      const username = 'テストユーザー';
      
      connectionManager.addConnection(ws, userId, username);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'start_editing':
              connectionManager.startEditing(userId, username, message.reportId);
              break;
              
            case 'stop_editing':
              connectionManager.stopEditing(userId, message.reportId);
              break;
              
            case 'activity':
              connectionManager.updateActivity(userId, message.reportId);
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        connectionManager.removeConnection(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectionManager.removeConnection(ws);
      });
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Authentication failed');
    }
  });
  
  console.log('WebSocket server setup complete');
  return wss;
}