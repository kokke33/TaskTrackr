import { WebSocket } from 'ws';
import { createLogger } from '@shared/logger';

const logger = createLogger('EditingManager');

// 編集セッション情報の型定義
export interface EditSession {
  reportId: number;
  userId: string;
  username: string;
  startTime: Date;
  lastActivity: Date;
}

// 接続管理クラス
export class ConnectionManager {
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

  // 編集中ユーザー取得（排他制御用）
  getEditingUsers(reportId: number): EditSession[] {
    const sessions = this.editSessions.get(reportId) || [];
    
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
      this.editSessions.set(reportId, activeSessions);
      this.broadcastEditingUsers(reportId);
    }
    
    console.log(`🔥 [getEditingUsers] Report ${reportId} active editing users:`, activeSessions.map(s => `${s.username} (${s.userId})`));
    return activeSessions;
  }
}

// シングルトンインスタンス
export const connectionManager = new ConnectionManager();

// 編集中ユーザー取得機能を外部から利用可能にする（排他制御用）
export function getEditingUsers(reportId: number): EditSession[] {
  return connectionManager.getEditingUsers(reportId);
}

// WebSocket通知機能を外部から利用可能にする
export function notifyDataUpdate(reportId: number, updatedBy: string, newVersion: number) {
  connectionManager.broadcastDataUpdate(reportId, updatedBy, newVersion);
}