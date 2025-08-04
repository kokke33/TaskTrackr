import { compare, hash } from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hybridAuthManager } from "./hybrid-auth-manager";
import { createLogger } from "@shared/logger";

const logger = createLogger('Auth');

// ユーザー認証の設定
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      // パスワード検証のためのユーザー情報取得
      const [userAuth] = await db
        .select({
          id: users.id,
          username: users.username,
          password: users.password,
        })
        .from(users)
        .where(eq(users.username, username));

      if (!userAuth) {
        return done(null, false, { message: "ユーザーが見つかりません" });
      }

      const isValid = await compare(password, userAuth.password);
      if (!isValid) {
        return done(null, false, { message: "パスワードが正しくありません" });
      }

      // 認証成功後、isAdminフラグを含む完全なユーザー情報を取得
      const [completeUser] = await db
        .select({
          id: users.id,
          username: users.username,
          isAdmin: users.isAdmin,
        })
        .from(users)
        .where(eq(users.id, userAuth.id));

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
      console.log(`🧹 セッション復元タイムアウトクリーンアップ - User ID: ${userId}`);
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
      console.log(`🔄 セッション復元待機中 - User ID: ${id}`);
      const entry = activeDeserializations.get(id)!;
      try {
        const result = await entry.promise;
        return done(null, result);
      } catch (error) {
        console.log(`❌ 並行セッション復元エラー - User ID: ${id}`, error);
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
            console.log(`🔄 セッション復元でDB接続エラー (残り${retries}回), User ID: ${id} - ${dbError.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          // リトライしても失敗した場合、またはDB接続エラー以外の場合
          console.error(`❌ セッション復元失敗 - User ID: ${id}`, dbError.message);
          return false; // 認証失敗
        }
      }
      
      if (!user) {
        console.log(`⚠️ ユーザーが見つかりません - User ID: ${id} (削除済みまたは無効なセッション)`);
        return false; // 認証失敗
      }
      
      // 本番環境では機密情報を含むデバッグログを削減
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ セッション復元成功 - ${user.username} (ID: ${user.id})`);
      } else {
        console.log(`✅ セッション復元成功`);
      }
      
      return user;
    })();

    // 排他制御Mapに追加（タイムアウト付き）
    const entry = {
      promise: deserializationPromise,
      timestamp: Date.now(),
      timeout: setTimeout(() => {
        console.log(`⏰ セッション復元タイムアウト - User ID: ${id}`);
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
    console.error(`❌ セッション復元で予期しないエラー - User ID: ${id}`, error);
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
        console.log(`Created initial user: ${user.username}, isAdmin: ${user.isAdmin}`);
      }
    }
  };

  try {
    // 最大3回リトライ
    let retries = 3;
    while (retries > 0) {
      try {
        await createUsersWithRetry();
        console.log('✅ 初期ユーザーの作成が完了しました');
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
          console.log(`🔄 初期ユーザー作成でデータベース接続エラー (残り${retries}回)`);
          console.log('5秒後にリトライします...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        throw error;
      }
    }
  } catch (error) {
    console.error("Error creating initial users:", error);
  }
}

// 統一エラーハンドラー対応の認証ミドルウェア
export function isAuthenticated(req: any, res: any, next: any) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (req.isAuthenticated()) {
    // 認証成功時は本番環境ではログを簡素化
    if (!isProduction) {
      console.log(`✅ Auth OK: ${req.user?.username} - ${req.method} ${req.path}`);
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
  
  console.log(`❌ Auth Failed: ${sessionInfo.method} ${sessionInfo.path}`);
  
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
    console.log(`💡 セッション期限切れの可能性 - 再ログインが必要です`);
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
  console.log(`[ADMIN CHECK] ${req.method} ${req.path}`, {
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? { id: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin } : null,
    sessionID: req.sessionID,
    timestamp: new Date().toISOString()
  });
  
  if (req.isAuthenticated() && req.user && req.user.isAdmin) {
    console.log(`[ADMIN CHECK] ✅ Admin access granted for user ${req.user.username}`);
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
  console.log(`[HYBRID ADMIN CHECK] ${req.method} ${req.path}`, {
    user: req.user ? { id: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin } : null,
    timestamp: new Date().toISOString()
  });
  
  if (req.user && req.user.isAdmin) {
    console.log(`[HYBRID ADMIN CHECK] ✅ Admin access granted for user ${req.user.username}`);
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