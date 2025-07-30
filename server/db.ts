import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL環境変数が設定されていません');
  console.error('💡 以下の環境変数を設定してください:');
  console.error('   DATABASE_URL=postgresql://user:password@host:port/database');
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// DATABASE_URLから接続先を判定
const databaseUrl = process.env.DATABASE_URL;
const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
const isNeon = databaseUrl.includes('neon.tech');

if (isLocal) {
  console.log('ローカルPostgreSQL環境に接続します');
} else if (isNeon) {
  console.log('Neon PostgreSQL環境に接続します');
} else {
  console.log('リモートPostgreSQL環境に接続します');
}

// Neonの場合は接続プールの設定を調整（離席後のエラー対策を強化）
const poolConfig = isNeon ? {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 120000,  // 2分に延長（離席後の再接続時間を考慮）
  idleTimeoutMillis: 900000,       // 15分に延長（Neonのアイドルタイムアウトに合わせる）
  max: 3,                          // 接続数をさらに削減してリソース効率化
  min: 1,                          // 最低1つの接続を維持
  acquireTimeoutMillis: 120000,    // 取得タイムアウトも2分に延長
  keepAlive: true,                 // TCP Keep-Aliveを有効化
  keepAliveInitialDelayMillis: 0,  // Keep-Alive開始遅延なし
  ssl: { rejectUnauthorized: false }
} : {
  connectionString: databaseUrl,
  max: 10,                         // ローカル環境では接続数を多めに設定
  idleTimeoutMillis: 30000        // ローカル環境では短めのタイムアウト
};

export const pool = new Pool(poolConfig);

// プールレベルでのエラーハンドリングを追加（離席後エラー対策強化）
pool.on('error', (err) => {
  console.error('PostgreSQL Pool Error:', err.message);
  
  // 認証エラーの特別処理
  if (err.message.includes('role') && err.message.includes('does not exist')) {
    console.error('❌ データベースユーザーが存在しません');
    console.error(`💡 現在のDATABASE_URL: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//[USER:PASS]@')}`);
    console.error('💡 データベースユーザーとパスワードを確認してください');
  } else if (err.message.includes('Connection terminated unexpectedly') || 
      err.message.includes('ECONNRESET') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('ENOTFOUND')) {
    console.log('🔄 データベース接続が切断されました。次回のクエリ時に自動再接続されます。');
    // 離席後によくある接続エラーのログ出力
    if (isNeon) {
      console.log('💡 Neon環境: 15分のアイドルタイムアウト後の再接続です');
    }
  }
});

// プールの接続イベントも監視
pool.on('connect', (client) => {
  console.log('🔗 新しいデータベース接続が確立されました');
  
  // クライアントレベルでのエラーハンドリング
  client.on('error', (err) => {
    console.error('PostgreSQL Client Error:', err.message);
    // セッション中に発生するクライアントエラーの詳細ログ
    if (err.message.includes('server closed the connection unexpectedly')) {
      console.log('⚠️ サーバーが予期せず接続を閉じました（離席によるタイムアウトの可能性）');
    }
  });

  // Neon環境では接続時にタイムゾーンを設定（セッション安定化）
  if (isNeon) {
    client.query("SET timezone = 'UTC'").catch(err => 
      console.log('タイムゾーン設定をスキップ:', err.message)
    );
  }
});

export const db = drizzle({ client: pool, schema });

// Neonデータベースの接続テスト（初回アクセス時のウォームアップ）
if (isNeon) {
  const warmupDatabase = async () => {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log('Neonデータベースへの接続をテスト中...');
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('✅ Neonデータベース接続成功');
        break;
      } catch (error) {
        retries--;
        console.log(`⚠️ Neonデータベース接続失敗 (残り${retries}回)`);
        if (retries > 0) {
          console.log('10秒後にリトライします...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          console.log('❌ Neonデータベースの接続に失敗しました');
          console.log('Neonコンソールでデータベースが起動しているか確認してください');
        }
      }
    }
  };
  
  // 非同期でウォームアップを実行（アプリケーション起動をブロックしない）
  warmupDatabase().catch(console.error);
}
