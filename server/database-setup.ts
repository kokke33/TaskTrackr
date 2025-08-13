import { Pool } from 'pg';
import dotenv from "dotenv";

dotenv.config();

/**
 * データベース自動作成機能
 * データベースが存在しない場合に自動的に作成します
 */
export async function ensureDatabaseExists() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL環境変数が設定されていません');
    throw new Error('DATABASE_URL must be set');
  }

  // DATABASE_URLをパースしてデータベース名を取得
  const url = new URL(databaseUrl);
  const targetDbName = url.pathname.slice(1); // 先頭の"/"を除去
  
  if (!targetDbName) {
    console.error('❌ DATABASE_URLにデータベース名が含まれていません');
    throw new Error('Database name not found in DATABASE_URL');
  }

  // データベース作成用の接続（postgresデータベースに接続）
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log(`📦 データベース "${targetDbName}" の存在確認中...`);
    
    // データベースの存在確認
    const client = await adminPool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [targetDbName]
      );

      if (result.rows.length === 0) {
        console.log(`🔧 データベース "${targetDbName}" が存在しません。作成中...`);
        
        // データベースを作成（SQL Injectionを防ぐため、識別子をエスケープ）
        const escapedDbName = `"${targetDbName.replace(/"/g, '""')}"`;
        await client.query(`CREATE DATABASE ${escapedDbName}`);
        
        console.log(`✅ データベース "${targetDbName}" を作成しました`);
      } else {
        console.log(`✅ データベース "${targetDbName}" は既に存在します`);
      }
    } finally {
      client.release();
    }
  } catch (error: any) {
    // データベースが既に存在する場合のエラーは無視
    if (error.code === '42P04') {
      console.log(`✅ データベース "${targetDbName}" は既に存在します`);
    } else {
      console.error(`❌ データベースの作成に失敗しました:`, error.message);
      throw error;
    }
  } finally {
    await adminPool.end();
  }
}