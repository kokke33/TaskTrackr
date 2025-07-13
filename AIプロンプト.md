# TaskTrackrプロジェクト：AIプロンプト管理

## 概要
このドキュメントは、TaskTrackrプロジェクトで使用されているAIプロンプトの管理情報を記録しています。

**更新日**: 2025年7月13日  
**管理方式**: データベース一元管理（ai_prompts テーブル）+ 管理画面での編集

## 管理画面
- **URL**: `/admin/ai-prompts`
- **アクセス権限**: 管理者のみ
- **機能**: プロンプトの作成、編集、削除、検索、カテゴリ別表示

## 現在のプロンプト一覧（データベース管理）

### カテゴリ: テキスト処理
| プロンプト名 | 説明 | 関数名 | 状態 |
| :--- | :--- | :--- | :--- |
| テキスト要約 | システムエンジニアの視点でテキストを簡潔に要約 | generateSummary | 有効 |

### カテゴリ: プロジェクト管理
| プロンプト名 | 説明 | 関数名 | 状態 |
| :--- | :--- | :--- | :--- |
| タスク分析 | プロジェクトマネージャーの視点でタスクを分析してJSONで返す | analyzeTask | 有効 |
| リアルタイム週次報告分析 | 週次報告の内容を分析してフィードバックを提供 | analyzeText | 有効 |
| 週次報告分析 | プロジェクトマネージャーのアシスタントとして週次報告を分析 | analyzeWeeklyReport | 有効 |

### カテゴリ: レポート作成
| プロンプト名 | 説明 | 関数名 | 状態 |
| :--- | :--- | :--- | :--- |
| 月次報告書作成 | 経営層向けの月次報告書を作成 | generateMonthlySummary | 有効 |
| 会議議事録生成 | 週次報告の修正内容から会議議事録を自動生成 | generateEditMeetingMinutes | 有効 |

## 技術実装詳細

### データベース構造
```sql
CREATE TABLE ai_prompts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  system_message TEXT,
  user_message_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  function_name TEXT,
  source_location TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### APIエンドポイント
- `GET /api/ai-prompts` - 全プロンプト取得
- `GET /api/ai-prompts/category/:category` - カテゴリ別プロンプト取得
- `GET /api/ai-prompts/:id` - 個別プロンプト取得
- `POST /api/ai-prompts` - プロンプト作成（管理者のみ）
- `PUT /api/ai-prompts/:id` - プロンプト更新（管理者のみ）
- `DELETE /api/ai-prompts/:id` - プロンプト削除（管理者のみ）

### ファイル構成
- **フロントエンド**: `client/src/pages/ai-prompts.tsx`
- **バックエンド**: `server/routes.ts` (AIプロンプト管理API)
- **データベース**: `server/storage.ts` (AIプロンプト管理メソッド)
- **スキーマ**: `shared/schema.ts` (aiPrompts テーブル定義)

### 今後の改善点
1. **プロンプトのバージョン管理**: プロンプトの履歴管理機能
2. **テスト機能**: 管理画面からプロンプトのテスト実行
3. **プロンプト使用状況の監視**: 各プロンプトの使用頻度や成功率の記録
4. **動的プロンプト生成**: より複雑な条件分岐に対応したプロンプト生成
5. **カテゴリ管理**: カテゴリの追加・削除機能

### 過去のプロンプト管理（参考）
過去は各ソースコードに直接記述されていたプロンプトを、以下のように整理しました：

| 移行前の場所 | 移行後の管理方法 |
| :--- | :--- |
| `server/ai-service.ts` | データベース（テキスト処理・プロジェクト管理カテゴリ） |
| `server/routes.ts` | データベース（レポート作成カテゴリ） |
| 設定ファイル | 従来通り（AI設定関連は別途管理） |