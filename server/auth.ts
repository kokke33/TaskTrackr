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
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          password: users.password,
        })
        .from(users)
        .where(eq(users.username, username));

      if (!user) {
        return done(null, false, { message: "ユーザーが見つかりません" });
      }

      const isValid = await compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: "パスワードが正しくありません" });
      }

      return done(null, user);
    } catch (error) {
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
  try {
    const initialUsers = [
      { username: "ss7-1", password: "ss7-1weeklyreport" },
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
        });
        console.log(`Created initial user: ${user.username}`);
      }
    }
  } catch (error) {
    console.error("Error creating initial users:", error);
  }
}

// 認証ミドルウェア
export function isAuthenticated(req: any, res: any, next: any) {
  console.log("isAuthenticated middleware - session:", req.session);
  console.log("isAuthenticated middleware - user:", req.user);
  console.log("isAuthenticated middleware - isAuthenticated:", req.isAuthenticated());
  
  // 開発モードの場合は認証をバイパス
  const isDevMode = process.env.NODE_ENV !== "production";
  const bypassAuth = isDevMode && process.env.BYPASS_AUTH === "true";
  
  if (req.isAuthenticated() || bypassAuth) {
    return next();
  }
  
  // 本番環境でも開発環境でも統一したエラーレスポンス
  res.status(401).json({ 
    authenticated: false,
    message: "認証が必要です。ログインしてください。" 
  });
}