import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { sessionManager } from './session-manager';
import session from 'express-session';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@shared/logger';

const logger = createLogger('WebSocket');

// 編集セッション情報の型定義
interface EditSession {
  reportId: number;
  userId: string;
  username: string;
  startTime: Date;
  lastActivity: Date;
}

// セッションストア型定義
interface SessionData {
  passport?: {
    user?: number;
  };
  [key: string]: any;
}

// WebSocket認証情報型定義
interface WebSocketUser {
  userId: string;
  username: string;
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
    
    console.log(`[ConnectionManager] Broadcasting editing users for report ${reportId}:`, {
      sessionCount: sessions.length,
      users: activeUsers.map(u => ({ userId: u.userId, username: u.username, userIdType: typeof u.userId }))
    });
    
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
    
    store.get(sessionId, async (err: any, sessionData?: SessionData | null) => {
      logger.debug('Session lookup result', { 
        sessionId,
        error: err?.message, 
        hasSessionData: !!sessionData,
        sessionKeys: sessionData ? Object.keys(sessionData) : [],
        passportData: sessionData?.passport 
      });
      
      if (err) {
        logger.error('Session store error', err, { sessionId });
        resolve(null);
        return;
      }
      
      if (!sessionData) {
        logger.warn('No session data found', { sessionId });
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
        const userIdString = user.id.toString();
        console.log('WebSocket: Converting user ID to string:', { originalId: user.id, stringId: userIdString, type: typeof userIdString });
        resolve({
          userId: userIdString,
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
    verifyClient: async (info: { req: any; origin?: string; secure?: boolean }) => {
      try {
        console.log('[WebSocket] Verifying client connection...');
        console.log('[WebSocket] Request headers:', {
          host: info.req.headers.host,
          origin: info.req.headers.origin,
          cookie: info.req.headers.cookie ? 'present' : 'missing'
        });
        
        // Cookieからセッション情報を取得して認証確認
        const cookies = parse(info.req.headers.cookie || '');
        console.log('[WebSocket] Parsed cookies:', Object.keys(cookies));
        const sessionId = cookies['tasktrackr_session'];
        
        if (!sessionId) {
          console.log('[WebSocket] No session ID found in cookies');
          console.log('[WebSocket] Available cookie keys:', Object.keys(cookies));
          return false;
        }
        
        // セッション検証 - セッションIDの解析を改善
        console.log('[WebSocket] Raw session ID:', sessionId);
        let cleanSessionId = sessionId;
        
        // Signedクッキーの形式 (s:sessionId.signature) の場合
        if (sessionId.startsWith('s:')) {
          cleanSessionId = sessionId.substring(2).split('.')[0];
        }
        
        console.log('[WebSocket] Clean session ID:', cleanSessionId);
        const user = await getSessionUser(cleanSessionId);
        
        if (!user) {
          console.log('[WebSocket] Session validation failed');
          return false;
        }
        
        console.log(`[WebSocket] Session validated for user ${user.username}`);
        return true;
      } catch (error) {
        console.error('[WebSocket] Authentication error:', error);
        return false;
      }
    }
  });
  
  wss.on('connection', async (ws, req) => {
    try {
      let user: { userId: string; username: string } | null = null;
      
      // セッションからユーザー情報を取得（厳密認証）
      console.log('[WebSocket] Attempting session authentication...');
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies['tasktrackr_session'];
      
      if (sessionId) {
        // セッション検証してユーザー情報を取得
        console.log('[WebSocket] Raw session ID:', sessionId);
        let cleanSessionId = sessionId;
        
        // Signedクッキーの形式 (s:sessionId.signature) の場合
        if (sessionId.startsWith('s:')) {
          cleanSessionId = sessionId.substring(2).split('.')[0];
        }
        
        console.log('[WebSocket] Clean session ID:', cleanSessionId);
        user = await getSessionUser(cleanSessionId);
        
        if (user) {
          console.log('[WebSocket] Session authentication successful for real user:', user);
        } else {
          console.log('[WebSocket] Session authentication failed - no valid user found');
        }
      } else {
        console.log('[WebSocket] No session ID found in cookies - authentication required');
      }
      
      // セッション認証失敗時は接続拒否
      if (!user) {
        console.log('[WebSocket] Authentication failed - closing connection');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      console.log(`WebSocket connection established for user: ${user.username} (ID: ${user.userId})`);
      connectionManager.addConnection(ws, user.userId, user.username);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'ping':
              console.log(`WebSocket ping from user: ${user.username} (ID: ${user.userId}, type: ${typeof user.userId})`);
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