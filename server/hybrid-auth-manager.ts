import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// JWT用の型定義
interface JWTPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

interface AuthResult {
  valid: boolean;
  user?: {
    id: number;
    username: string;
    isAdmin: boolean;
  };
  method: 'session' | 'jwt' | 'none';
  error?: string;
}

/**
 * セッション + JWT のハイブリッド認証管理システム
 * 段階的な移行とスケーラビリティを考慮した実装
 */
export class HybridAuthManager {
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'fallback-secret';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '4h'; // セッション設定と統一
    
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ JWT_SECRET が設定されていません。セキュリティ上、本番環境では専用のシークレットを設定してください。');
    }
  }

  /**
   * JWTトークンを生成
   */
  generateJWT(user: { id: number; username: string; isAdmin: boolean }): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'tasktrackr',
      audience: 'tasktrackr-client'
    });
  }

  /**
   * JWTトークンを検証
   */
  verifyJWT(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: 'tasktrackr',
        audience: 'tasktrackr-client'
      }) as JWTPayload;

      return { valid: true, payload };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token' };
      }
      return { valid: false, error: 'Token verification failed' };
    }
  }

  /**
   * Authorization ヘッダーからJWTトークンを抽出
   */
  private extractJWTFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * ハイブリッド認証チェック
   * 1. JWT優先チェック（高速）
   * 2. セッションフォールバック
   */
  async authenticateRequest(req: Request): Promise<AuthResult> {
    // 1. JWT認証を試行
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = this.extractJWTFromHeader(authHeader);
      if (token) {
        const jwtResult = this.verifyJWT(token);
        if (jwtResult.valid && jwtResult.payload) {
          return {
            valid: true,
            user: {
              id: jwtResult.payload.userId,
              username: jwtResult.payload.username,
              isAdmin: jwtResult.payload.isAdmin
            },
            method: 'jwt'
          };
        }
        // JWT検証失敗（期限切れなど）
        return {
          valid: false,
          method: 'jwt',
          error: jwtResult.error
        };
      }
    }

    // 2. セッション認証にフォールバック
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      const user = req.user as { id: number; username: string; isAdmin: boolean };
      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin
        },
        method: 'session'
      };
    }

    // 認証失敗
    return {
      valid: false,
      method: 'none',
      error: 'No valid authentication found'
    };
  }

  /**
   * ハイブリッド認証ミドルウェア
   * 既存のisAuthenticatedミドルウェアの代替
   */
  createAuthMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authResult = await this.authenticateRequest(req);
        
        if (authResult.valid && authResult.user) {
          // 認証成功：req.userにユーザー情報を設定
          req.user = authResult.user;
          
          // デバッグログ（開発環境のみ）
          if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ Hybrid Auth OK: ${authResult.user.username} via ${authResult.method} - ${req.method} ${req.path}`);
          }
          
          return next();
        }

        // 認証失敗：統一エラーハンドラー用のエラーオブジェクトを作成
        const authError: any = new Error(
          authResult.error === 'Token expired' 
            ? 'セッションまたはトークンが期限切れです。再度ログインしてください。'
            : '認証が必要です。'
        );
        authError.type = authResult.error === 'Token expired' ? 'SESSION_EXPIRED' : 'AUTH_FAILED';
        authError.status = 401;
        
        next(authError);
      } catch (error) {
        // 予期しないエラー
        const internalError: any = new Error('認証処理中にエラーが発生しました。');
        internalError.type = 'INTERNAL_ERROR';
        internalError.status = 500;
        next(internalError);
      }
    };
  }

  /**
   * JWT付きレスポンス生成ヘルパー
   * ログイン成功時にJWTトークンを含むレスポンスを生成
   */
  createAuthResponse(user: { id: number; username: string; isAdmin: boolean }) {
    const token = this.generateJWT(user);
    
    return {
      message: 'ログイン成功',
      user,
      token, // フロントエンドでAuthorizationヘッダーに設定可能
      authMethod: 'hybrid',
      expiresIn: this.jwtExpiresIn
    };
  }

  /**
   * 認証統計情報
   */
  getAuthStats(): { jwtEnabled: boolean; jwtSecret: string; expiresIn: string } {
    return {
      jwtEnabled: true,
      jwtSecret: this.jwtSecret.length > 0 ? 'configured' : 'missing',
      expiresIn: this.jwtExpiresIn
    };
  }
}

// シングルトンインスタンス
export const hybridAuthManager = new HybridAuthManager();