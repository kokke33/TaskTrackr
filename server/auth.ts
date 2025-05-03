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
  try {
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
  } catch (error) {
    console.error("Error creating initial users:", error);
  }
}

// 認証ミドルウェア
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "認証が必要です" });
}

// 管理者権限チェックミドルウェア
export function isAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "この操作には管理者権限が必要です" });
}