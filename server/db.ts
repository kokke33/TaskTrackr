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

// Neonの場合は接続プールの設定を調整（5分制限対応）
const poolConfig = isNeon ? {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 60000,   // 1分
  idleTimeoutMillis: 240000,       // 4分（Neon無料プランの5分制限より前に切断）
  max: 2,                          // 接続数を最小限に抑制
  min: 0,                          // 最小接続数を0に（完全なアイドル時切断）
  acquireTimeoutMillis: 30000,     // 取得タイムアウト30秒
  keepAlive: true,                 // TCP Keep-Aliveを有効化
  keepAliveInitialDelayMillis: 10000, // 10秒後にKeep-Alive開始
  ssl: { rejectUnauthorized: false }
} : {
  connectionString: databaseUrl,
  max: 10,                         // ローカル環境では接続数を多めに設定
  idleTimeoutMillis: 30000        // ローカル環境では短めのタイムアウト
};

export const pool = new Pool(poolConfig);

// プールレベルでのエラーハンドリングを追加（離席後エラー対策強化）
pool.on('error', (err) => {
  // 本番環境では接続切断メッセージをINFOレベルに格下げ
  const isProduction = process.env.NODE_ENV === 'production';
  
  // 認証エラーの特別処理
  if (err.message.includes('role') && err.message.includes('does not exist')) {
    console.error('❌ データベースユーザーが存在しません');
    console.error(`💡 現在のDATABASE_URL: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//[USER:PASS]@')}`);
    console.error('💡 データベースユーザーとパスワードを確認してください');
  } else if (err.message.includes('Connection terminated unexpectedly') || 
      err.message.includes('ECONNRESET') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('ENOTFOUND') ||
      err.message.includes('terminating connection due to administrator command')) {
    
    // 本番環境では警告レベルに格下げ、開発環境では従来通り
    if (isProduction) {
      console.warn('PostgreSQL Pool Error:', err.message);
      console.info('🔄 データベース接続が切断されました。次回のクエリ時に自動再接続されます。');
      if (isNeon) {
        console.info('💡 Neon環境: 4分アイドルタイムアウト後の自動再接続です（5分制限対応）');
      }
    } else {
      console.error('PostgreSQL Pool Error:', err.message);
      console.log('🔄 データベース接続が切断されました。次回のクエリ時に自動再接続されます。');
      if (isNeon) {
        console.log('💡 Neon環境: 4分アイドルタイムアウト後の再接続です（5分制限対応）');
      }
    }
  } else {
    // その他のエラーは従来通りエラーレベル
    console.error('PostgreSQL Pool Error:', err.message);
  }
});

// プールの接続イベントも監視
pool.on('connect', (client) => {
  // 本番環境では接続確立メッセージをINFOレベルに格下げ
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.info('🔗 新しいデータベース接続が確立されました');
  } else {
    console.log('🔗 新しいデータベース接続が確立されました');
  }
  
  // クライアントレベルでのエラーハンドリング
  client.on('error', (err) => {
    // 接続切断関連のエラーは本番環境で格下げ
    if (err.message.includes('server closed the connection unexpectedly') ||
        err.message.includes('terminating connection due to administrator command')) {
      
      if (isProduction) {
        console.warn('PostgreSQL Client Error:', err.message);
        console.info('⚠️ サーバーが接続を閉じました（Neon 5分制限による自動切断）');
      } else {
        console.error('PostgreSQL Client Error:', err.message);
        console.log('⚠️ サーバーが予期せず接続を閉じました（Neon 5分制限の可能性）');
      }
    } else {
      // その他のクライアントエラーは従来通りエラーレベル
      console.error('PostgreSQL Client Error:', err.message);
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
    const isProduction = process.env.NODE_ENV === 'production';
    let retries = 3;
    
    while (retries > 0) {
      try {
        if (isProduction) {
          console.info('Neonデータベースへの接続をテスト中...');
        } else {
          console.log('Neonデータベースへの接続をテスト中...');
        }
        
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        if (isProduction) {
          console.info('✅ Neonデータベース接続成功');
        } else {
          console.log('✅ Neonデータベース接続成功');
        }
        break;
      } catch (error) {
        retries--;
        const message = `⚠️ Neonデータベース接続失敗 (残り${retries}回)`;
        
        if (isProduction) {
          console.warn(message);
        } else {
          console.log(message);
        }
        
        if (retries > 0) {
          if (isProduction) {
            console.info('10秒後にリトライします...');
          } else {
            console.log('10秒後にリトライします...');
          }
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          console.error('❌ Neonデータベースの接続に失敗しました');
          console.error('Neonコンソールでデータベースが起動しているか確認してください');
        }
      }
    }
  };
  
  // 非同期でウォームアップを実行（アプリケーション起動をブロックしない）
  warmupDatabase().catch(console.error);
}
