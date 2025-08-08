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

// Rate Limit管理クラス
class RateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 5 * 60 * 1000; // 5分間

  isAllowed(clientIp: string): boolean {
    const now = Date.now();
    const clientAttempts = this.attempts.get(clientIp) || [];
    
    // 5分以内の試行回数をフィルタ
    const recentAttempts = clientAttempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      logger.warn('Rate limit exceeded for client', { clientIp, attempts: recentAttempts.length });
      return false;
    }
    
    // 新しい試行を記録
    recentAttempts.push(now);
    this.attempts.set(clientIp, recentAttempts);
    
    return true;
  }

  // 定期的なクリーンアップ
  cleanup() {
    const now = Date.now();
    this.attempts.forEach((times, ip) => {
      const recent = times.filter(time => now - time < this.windowMs);
      if (recent.length === 0) {
        this.attempts.delete(ip);
      } else {
        this.attempts.set(ip, recent);
      }
    });
  }
}

const rateLimiter = new RateLimiter();

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
    logger.debug('Connection added to manager', { username, userId });
  }
  
  removeConnection(ws: WebSocket) {
    const connection = this.connections.get(ws);
    if (connection) {
      logger.debug('Removing connection from manager', { username: connection.username, userId: connection.userId });
      
      // ユーザーの編集セッションをすべて終了
      this.editSessions.forEach((sessions, reportId) => {
        const originalLength = sessions.length;
        const filteredSessions = sessions.filter(session => session.userId !== connection.userId);
        if (filteredSessions.length !== originalLength) {
          logger.debug('Removed editing session during connection cleanup', { username: connection.username, reportId });
          logger.debug('Session count after cleanup', { before: originalLength, after: filteredSessions.length, reportId });
          this.editSessions.set(reportId, filteredSessions);
          this.broadcastEditingUsers(reportId);
        }
      });
      
      this.connections.delete(ws);
      logger.debug('Connection fully removed', { username: connection.username });
    } else {
      logger.debug('No connection found to remove');
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
    
    console.log(`🔥 [ConnectionManager] stopEditing called for user ${userId} on report ${reportId}`);
    console.log(`🔥 [ConnectionManager] Sessions before: ${sessions.length}, after: ${filteredSessions.length}`);
    
    if (filteredSessions.length !== sessions.length) {
      this.editSessions.set(reportId, filteredSessions);
      this.broadcastEditingUsers(reportId);
      console.log(`🔥 [ConnectionManager] Successfully removed editing session for user ${userId} from report ${reportId}`);
    } else {
      console.log(`🔥 [ConnectionManager] No editing session found to remove for user ${userId} on report ${reportId}`);
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

  // データ更新の通知（楽観的ロック用）
  broadcastDataUpdate(reportId: number, updatedBy: string, newVersion: number) {
    const message = JSON.stringify({
      type: 'data_updated',
      reportId,
      updatedBy,
      newVersion,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Broadcasting data update', { reportId, updatedBy, newVersion });
    
    // 該当レポートを編集中のユーザーに通知
    this.connections.forEach((connection, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const sessions = this.editSessions.get(reportId) || [];
        const isEditing = sessions.some(session => session.userId === connection.userId);
        
        if (isEditing && connection.username !== updatedBy) {
          ws.send(message);
          logger.debug('Sent data update notification', { 
            to: connection.username, 
            reportId, 
            updatedBy 
          });
        }
      }
    });
  }
  
  // 非アクティブなセッションをクリーンアップ（3分間非アクティブ）
  cleanupInactiveSessions() {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    this.editSessions.forEach((sessions, reportId) => {
      const activeSessions = sessions.filter(s => s.lastActivity > threeMinutesAgo);
      
      if (activeSessions.length !== sessions.length) {
        console.log(`🔥 [cleanupInactiveSessions] Cleaned up inactive sessions for report ${reportId}: ${sessions.length} -> ${activeSessions.length}`);
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
  rateLimiter.cleanup(); // Rate Limiterのクリーンアップも追加
}, 30 * 1000); // 30秒ごとに変更して即座にクリーンアップ

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
        // Rate Limit チェック - IPアドレスを取得
        const clientIp = info.req.headers['x-forwarded-for']?.split(',')[0] || 
                        info.req.connection?.remoteAddress || 
                        info.req.socket?.remoteAddress || 
                        'unknown';
        
        if (!rateLimiter.isAllowed(clientIp)) {
          logger.debug('WebSocket connection rejected due to rate limit', { clientIp });
          return false;
        }

        logger.debug('WebSocket client verification starting', {
          clientIp,
          origin: info.req.headers.origin,
          hasCookie: !!info.req.headers.cookie
        });
        
        // Cookieからセッション情報を取得して認証確認
        const cookies = parse(info.req.headers.cookie || '');
        const sessionId = cookies['tasktrackr_session'];
        
        if (!sessionId) {
          logger.debug('No session ID found in cookies', { 
            clientIp,
            availableCookies: Object.keys(cookies) 
          });
          return false;
        }
        
        // セッション検証 - セッションIDの解析を改善
        let cleanSessionId = sessionId;
        if (sessionId.startsWith('s:')) {
          cleanSessionId = sessionId.substring(2).split('.')[0];
        }
        
        const user = await getSessionUser(cleanSessionId);
        
        if (!user) {
          logger.debug('Session validation failed', { clientIp, sessionId: cleanSessionId });
          return false;
        }
        
        logger.info('WebSocket connection authorized', { 
          clientIp, 
          username: user.username,
          userId: user.userId 
        });
        return true;
      } catch (error) {
        logger.error('WebSocket authentication error', error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    }
  });
  
  wss.on('connection', async (ws, req) => {
    try {
      let user: { userId: string; username: string } | null = null;
      
      // セッションからユーザー情報を取得（厳密認証）
      logger.debug('Attempting session authentication');
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies['tasktrackr_session'];
      
      if (sessionId) {
        // セッション検証してユーザー情報を取得
        let cleanSessionId = sessionId;
        if (sessionId.startsWith('s:')) {
          cleanSessionId = sessionId.substring(2).split('.')[0];
        }
        
        user = await getSessionUser(cleanSessionId);
        
        if (user) {
          logger.debug('Session authentication successful', { 
            username: user.username, 
            userId: user.userId 
          });
        } else {
          logger.debug('Session authentication failed - no valid user found');
        }
      } else {
        logger.debug('No session ID found in cookies - authentication required');
      }
      
      // セッション認証失敗時は接続拒否
      if (!user) {
        logger.debug('Authentication failed - closing connection');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      logger.info('WebSocket connection established', { 
        username: user.username, 
        userId: user.userId 
      });
      connectionManager.addConnection(ws, user.userId, user.username);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'ping':
              logger.debug('WebSocket ping received', { 
                username: user.username, 
                userId: user.userId 
              });
              ws.send(JSON.stringify({ type: 'pong', userId: user.userId, username: user.username }));
              break;
              
            case 'start_editing':
              logger.info('User started editing report', { 
                username: user.username, 
                reportId: message.reportId 
              });
              connectionManager.startEditing(user.userId, user.username, message.reportId);
              break;
              
            case 'stop_editing':
              logger.info('User stopped editing report', { 
                username: user.username, 
                userId: user.userId, 
                reportId: message.reportId 
              });
              connectionManager.stopEditing(user.userId, message.reportId);
              break;
              
            case 'activity':
              logger.debug('Activity update received', { 
                username: user.username, 
                reportId: message.reportId 
              });
              connectionManager.updateActivity(user.userId, message.reportId);
              break;
              
            default:
              logger.warn('Unknown message type received', { 
                messageType: message.type,
                username: user.username 
              });
          }
        } catch (error) {
          logger.error('Error processing WebSocket message', error instanceof Error ? error : new Error(String(error)), {
            username: user.username
          });
        }
      });
      
      ws.on('close', () => {
        connectionManager.removeConnection(ws);
      });
      
      ws.on('error', (error) => {
        logger.error('WebSocket connection error', error instanceof Error ? error : new Error(String(error)), {
          username: user?.username
        });
        connectionManager.removeConnection(ws);
      });
      
    } catch (error) {
      logger.error('WebSocket connection setup error', error instanceof Error ? error : new Error(String(error)));
      ws.close(1011, 'Authentication failed');
    }
  });
  
  logger.info('WebSocket server setup complete');
  return wss;
}

