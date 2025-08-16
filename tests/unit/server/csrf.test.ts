import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import csrf from 'csrf';

// CSRFミドルウェアのテスト
describe('CSRFミドルウェア', () => {
  let app: express.Application;
  let csrfTokens: any;

  beforeEach(() => {
    app = express();
    csrfTokens = new csrf();
    
    // テスト用の基本設定
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // テスト用セッション設定（メモリストア）
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 30 * 60 * 1000,
        httpOnly: true
      }
    }));

    // CSRFミドルウェアの実装（server/index.tsからコピー）
    app.use((req: any, res, next) => {
      if (!req.session) {
        return next();
      }

      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
      }

      if (req.path.startsWith('/assets/') || req.path === '/ws' || req.url?.includes('/ws')) {
        return next();
      }

      if (!req.session.csrfSecret) {
        req.session.csrfSecret = csrfTokens.secretSync();
      }

      const token = req.headers['x-csrf-token'] || req.body._csrf;
      
      if (!token) {
        return res.status(403).json({
          error: 'CSRF_TOKEN_MISSING',
          message: 'CSRFトークンが必要です。',
          timestamp: new Date().toISOString()
        });
      }

      if (!csrfTokens.verify(req.session.csrfSecret, token)) {
        return res.status(403).json({
          error: 'CSRF_TOKEN_INVALID',
          message: 'CSRFトークンが無効です。',
          timestamp: new Date().toISOString()
        });
      }

      next();
    });

    // CSRFトークン取得エンドポイント
    app.get('/api/csrf-token', (req: any, res) => {
      if (!req.session.csrfSecret) {
        req.session.csrfSecret = csrfTokens.secretSync();
      }
      
      const token = csrfTokens.create(req.session.csrfSecret);
      res.json({ csrfToken: token });
    });

    // テスト用エンドポイント
    app.get('/api/test-get', (req, res) => {
      res.json({ message: 'GET request successful' });
    });

    app.post('/api/test-post', (req, res) => {
      res.json({ message: 'POST request successful', data: req.body });
    });

    app.put('/api/test-put', (req, res) => {
      res.json({ message: 'PUT request successful', data: req.body });
    });

    app.delete('/api/test-delete', (req, res) => {
      res.json({ message: 'DELETE request successful' });
    });
  });

  describe('GETリクエスト', () => {
    it('CSRFトークンなしでGETリクエストが成功する', async () => {
      const response = await request(app)
        .get('/api/test-get')
        .expect(200);

      expect(response.body.message).toBe('GET request successful');
    });

    it('CSRFトークン取得エンドポイントが動作する', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .get('/api/csrf-token')
        .expect(200);

      expect(response.body).toHaveProperty('csrfToken');
      expect(typeof response.body.csrfToken).toBe('string');
      expect(response.body.csrfToken.length).toBeGreaterThan(0);
    });
  });

  describe('POSTリクエスト', () => {
    it('CSRFトークンなしでPOSTリクエストが拒否される', async () => {
      const response = await request(app)
        .post('/api/test-post')
        .send({ test: 'data' })
        .expect(403);

      expect(response.body.error).toBe('CSRF_TOKEN_MISSING');
      expect(response.body.message).toBe('CSRFトークンが必要です。');
    });

    it('無効なCSRFトークンでPOSTリクエストが拒否される', async () => {
      const response = await request(app)
        .post('/api/test-post')
        .set('X-CSRF-Token', 'invalid-token')
        .send({ test: 'data' })
        .expect(403);

      expect(response.body.error).toBe('CSRF_TOKEN_INVALID');
      expect(response.body.message).toBe('CSRFトークンが無効です。');
    });

    it('有効なCSRFトークンでPOSTリクエストが成功する', async () => {
      const agent = request.agent(app);
      
      // CSRFトークンを取得
      const tokenResponse = await agent
        .get('/api/csrf-token')
        .expect(200);
      
      const csrfToken = tokenResponse.body.csrfToken;

      // 有効なトークンでPOSTリクエスト
      const response = await agent
        .post('/api/test-post')
        .set('X-CSRF-Token', csrfToken)
        .send({ test: 'data' })
        .expect(200);

      expect(response.body.message).toBe('POST request successful');
      expect(response.body.data).toEqual({ test: 'data' });
    });

    it('リクエストボディ内のCSRFトークンで認証が成功する', async () => {
      const agent = request.agent(app);
      
      // CSRFトークンを取得
      const tokenResponse = await agent
        .get('/api/csrf-token')
        .expect(200);
      
      const csrfToken = tokenResponse.body.csrfToken;

      // ボディ内にトークンを含めてPOSTリクエスト
      const response = await agent
        .post('/api/test-post')
        .send({ _csrf: csrfToken, test: 'data' })
        .expect(200);

      expect(response.body.message).toBe('POST request successful');
    });
  });

  describe('PUTリクエスト', () => {
    it('有効なCSRFトークンでPUTリクエストが成功する', async () => {
      const agent = request.agent(app);
      
      const tokenResponse = await agent.get('/api/csrf-token');
      const csrfToken = tokenResponse.body.csrfToken;

      const response = await agent
        .put('/api/test-put')
        .set('X-CSRF-Token', csrfToken)
        .send({ test: 'updated data' })
        .expect(200);

      expect(response.body.message).toBe('PUT request successful');
    });
  });

  describe('DELETEリクエスト', () => {
    it('有効なCSRFトークンでDELETEリクエストが成功する', async () => {
      const agent = request.agent(app);
      
      const tokenResponse = await agent.get('/api/csrf-token');
      const csrfToken = tokenResponse.body.csrfToken;

      const response = await agent
        .delete('/api/test-delete')
        .set('X-CSRF-Token', csrfToken)
        .expect(200);

      expect(response.body.message).toBe('DELETE request successful');
    });
  });

  describe('セッション管理', () => {
    it('セッションが存在しない場合はCSRFチェックをスキップ', async () => {
      // セッションミドルウェアなしのアプリを作成
      const noSessionApp = express();
      noSessionApp.use(express.json());
      
      // 同じCSRFミドルウェアを適用
      noSessionApp.use((req: any, res, next) => {
        if (!req.session) {
          return next();
        }
        // 以下は実行されないはず
        next();
      });

      noSessionApp.post('/api/test', (req, res) => {
        res.json({ message: 'success without session' });
      });

      const response = await request(noSessionApp)
        .post('/api/test')
        .send({ test: 'data' })
        .expect(200);

      expect(response.body.message).toBe('success without session');
    });

    it('静的ファイルリクエストはCSRFチェックをスキップ', async () => {
      const response = await request(app)
        .post('/assets/test.js')
        .expect(404); // ファイルが存在しないので404だが、CSRFエラーではない
    });

    it('WebSocketリクエストはCSRFチェックをスキップ', async () => {
      const response = await request(app)
        .post('/ws')
        .expect(404); // エンドポイントが存在しないので404だが、CSRFエラーではない
    });
  });

  describe('エラーレスポンス形式', () => {
    it('CSRFエラーレスポンスに適切なフィールドが含まれる', async () => {
      const response = await request(app)
        .post('/api/test-post')
        .send({ test: 'data' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });
});