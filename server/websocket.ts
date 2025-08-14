import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { sessionManager } from './session-manager';
import session from 'express-session';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@shared/logger';
import { connectionManager } from './editing-manager';

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