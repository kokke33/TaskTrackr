import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from "dotenv";

dotenv.config();

/**
 * データベース自動作成機能
 * データベースが存在しない場合に自動的に作成し、スキーマも初期化します
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
        
        // 新規作成されたデータベースのスキーマを初期化
        await ensureDatabaseSchema(databaseUrl);
      } else {
        console.log(`✅ データベース "${targetDbName}" は既に存在します`);
        
        // 既存のデータベースでもスキーマチェックを実行
        await ensureDatabaseSchema(databaseUrl);
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

/**
 * データベーススキーマの存在確認と作成
 * 必要なテーブルが存在しない場合は自動的に作成します
 */
async function ensureDatabaseSchema(databaseUrl: string) {
  console.log('🔧 データベーススキーマの確認中...');
  
  // 対象データベースに接続
  const schemaPool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    const db = drizzle({ client: schemaPool, schema });
    const client = await schemaPool.connect();
    
    try {
      // usersテーブルの存在確認（代表的なテーブルとして使用）
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      const tablesExist = result.rows[0].exists;
      
      if (!tablesExist) {
        console.log('📋 必要なテーブルが存在しません。スキーマを作成中...');
        
        // 基本的なテーブルを作成
        await createBasicTables(client);
        
        console.log('✅ データベーススキーマの作成が完了しました');
      } else {
        console.log('✅ データベーススキーマは既に存在します');
      }
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ スキーマの確認・作成に失敗しました:', error.message);
    throw error;
  } finally {
    await schemaPool.end();
  }
}

/**
 * 基本的なテーブルを作成
 */
async function createBasicTables(client: any) {
  // usersテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // projectsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      overview TEXT,
      organization TEXT,
      personnel TEXT,
      progress TEXT,
      business_details TEXT,
      issues TEXT,
      documents TEXT,
      handover_notes TEXT,
      remarks TEXT,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // casesテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      case_name TEXT NOT NULL,
      description TEXT,
      milestone TEXT,
      include_progress_analysis BOOLEAN NOT NULL DEFAULT true,
      weekly_meeting_day TEXT,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // weekly_reportsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id SERIAL PRIMARY KEY,
      report_period_start DATE NOT NULL,
      report_period_end DATE NOT NULL,
      case_id INTEGER NOT NULL,
      reporter_name TEXT NOT NULL,
      weekly_tasks TEXT NOT NULL,
      progress_rate INTEGER NOT NULL,
      progress_status TEXT NOT NULL,
      delay_issues TEXT NOT NULL,
      delay_details TEXT,
      issues TEXT NOT NULL,
      new_risks TEXT NOT NULL,
      risk_summary TEXT,
      risk_countermeasures TEXT,
      risk_level TEXT,
      quality_concerns TEXT NOT NULL,
      quality_details TEXT,
      test_progress TEXT,
      changes TEXT NOT NULL,
      change_details TEXT,
      next_week_plan TEXT NOT NULL,
      support_requests TEXT NOT NULL,
      resource_concerns TEXT,
      resource_details TEXT,
      customer_issues TEXT,
      customer_details TEXT,
      environment_issues TEXT,
      environment_details TEXT,
      cost_issues TEXT,
      cost_details TEXT,
      knowledge_issues TEXT,
      knowledge_details TEXT,
      training_issues TEXT,
      training_details TEXT,
      urgent_issues TEXT,
      urgent_details TEXT,
      business_opportunities TEXT,
      business_details TEXT,
      admin_confirmation_email TEXT,
      ai_analysis TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // system_settingsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // manager_meetingsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS manager_meetings (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      meeting_date DATE NOT NULL,
      year_month TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // weekly_report_meetingsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS weekly_report_meetings (
      id SERIAL PRIMARY KEY,
      weekly_report_id INTEGER NOT NULL UNIQUE,
      meeting_date DATE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      modified_by TEXT NOT NULL,
      original_data JSONB NOT NULL,
      modified_data JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // admin_confirmation_emailsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_confirmation_emails (
      id SERIAL PRIMARY KEY,
      weekly_report_id INTEGER UNIQUE,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // chat_historiesテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_histories (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email_id TEXT NOT NULL,
      user_message TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // monthly_reportsテーブル
  await client.query(`
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      year_month TEXT NOT NULL,
      case_ids TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      content TEXT NOT NULL,
      ai_provider TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // インデックスの作成
  await client.query(`
    CREATE INDEX IF NOT EXISTS cases_is_deleted_idx ON cases(is_deleted);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS cases_created_at_idx ON cases(created_at);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS cases_project_name_idx ON cases(project_name);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS cases_is_deleted_created_at_idx ON cases(is_deleted, created_at);
  `);

  console.log('📋 基本テーブルとインデックスの作成が完了しました');
}