import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
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

// Neonの場合は接続プールの設定を調整
const poolConfig = isNeon ? {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 60000,  // 60秒に延長（Neonの起動時間を考慮）
  idleTimeoutMillis: 30000,
  max: 5,  // コネクション数を削減
  acquireTimeoutMillis: 60000,  // 取得タイムアウトも延長
  ssl: { rejectUnauthorized: false }
} : {
  connectionString: databaseUrl
};

export const pool = new Pool(poolConfig);

// プールレベルでのエラーハンドリングを追加
pool.on('error', (err) => {
  console.error('PostgreSQL Pool Error:', err.message);
  if (err.message.includes('Connection terminated unexpectedly') || 
      err.message.includes('ECONNRESET')) {
    console.log('🔄 Neonデータベースとの接続が切断されました。次回のクエリ時に自動再接続されます。');
  }
});

// プールの接続イベントも監視
pool.on('connect', (client) => {
  console.log('🔗 新しいデータベース接続が確立されました');
  
  // クライアントレベルでのエラーハンドリング
  client.on('error', (err) => {
    console.error('PostgreSQL Client Error:', err.message);
  });
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
