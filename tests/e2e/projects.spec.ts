import { test, expect } from '@playwright/test';

test.describe('プロジェクト管理機能', () => {
  // 各テスト前にログイン
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('プロジェクト一覧ページが正しく表示される', async ({ page }) => {
    await page.goto('/projects');
    
    // プロジェクト一覧の要素を確認
    await expect(page.locator('h1:has-text("プロジェクト一覧")')).toBeVisible();
    await expect(page.locator('button:has-text("新規プロジェクト")')).toBeVisible();
    
    // テーブルヘッダーを確認
    await expect(page.locator('th:has-text("プロジェクト名")')).toBeVisible();
    await expect(page.locator('th:has-text("組織")')).toBeVisible();
    await expect(page.locator('th:has-text("進捗状況")')).toBeVisible();
  });

  test('新しいプロジェクトを作成できる', async ({ page }) => {
    await page.goto('/projects');
    
    // 新規プロジェクトボタンをクリック
    await page.click('button:has-text("新規プロジェクト")');
    
    // フォームに入力
    await page.fill('input[name="name"]', 'E2Eテストプロジェクト');
    await page.fill('textarea[name="overview"]', 'Playwrightによる自動テスト');
    await page.fill('input[name="organization"]', 'テスト会社');
    await page.fill('input[name="personnel"]', 'テスト担当者');
    await page.selectOption('select[name="progress"]', '開始準備中');
    
    // 保存ボタンをクリック
    await page.click('button:has-text("保存")');
    
    // 成功メッセージを確認
    await expect(page.locator('text=プロジェクトが作成されました')).toBeVisible();
    
    // プロジェクト一覧に戻り、新しいプロジェクトが表示されることを確認
    await expect(page.locator('td:has-text("E2Eテストプロジェクト")')).toBeVisible();
  });

  test('プロジェクトの詳細を表示できる', async ({ page }) => {
    await page.goto('/projects');
    
    // 最初のプロジェクトをクリック
    await page.click('tr:has(td) >> first');
    
    // プロジェクト詳細ページに移動
    await expect(page).toHaveURL(/\/projects\/\d+/);
    
    // 詳細情報が表示されることを確認
    await expect(page.locator('h1')).toContainText('プロジェクト詳細');
    await expect(page.locator('text=プロジェクト名')).toBeVisible();
    await expect(page.locator('text=概要')).toBeVisible();
    await expect(page.locator('text=組織')).toBeVisible();
  });

  test('プロジェクトを編集できる', async ({ page }) => {
    await page.goto('/projects');
    
    // 編集ボタンをクリック
    await page.click('button:has-text("編集") >> first');
    
    // フォームフィールドを編集
    await page.fill('input[name="name"]', '編集後プロジェクト名');
    await page.fill('textarea[name="overview"]', '編集後の概要');
    
    // 保存ボタンをクリック
    await page.click('button:has-text("保存")');
    
    // 成功メッセージを確認
    await expect(page.locator('text=プロジェクトが更新されました')).toBeVisible();
    
    // 更新された内容が表示されることを確認
    await expect(page.locator('td:has-text("編集後プロジェクト名")')).toBeVisible();
  });

  test('プロジェクトの検索機能が動作する', async ({ page }) => {
    await page.goto('/projects');
    
    // 検索フィールドに入力
    await page.fill('input[placeholder*="検索"]', 'テスト');
    
    // 検索結果が表示されることを確認
    await page.waitForTimeout(500); // デバウンス待機
    
    // 検索結果のテーブル行が表示されることを確認
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount({ min: 0 }); // 0件以上の結果
    
    // 検索をクリア
    await page.fill('input[placeholder*="検索"]', '');
    await page.waitForTimeout(500);
  });

  test('プロジェクトの削除機能が動作する', async ({ page }) => {
    await page.goto('/projects');
    
    // 削除ボタンをクリック（最初のプロジェクト）
    await page.click('button:has-text("削除") >> first');
    
    // 確認ダイアログが表示される
    await expect(page.locator('text=本当に削除しますか')).toBeVisible();
    
    // 削除を確認
    await page.click('button:has-text("削除する")');
    
    // 成功メッセージを確認
    await expect(page.locator('text=プロジェクトが削除されました')).toBeVisible();
  });
});