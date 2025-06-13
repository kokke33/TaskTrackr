import { storage } from './storage';
import { db } from './db';
import { cases, projects, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hash as bcryptHash } from 'bcryptjs';

/**
 * 案件（Case）データに基づいて既存のプロジェクトを作成するマイグレーション
 */
export async function migrateExistingProjectsFromCases() {
  console.log('案件データからプロジェクトを移行中...');
  
  // リトライ機能付きでマイグレーションを実行
  const performMigration = async () => {
    // 既存の案件を取得
    const existingCases = await storage.getAllCases(true); // 削除済みも含めて取得
    
    // 案件からプロジェクト名一覧を抽出（重複を除去）
    const projectNamesSet = new Set<string>();
    existingCases.forEach(caseItem => {
      if (caseItem.projectName && caseItem.projectName.trim() !== '') {
        projectNamesSet.add(caseItem.projectName.trim());
      }
    });
    
    console.log(`一意なプロジェクト名を${projectNamesSet.size}件検出`);
    
    // 既存のプロジェクトを取得
    const existingProjects = await storage.getAllProjects(true);
    const existingProjectNames = new Set(existingProjects.map(p => p.name));
    
    // 各プロジェクト名に対応するプロジェクトレコードを作成（存在しない場合のみ）
    let createdCount = 0;
    for (const projectName of Array.from(projectNamesSet)) {
      // 既に同名のプロジェクトが存在する場合はスキップ
      if (existingProjectNames.has(projectName)) {
        console.log(`プロジェクト "${projectName}" は既に存在します`);
        continue;
      }
      
      // 関連する最初の案件から説明文を取得
      const relatedCase = existingCases.find(c => c.projectName === projectName);
      const description = relatedCase?.description || '';
      
      try {
        // プロジェクトを作成
        await storage.createProject({
          name: projectName,
          overview: description,
          organization: '',
          personnel: '',
          progress: '',
          businessDetails: '',
          issues: '',
          documents: '',
          handoverNotes: '',
          remarks: '',
          isDeleted: false
        });
        createdCount++;
        console.log(`プロジェクト "${projectName}" を作成しました`);
      } catch (error) {
        console.error(`プロジェクト "${projectName}" の作成に失敗しました:`, error);
      }
    }
    
    console.log(`マイグレーション完了: ${createdCount}件のプロジェクトを作成しました`);
    return { created: createdCount, total: projectNamesSet.size };
  };

  try {
    // 最大3回リトライ
    let retries = 3;
    while (retries > 0) {
      try {
        return await performMigration();
      } catch (error: any) {
        const isConnectionError = 
          error.message?.includes('Connection terminated unexpectedly') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT';
        
        if (isConnectionError && retries > 1) {
          retries--;
          console.log(`🔄 マイグレーション中にデータベース接続エラー (残り${retries}回)`);
          console.log('10秒後にリトライします...');
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }
        
        throw error;
      }
    }
  } catch (error) {
    console.error('Failed to migrate projects from cases:', error);
    return { created: 0, total: 0 };
  }
}


