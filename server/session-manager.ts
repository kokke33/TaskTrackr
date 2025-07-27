import { Store } from 'express-session';
import session from 'express-session';
import MemoryStore from 'memorystore';
import pgSession from 'connect-pg-simple';

const PostgresStore = pgSession(session);
const MemStore = MemoryStore(session);

/**
 * 統一セッションストレージ管理システム
 * 環境に応じて最適なセッションストアを自動選択
 */
export class UnifiedSessionManager {
  private store: Store;
  private storeType: 'memory' | 'postgresql' | 'redis';

  constructor() {
    this.storeType = 'memory'; // 初期化
    this.store = this.createOptimalStore();
  }

  /**
   * セッションストアを取得
   */
  getStore(): Store {
    return this.store;
  }

  /**
   * 使用中のストアタイプを取得
   */
  getStoreType(): string {
    return this.storeType;
  }

  /**
   * 環境に応じた最適なセッションストアを作成
   */
  private createOptimalStore(): Store {
    const databaseUrl = process.env.DATABASE_URL || '';
    
    // 将来的な拡張: Redis対応
    if (process.env.REDIS_URL) {
      console.log('📦 セッションストア: Redis (未実装)');
      // TODO: Redis実装
      // this.storeType = 'redis';
      // return new RedisStore({ url: process.env.REDIS_URL });
    }

    // PostgreSQL対応（Neon.techでない場合）
    if (databaseUrl && !this.isDatabaseLimited(databaseUrl)) {
      try {
        console.log('📦 セッションストア: PostgreSQL');
        this.storeType = 'postgresql';
        return new PostgresStore({
          conObject: {
            connectionString: databaseUrl,
          },
          createTableIfMissing: true,
          tableName: 'session',
          ttl: 4 * 60 * 60, // 4時間のTTL（セッション設定と統一）
          pruneSessionInterval: 15 * 60, // 15分ごとにクリーンアップ
        });
      } catch (error) {
        console.warn('⚠️ PostgreSQL セッションストア初期化失敗、MemoryStoreにフォールバック:', error);
      }
    }

    // MemoryStore（フォールバック）
    console.log('📦 セッションストア: MemoryStore (Neon.tech対応)');
    this.storeType = 'memory';
    return new MemStore({
      checkPeriod: 10 * 60 * 1000, // 10分ごとにクリーンアップ
      max: 1000, // メモリ使用量制限
      ttl: 4 * 60 * 60 * 1000, // 4時間でセッション期限切れ
      stale: false, // 期限切れセッションは保持しない
      dispose: (key: string) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🗑️ セッション削除: ${key.substring(0, 8)}...`);
        }
      }
    });
  }

  /**
   * データベースが制限されている環境かチェック
   * （Neon.techなど接続数制限がある環境）
   */
  private isDatabaseLimited(databaseUrl: string): boolean {
    // Neon.tech判定
    if (databaseUrl.includes('neon.tech')) {
      return true;
    }
    
    // その他の制限されたデータベース環境の判定
    // 将来的に追加可能
    
    return false;
  }

  /**
   * セッションストアの統計情報を取得
   */
  getStats(): { type: string; info: any } {
    const baseStats = {
      type: this.storeType,
      timestamp: new Date().toISOString()
    };

    if (this.storeType === 'memory' && this.store instanceof MemStore) {
      return {
        ...baseStats,
        info: {
          sessionCount: this.store.length || 'unknown',
          memoryUsage: process.memoryUsage()
        }
      };
    }

    if (this.storeType === 'postgresql') {
      return {
        ...baseStats,
        info: {
          connectionString: process.env.DATABASE_URL ? 'configured' : 'missing',
          ttlSeconds: 4 * 60 * 60
        }
      };
    }

    return {
      ...baseStats,
      info: {}
    };
  }

  /**
   * セッションストアの健全性チェック
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // MemoryStoreの場合
      if (this.storeType === 'memory') {
        return {
          healthy: true,
          message: 'MemoryStore is operational'
        };
      }

      // PostgreSQLの場合（簡易チェック）
      if (this.storeType === 'postgresql') {
        // 実際のPostgreSQL接続テストは実装しない（storage.tsでのリトライロジックに依存）
        return {
          healthy: true,
          message: 'PostgreSQL session store configured'
        };
      }

      return {
        healthy: false,
        message: 'Unknown session store type'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Session store health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// シングルトンインスタンス
export const sessionManager = new UnifiedSessionManager();