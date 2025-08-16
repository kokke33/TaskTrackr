import { compare, hash } from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hybridAuthManager } from "./hybrid-auth-manager";
import { createLogger } from "@shared/logger";
import { debugLogger, DebugLogCategory } from "./debug-logger";
import { measureAsync } from "@shared/performance-monitor";

const logger = createLogger('Auth');

// ユーザー認証の設定
passport.use(
  new LocalStrategy(async (username, password, done) => {
    debugLogger.info(DebugLogCategory.AUTH, 'local_strategy', 'ログイン認証開始', { username });
    
    try {
      // 認証に必要な全ての情報を1回のクエリで取得（パフォーマンス最適化）
      const [userAuth] = await measureAsync('database', 'getUserForAuth', async () => {
        return await db
          .select({
            id: users.id,
            username: users.username,
            password: users.password,
            isAdmin: users.isAdmin,
          })
          .from(users)
          .where(eq(users.username, username));
      }, { username });

      if (!userAuth) {
        debugLogger.authFailure('local_strategy', 'ユーザーが見つかりません', { username });
        return done(null, false, { message: "ユーザーが見つかりません" });
      }

      const isValid = await measureAsync('api', 'bcrypt-compare', async () => {
        return await compare(password, userAuth.password);
      }, { username, userId: userAuth.id });
      
      if (!isValid) {
        debugLogger.authFailure('local_strategy', 'パスワードが正しくありません', { username, userId: userAuth.id });
        return done(null, false, { message: "パスワードが正しくありません" });
      }

      // パスワードを除いた認証ユーザー情報を作成（DB再アクセス不要）
      const completeUser = {
        id: userAuth.id,
        username: userAuth.username,
        isAdmin: userAuth.isAdmin,
      };

      debugLogger.authSuccess('local_strategy', String(completeUser.id), completeUser.username, {
        isAdmin: completeUser.isAdmin
      });

      // 本番環境では機密情報をログに出力しない
      if (process.env.NODE_ENV === 'production') {
        logger.info('認証成功');
      } else {
        logger.info('認証成功', {
          userId: completeUser.id,
          username: completeUser.username,
          isAdmin: completeUser.isAdmin
        });
      }

      return done(null, completeUser);
    } catch (error) {
      debugLogger.error(DebugLogCategory.AUTH, 'local_strategy', '認証中にエラーが発生', error instanceof Error ? error : new Error(String(error)), { username });
      logger.error('認証エラー', error instanceof Error ? error : new Error(String(error)));
      return done(error);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// セッション復元の排他制御用Map（タイムアウト機能付き）
const activeDeserializations = new Map<number, {
  promise: Promise<any>;
  timestamp: number;
  timeout?: NodeJS.Timeout;
}>();

// 定期的にタイムアウトしたセッション復元を清掃
const DESERIALIZATION_TIMEOUT = 30000; // 30秒
const SESSION_CLEANUP_INTERVAL = 60000; // 1分
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of Array.from(activeDeserializations.entries())) {
    if (now - entry.timestamp > DESERIALIZATION_TIMEOUT) {
      logger.debug('セッション復元タイムアウトクリーンアップ', { userId });
      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }
      activeDeserializations.delete(userId);
    }
  }
}, SESSION_CLEANUP_INTERVAL);

