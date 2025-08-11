import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse } from "cookie";

// WebSocketサーバーのテスト用セットアップ
describe("WebSocket編集機能統合テスト", () => {
  let server: Server;
  let wss: WebSocketServer;
  let wsClients: WebSocket[] = [];
  const TEST_PORT = 8081; // ポート重複回避

  beforeEach(async () => {
    // テスト用HTTPサーバーの起動
    server = new Server();
    wss = new WebSocketServer({ server });
    
    // 実際のWebSocket管理ロジックを簡略化したテスト版
    const editingSessions = new Map<number, any[]>();
    const connections = new Map<WebSocket, any>();

    wss.on("connection", (ws, req) => {
      const userId = "test-user-" + Math.random().toString(36).substr(2, 9);
      const username = "テストユーザー" + Math.floor(Math.random() * 100);
      
      connections.set(ws, { userId, username });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case "start_editing":
              const reportId = message.reportId;
              const sessions = editingSessions.get(reportId) || [];
              
              // 既存セッションを更新または新規作成
              const existingIndex = sessions.findIndex(s => s.userId === userId);
              const newSession = {
                reportId,
                userId,
                username,
                startTime: new Date(),
                lastActivity: new Date()
              };
              
              if (existingIndex >= 0) {
                sessions[existingIndex] = newSession;
              } else {
                sessions.push(newSession);
              }
              
              editingSessions.set(reportId, sessions);
              
              // 編集中ユーザーをブロードキャスト
              const broadcastMessage = JSON.stringify({
                type: "editing_users",
                reportId,
                users: sessions.map(s => ({
                  userId: s.userId,
                  username: s.username,
                  startTime: s.startTime,
                  lastActivity: s.lastActivity
                }))
              });
              
              connections.forEach((_, client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
              break;
              
            case "stop_editing":
              const stopReportId = message.reportId;
              const stopSessions = editingSessions.get(stopReportId) || [];
              const filteredSessions = stopSessions.filter(s => s.userId !== userId);
              
              if (filteredSessions.length !== stopSessions.length) {
                editingSessions.set(stopReportId, filteredSessions);
                
                // 更新された編集中ユーザーをブロードキャスト
                const stopBroadcastMessage = JSON.stringify({
                  type: "editing_users",
                  reportId: stopReportId,
                  users: filteredSessions.map(s => ({
                    userId: s.userId,
                    username: s.username,
                    startTime: s.startTime,
                    lastActivity: s.lastActivity
                  }))
                });
                
                connections.forEach((_, client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(stopBroadcastMessage);
                  }
                });
              }
              break;
          }
        } catch (error) {
          console.error("WebSocket message parsing error:", error);
        }
      });

      ws.on("close", () => {
        const connection = connections.get(ws);
        connections.delete(ws);
        
        // 接続終了時に編集セッションもクリーンアップ
        if (connection) {
          editingSessions.forEach((sessions, reportId) => {
            const filteredSessions = sessions.filter(s => s.userId !== connection.userId);
            if (filteredSessions.length !== sessions.length) {
              editingSessions.set(reportId, filteredSessions);
              
              // 更新された編集中ユーザーをブロードキャスト
              const broadcastMessage = JSON.stringify({
                type: "editing_users",
                reportId,
                users: filteredSessions.map(s => ({
                  userId: s.userId,
                  username: s.username,
                  startTime: s.startTime,
                  lastActivity: s.lastActivity
                }))
              });
              
              connections.forEach((_, client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }
          });
        }
      });
    });

    return new Promise<void>((resolve) => {
      server.listen(TEST_PORT, resolve);
    });
  });

  afterEach(async () => {
    // すべてのWebSocket接続を閉じる
    const closePromises = wsClients.map(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        return new Promise<void>((resolve) => {
          ws.close();
          ws.on('close', () => resolve());
        });
      }
      return Promise.resolve();
    });
    await Promise.all(closePromises);
    wsClients = [];

    // WebSocketサーバーを閉じる
    if (wss) {
      await new Promise<void>((resolve) => {
        wss.close((err) => {
          if (err) console.warn('WebSocket server close error:', err);
          resolve();
        });
      });
    }

    // HTTPサーバーを閉じる
    if (server) {
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err) console.warn('HTTP server close error:', err);
          resolve();
        });
      });
    }
  }, 10000); // 10秒のタイムアウト

  const createWebSocketClient = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      // タイムアウト設定（5秒）
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`WebSocket connection timeout after 5 seconds`));
      }, 5000);
      
      ws.on("open", () => {
        clearTimeout(timeout);
        wsClients.push(ws);
        resolve(ws);
      });
      
      ws.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  };

  it("単一ユーザーが編集開始すると正しくブロードキャストされる", async () => {
    const ws = await createWebSocketClient();
    const messages: any[] = [];

    ws.on("message", (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // 編集開始メッセージを送信
    ws.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    // メッセージが送信されるまで待機
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject({
      type: "editing_users",
      reportId: 123,
      users: expect.arrayContaining([
        expect.objectContaining({
          userId: expect.any(String),
          username: expect.any(String),
          startTime: expect.any(String),
          lastActivity: expect.any(String)
        })
      ])
    });
    expect(messages[0].users).toHaveLength(1);
  }, 10000); // テストタイムアウト10秒

  it("複数ユーザーが同じレポートを編集する場合", async () => {
    const ws1 = await createWebSocketClient();
    const ws2 = await createWebSocketClient();
    
    const messages1: any[] = [];
    const messages2: any[] = [];

    ws1.on("message", (data) => {
      messages1.push(JSON.parse(data.toString()));
    });

    ws2.on("message", (data) => {
      messages2.push(JSON.parse(data.toString()));
    });

    // 1番目のユーザーが編集開始
    ws1.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // 2番目のユーザーが編集開始
    ws2.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // 両方のクライアントが2人のユーザー情報を受信する
    const latestMessage1 = messages1[messages1.length - 1];
    const latestMessage2 = messages2[messages2.length - 1];

    expect(latestMessage1.users).toHaveLength(2);
    expect(latestMessage2.users).toHaveLength(2);
    expect(latestMessage1.reportId).toBe(123);
    expect(latestMessage2.reportId).toBe(123);
  }, 10000); // テストタイムアウト10秒

  it("ユーザーが編集を停止すると正しく除外される", async () => {
    const ws1 = await createWebSocketClient();
    const ws2 = await createWebSocketClient();
    
    const messages1: any[] = [];
    const messages2: any[] = [];

    ws1.on("message", (data) => {
      messages1.push(JSON.parse(data.toString()));
    });

    ws2.on("message", (data) => {
      messages2.push(JSON.parse(data.toString()));
    });

    // 両方のユーザーが編集開始
    ws1.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    ws2.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // 1番目のユーザーが編集停止
    ws1.send(JSON.stringify({
      type: "stop_editing",
      reportId: 123
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // 最新のメッセージで1人だけが残っていることを確認
    const latestMessage1 = messages1[messages1.length - 1];
    const latestMessage2 = messages2[messages2.length - 1];

    expect(latestMessage1.users).toHaveLength(1);
    expect(latestMessage2.users).toHaveLength(1);
  }, 10000); // テストタイムアウト10秒

  it("接続が切断されると編集セッションがクリーンアップされる", async () => {
    const ws1 = await createWebSocketClient();
    const ws2 = await createWebSocketClient();
    
    const messages2: any[] = [];

    ws2.on("message", (data) => {
      messages2.push(JSON.parse(data.toString()));
    });

    // 両方のユーザーが編集開始
    ws1.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    ws2.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // 1番目のユーザーの接続を切断
    ws1.close();

    await new Promise(resolve => setTimeout(resolve, 100));

    // 2番目のユーザーが受信する最新メッセージで1人だけが残っていることを確認
    // (実際のテストでは、接続切断時のクリーンアップロジックに依存)
    const latestMessage = messages2[messages2.length - 1];
    if (latestMessage && latestMessage.type === "editing_users") {
      expect(latestMessage.users.length).toBeLessThanOrEqual(1);
    }
  }, 10000); // テストタイムアウト10秒

  it("異なるレポートの編集は独立して管理される", async () => {
    const ws1 = await createWebSocketClient();
    const ws2 = await createWebSocketClient();
    
    const messages1: any[] = [];
    const messages2: any[] = [];

    ws1.on("message", (data) => {
      messages1.push(JSON.parse(data.toString()));
    });

    ws2.on("message", (data) => {
      messages2.push(JSON.parse(data.toString()));
    });

    // 異なるレポートを編集
    ws1.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    ws2.send(JSON.stringify({
      type: "start_editing",
      reportId: 456
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // それぞれのクライアントが自分のレポートの編集情報のみを受信
    const message1 = messages1.find(m => m.reportId === 123);
    const message2 = messages2.find(m => m.reportId === 456);

    expect(message1).toBeDefined();
    expect(message2).toBeDefined();
    expect(message1.users).toHaveLength(1);
    expect(message2.users).toHaveLength(1);
  }, 10000); // テストタイムアウト10秒

  it("無効なメッセージ形式でもクラッシュしない", async () => {
    const ws = await createWebSocketClient();
    
    // 無効なJSONを送信
    ws.send("invalid json");
    
    // 空のオブジェクトを送信
    ws.send(JSON.stringify({}));
    
    // 不明なタイプを送信
    ws.send(JSON.stringify({
      type: "unknown_type",
      data: "test"
    }));

    await new Promise(resolve => setTimeout(resolve, 100));

    // サーバーがクラッシュしていないことを確認（正常なメッセージが送信できる）
    ws.send(JSON.stringify({
      type: "start_editing",
      reportId: 123
    }));

    await new Promise(resolve => setTimeout(resolve, 50));

    // WebSocket接続がまだ開いていることを確認
    expect(ws.readyState).toBe(WebSocket.OPEN);
  }, 10000); // テストタイムアウト10秒
});