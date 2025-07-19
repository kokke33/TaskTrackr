import { compare, hash } from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

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

      console.log("認証成功 - ユーザー情報:", {
        id: completeUser.id,
        username: completeUser.username,
        isAdmin: completeUser.isAdmin
      });

      return done(null, completeUser);
    } catch (error) {
      console.error("認証エラー:", error);
      return done(error);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.id, id));
    done(null, user);
  } catch (error) {
    done(error);
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

// 認証ミドルウェア
export function isAuthenticated(req: any, res: any, next: any) {
  const sessionInfo = {
    method: req.method,
    path: req.path,
    sessionID: req.sessionID,
    authenticated: req.isAuthenticated(),
    userAgent: req.headers['user-agent']?.substring(0, 50),
    timestamp: new Date().toISOString()
  };
  
  console.log(`[AUTH DEBUG] ${sessionInfo.method} ${sessionInfo.path} - Session: ${sessionInfo.sessionID}, Auth: ${sessionInfo.authenticated}, User: ${req.user ? JSON.stringify(req.user) : 'none'}, Time: ${sessionInfo.timestamp}`);
  
  if (req.isAuthenticated()) {
    return next();
  }
  
  console.log(`[AUTH ERROR] Request denied - ${sessionInfo.method} ${sessionInfo.path} at ${sessionInfo.timestamp}`);
  console.log(`[AUTH ERROR] Session details:`, {
    sessionID: sessionInfo.sessionID,
    cookies: req.headers.cookie,
    session: req.session ? Object.keys(req.session) : 'no session'
  });
  
  res.status(401).json({ message: "認証が必要です" });
}

// 管理者権限チェックミドルウェア
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
  res.status(403).json({ message: "この操作には管理者権限が必要です" });
}