passport.deserializeUser(async (id: number, done) => {
  try {
    // 同じユーザーIDで並行実行されている場合は結果を待つ
    if (activeDeserializations.has(id)) {
      logger.debug('セッション復元待機中', { userId: id });
      const entry = activeDeserializations.get(id)!;
      try {
        const result = await entry.promise;
        return done(null, result);
      } catch (error) {
        logger.error('並行セッション復元エラー', error instanceof Error ? error : new Error(String(error)), { userId: id });
        // エラー時は新しい復元処理を開始
        activeDeserializations.delete(id);
      }
    }

    // 新しいセッション復元処理を開始
    const deserializationPromise = (async () => {
      let retries = 3; // 2 → 3 (リトライ回数増加)
      let user = null;
      
      while (retries > 0) {
        try {
          const [fetchedUser] = await db
            .select({
              id: users.id,
              username: users.username,
              isAdmin: users.isAdmin,
            })
            .from(users)
            .where(eq(users.id, id));
          
          user = fetchedUser;
          break;
        } catch (dbError: any) {
          const isConnectionError = 
            dbError.message?.includes('Connection terminated unexpectedly') ||
            dbError.message?.includes('ECONNRESET') ||
            dbError.message?.includes('ETIMEDOUT') ||
            dbError.message?.includes('terminating connection') ||
            dbError.code === 'ECONNRESET';
          
          if (isConnectionError && retries > 1) {
            retries--;
            logger.warn('セッション復元でDB接続エラー', { retriesLeft: retries, userId: id, errorMessage: dbError.message });
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          // リトライしても失敗した場合、またはDB接続エラー以外の場合
          logger.error('セッション復元失敗', dbError instanceof Error ? dbError : new Error(String(dbError)), { userId: id });
          return false; // 認証失敗
        }
      }
      
      if (!user) {
        logger.warn('ユーザーが見つかりません（削除済みまたは無効なセッション）', { userId: id });
        return false; // 認証失敗
      }
      
      // 本番環境では機密情報を含むデバッグログを削減し、INFOレベルに格下げ
      if (process.env.NODE_ENV !== 'production') {
        logger.info('セッション復元成功', { username: user.username, userId: user.id });
      } else {
        logger.info('セッション復元成功');
      }
      
      return user;
    })();

    // 排他制御Mapに追加（タイムアウト付き）
    const entry = {
      promise: deserializationPromise,
      timestamp: Date.now(),
      timeout: setTimeout(() => {
        logger.warn('セッション復元タイムアウト', { userId: id });
        activeDeserializations.delete(id);
      }, DESERIALIZATION_TIMEOUT)
    };
    activeDeserializations.set(id, entry);
    
    const result = await deserializationPromise;
    
    // 完了後にMapから削除とタイムアウトクリア
    const entryToClean = activeDeserializations.get(id);
    if (entryToClean?.timeout) {
      clearTimeout(entryToClean.timeout);
    }
    activeDeserializations.delete(id);
    
    done(null, result);
  } catch (error) {
    logger.error('セッション復元で予期しないエラー', error instanceof Error ? error : new Error(String(error)), { userId: id });
    // エラー時もMapから削除とタイムアウトクリア
    const entryToClean = activeDeserializations.get(id);
    if (entryToClean?.timeout) {
      clearTimeout(entryToClean.timeout);
    }
    activeDeserializations.delete(id);
    done(null, false); // エラー時はログアウト処理
  }
});

// 初期ユーザーの作成
export async function createInitialUsers() {
  // リトライ機能付きでユーザー作成を実行
  const createUsersWithRetry = async () => {
    const initialUsers = [
      { username: "ss7-1", password: "ss7-1weeklyreport", isAdmin: false },
      { username: "admin", password: "adminpassword", isAdmin: true },
    ];

    for (const user of initialUsers) {
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, user.username));

      if (!existingUser) {
        const hashedPassword = await hash(user.password, 10);
        await db.insert(users).values({
          username: user.username,
          password: hashedPassword,
          isAdmin: user.isAdmin,
        });
        logger.info('Created initial user', { username: user.username, isAdmin: user.isAdmin });
      }
    }
  };

  try {
    // 最大3回リトライ
    let retries = 3;
    while (retries > 0) {
      try {
        await createUsersWithRetry();
        logger.info('初期ユーザーの作成が完了しました');
        break;
      } catch (error: any) {
        const isConnectionError = 
          error.message?.includes('Connection terminated unexpectedly') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT';
        
        if (isConnectionError && retries > 1) {
          retries--;
          logger.warn('初期ユーザー作成でデータベース接続エラー', { retriesLeft: retries });
          console.log('5秒後にリトライします...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        throw error;
      }
    }
  } catch (error) {
    logger.error("Error creating initial users", error instanceof Error ? error : new Error(String(error)));
  }
}

// 統一エラーハンドラー対応の認証ミドルウェア
export function isAuthenticated(req: any, res: any, next: any) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (req.isAuthenticated()) {
    // 認証成功時は本番環境ではログを簡素化
    if (!isProduction) {
      logger.info('Auth OK', { username: req.user?.username, method: req.method, path: req.path });
    }
    return next();
  }
  
  // 認証失敗時の詳細ログ（離席後のトラブルシューティング用）
  const sessionInfo = {
    method: req.method,
    path: req.path,
    sessionID: req.sessionID?.substring(0, 8) + '...',
    hasSession: !!req.session,
    hasPassport: !!req.session?.passport,
    userId: req.session?.passport?.user,
    timestamp: new Date().toISOString(),
    // より詳細なセッション情報
    sessionData: req.session,
    cookieNames: req.headers.cookie ? req.headers.cookie.split(';').map((c: string) => c.trim().split('=')[0]) : [],
    userAgentShort: req.headers['user-agent']?.substring(0, 50) + '...'
  };
  
  logger.warn('Auth Failed', { method: sessionInfo.method, path: sessionInfo.path });
  
  // 開発環境でのみ詳細ログを出力（機密情報を含む）
  if (!isProduction) {
    console.log(`   Session Info:`, {
      method: sessionInfo.method,
      path: sessionInfo.path,
      sessionID: sessionInfo.sessionID,
      hasSession: sessionInfo.hasSession,
      hasPassport: sessionInfo.hasPassport,
      timestamp: sessionInfo.timestamp,
      userAgentShort: sessionInfo.userAgentShort
      // sessionData と cookieNames は機密情報のため出力を制限
    });
    console.log(`   Cookie Present:`, !!req.headers.cookie);
    // Raw Cookie には機密情報が含まれるため出力しない
  }
  
  // セッション期限切れかどうかを判定
  const isSessionExpired = !req.session?.passport?.user;
  if (isSessionExpired) {
    logger.info('セッション期限切れの可能性 - 再ログインが必要です');
  }
  
  // 統一エラーハンドラー用のエラーオブジェクトを作成
  const authError: any = new Error(isSessionExpired ? 
    "セッションが期限切れです。再度ログインしてください。" : 
    "認証が必要です。");
  authError.type = isSessionExpired ? 'SESSION_EXPIRED' : 'AUTH_FAILED';
  authError.status = 401;
  
  next(authError);
}

