import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { sessionManager } from './session-manager';
import session from 'express-session';

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

// セッション検証のヘルパー関数
async function getSessionUser(sessionId: string): Promise<{ userId: string; username: string } | null> {
  return new Promise((resolve) => {
    const store = sessionManager.getStore();
    
    if (!store.get) {
      console.log('WebSocket: Session store does not support get method');
      resolve(null);
      return;
    }
    
    store.get(sessionId, async (err: any, sessionData: any) => {
      console.log('WebSocket: Session lookup result:', { 
        err: err?.message, 
        hasSessionData: !!sessionData,
        sessionKeys: sessionData ? Object.keys(sessionData) : [],
        passportData: sessionData?.passport 
      });
      
      if (err) {
        console.error('WebSocket: Session store error:', err);
        resolve(null);
        return;
      }
      
      if (!sessionData) {
        console.log('WebSocket: No session data found for session ID:', sessionId);
        resolve(null);
        return;
      }
      
      if (!sessionData.passport || !sessionData.passport.user) {
        console.log('WebSocket: No passport user data in session');
        resolve(null);
        return;
      }
      
      const userIdFromSession = sessionData.passport.user;
      console.log('WebSocket: Found user ID in session:', userIdFromSession);
      
      // PassportはuserIdのみを保存しているため、データベースから完全なユーザー情報を取得
      try {
        const { db } = require('./db');
        const { users } = require('@shared/schema');
        const { eq } = require('drizzle-orm');
        
        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
          })
          .from(users)
          .where(eq(users.id, userIdFromSession));
        
        if (!user) {
          console.log('WebSocket: User not found in database for ID:', userIdFromSession);
          resolve(null);
          return;
        }
        
        console.log('WebSocket: Successfully retrieved user from database:', { id: user.id, username: user.username });
        resolve({
          userId: user.id.toString(),
          username: user.username
        });
        
      } catch (dbError) {
        console.error('WebSocket: Database error retrieving user:', dbError);
        resolve(null);
      }
    });
  });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    verifyClient: async (info: any) => {
      try {
        // Cookieからセッション情報を取得して認証確認
        const cookies = parse(info.req.headers.cookie || '');
        const sessionId = cookies['tasktrackr_session'];
        
        if (!sessionId) {
          console.log('WebSocket: No session ID found in cookies');
          return false;
        }
        
        // セッション検証 - セッションIDの解析を改善
        console.log('WebSocket: Raw session ID:', sessionId);
        let cleanSessionId = sessionId;
        
        // Signedクッキーの形式 (s:sessionId.signature) の場合
        if (sessionId.startsWith('s:')) {
          cleanSessionId = sessionId.substring(2).split('.')[0];
        }
        
        console.log('WebSocket: Clean session ID:', cleanSessionId);
        const user = await getSessionUser(cleanSessionId);
        
        if (!user) {
          console.log('WebSocket: Session validation failed');
          return false;
        }
        
        console.log(`WebSocket: Session validated for user ${user.username}`);
        return true;
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
      const sessionId = cookies['tasktrackr_session'];
      
      if (!sessionId) {
        console.log('WebSocket connection rejected: No session');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // セッション検証してユーザー情報を取得 - セッションIDの解析を改善
      console.log('WebSocket connection: Raw session ID:', sessionId);
      let cleanSessionId = sessionId;
      
      // Signedクッキーの形式 (s:sessionId.signature) の場合
      if (sessionId.startsWith('s:')) {
        cleanSessionId = sessionId.substring(2).split('.')[0];
      }
      
      console.log('WebSocket connection: Clean session ID:', cleanSessionId);
      const user = await getSessionUser(cleanSessionId);
      
      if (!user) {
        console.log('WebSocket connection rejected: Invalid session');
        ws.close(1008, 'Authentication failed');
        return;
      }
      
      console.log(`WebSocket connection established for user: ${user.username} (ID: ${user.userId})`);
      connectionManager.addConnection(ws, user.userId, user.username);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'ping':
              console.log(`WebSocket ping from user: ${user.username}`);
              ws.send(JSON.stringify({ type: 'pong', userId: user.userId, username: user.username }));
              break;
              
            case 'start_editing':
              console.log(`User ${user.username} started editing report ${message.reportId}`);
              connectionManager.startEditing(user.userId, user.username, message.reportId);
              break;
              
            case 'stop_editing':
              console.log(`User ${user.username} stopped editing report ${message.reportId}`);
              connectionManager.stopEditing(user.userId, message.reportId);
              break;
              
            case 'activity':
              console.log(`Activity update from user ${user.username} for report ${message.reportId}`);
              connectionManager.updateActivity(user.userId, message.reportId);
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