// WebSocket通知機能を外部から利用可能にする
export function notifyDataUpdate(reportId: number, updatedBy: string, newVersion: number) {
  connectionManager.broadcastDataUpdate(reportId, updatedBy, newVersion);
}

// 編集中ユーザー取得機能を外部から利用可能にする（排他制御用）
export function getEditingUsers(reportId: number): EditSession[] {
  const sessions = connectionManager['editSessions'].get(reportId) || [];
  
  // 現在時刻
  const now = new Date();
  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
  
  const activeSessions = sessions.filter(session => {
    // 3分以上非アクティブなセッションは除外
    const isActive = session.lastActivity > threeMinutesAgo;
    if (!isActive) {
      console.log(`🔥 [getEditingUsers] Excluding inactive session: user ${session.username} (${session.userId}), last activity: ${session.lastActivity}`);
    }
    return isActive;
  });
  
  // 非アクティブセッションがあった場合は即座にクリーンアップ
  if (activeSessions.length !== sessions.length) {
    console.log(`🔥 [getEditingUsers] Cleaning up inactive sessions for report ${reportId}: ${sessions.length} -> ${activeSessions.length}`);
    connectionManager['editSessions'].set(reportId, activeSessions);
    connectionManager['broadcastEditingUsers'](reportId);
  }
  
  console.log(`🔥 [getEditingUsers] Report ${reportId} active editing users:`, activeSessions.map(s => `${s.username} (${s.userId})`));
  return activeSessions;
}