// 統一エラーハンドラー対応の管理者権限チェックミドルウェア
export function isAdmin(req: any, res: any, next: any) {
  logger.debug('ADMIN CHECK', {
    method: req.method,
    path: req.path,
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? { id: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin } : null,
    sessionID: req.sessionID,
    timestamp: new Date().toISOString()
  });
  
  if (req.isAuthenticated() && req.user && req.user.isAdmin) {
    logger.info('ADMIN CHECK - Admin access granted', { username: req.user.username });
    return next();
  }
  
  console.log(`[ADMIN CHECK] ❌ Admin access denied`, {
    isAuthenticated: req.isAuthenticated(),
    hasUser: !!req.user,
    isAdmin: req.user?.isAdmin
  });
  
  // 統一エラーハンドラー用のエラーオブジェクトを作成
  const adminError: any = new Error("この操作には管理者権限が必要です。");
  adminError.type = 'AUTH_FAILED';
  adminError.status = 403;
  
  next(adminError);
}

// ハイブリッド認証ミドルウェア（JWT + セッション対応）
export const isAuthenticatedHybrid = hybridAuthManager.createAuthMiddleware();

// ハイブリッド管理者権限チェックミドルウェア
export function isAdminHybrid(req: any, res: any, next: any) {
  logger.debug('HYBRID ADMIN CHECK', {
    method: req.method,
    path: req.path,
    user: req.user ? { id: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin } : null,
    timestamp: new Date().toISOString()
  });
  
  if (req.user && req.user.isAdmin) {
    logger.info('HYBRID ADMIN CHECK - Admin access granted', { username: req.user.username });
    return next();
  }
  
  console.log(`[HYBRID ADMIN CHECK] ❌ Admin access denied`, {
    hasUser: !!req.user,
    isAdmin: req.user?.isAdmin
  });
  
  // 統一エラーハンドラー用のエラーオブジェクトを作成
  const adminError: any = new Error("この操作には管理者権限が必要です。");
  adminError.type = 'AUTH_FAILED';
  adminError.status = 403;
  
  next(adminError);
}