import { test, expect } from '@playwright/test';

test.describe('認証機能', () => {
  test('ログインページが正しく表示される', async ({ page }) => {
    await page.goto('/');
    
    // ログインフォームの要素を確認
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/TaskTrackr/);
  });

  test('正しい認証情報でログインできる', async ({ page }) => {
    await page.goto('/');
    
    // ログインフォームに入力
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    
    // ログインボタンをクリック
    await page.click('button[type="submit"]');
    
    // ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=ダッシュボード')).toBeVisible();
  });

  test('間違った認証情報でログインが失敗する', async ({ page }) => {
    await page.goto('/');
    
    // 間違った認証情報を入力
    await page.fill('input[name="username"]', 'wrong');
    await page.fill('input[name="password"]', 'wrong');
    
    // ログインボタンをクリック
    await page.click('button[type="submit"]');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=ログインに失敗しました')).toBeVisible();
    // ログインページに留まることを確認
    await expect(page).toHaveURL('/');
  });

  test('ログアウト機能が正常に動作する', async ({ page }) => {
    // まずログイン
    await page.goto('/');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // ダッシュボードに移動
    await expect(page).toHaveURL(/\/dashboard/);
    
    // ログアウトボタンをクリック
    await page.click('button:has-text("ログアウト")');
    
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });
});