// デバッグ用：データベースの状態確認
import { config } from 'dotenv';
import { Client } from 'pg';

config();

async function checkDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ データベース接続成功');

    // weekly_reportsテーブルの構造を確認
    console.log('\n📊 weekly_reportsテーブルの構造:');
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'weekly_reports' 
      ORDER BY ordinal_position;
    `);
    
    console.table(tableInfo.rows);

    // versionカラムの存在確認
    const versionColumn = tableInfo.rows.find(row => row.column_name === 'version');
    if (versionColumn) {
      console.log('\n✅ versionカラムが存在します');
    } else {
      console.log('\n❌ versionカラムが存在しません');
      console.log('以下のSQLを実行してください:');
      console.log('ALTER TABLE weekly_reports ADD COLUMN version integer NOT NULL DEFAULT 1;');
    }

    // 一部のレコードでversionの値を確認
    console.log('\n📋 サンプルレコードのversion値:');
    const sampleData = await client.query(`
      SELECT id, version, created_at 
      FROM weekly_reports 
      ORDER BY id DESC 
      LIMIT 5;
    `);
    
    if (sampleData.rows.length > 0) {
      console.table(sampleData.rows);
    } else {
      console.log('レコードが見つかりません');
    }

  } catch (error) {
    console.error('❌ データベースエラー:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error);