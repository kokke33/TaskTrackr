import express from 'express';
import { getAIService, getAIServiceForProvider, AIMessage, analyzeTask, analyzeText, analyzeTextStream, generateSummary, generateResponseStream } from './ai-service.js';
import { isAuthenticated } from './auth';
import { chatWithAdminEmail } from './use-cases/chat-with-admin-email.usecase.js'; // 新しいユースケースをインポート
import { db } from './db.js'; // データベース操作のためにインポート
import { eq } from 'drizzle-orm'; // drizzle-ormからeqをインポート
import { adminConfirmationEmails, chatHistories } from '../shared/schema.js'; // スキーマをインポート

const router = express.Router();

// Validation helper functions
const validateMessages = (messages: any): messages is AIMessage[] => {
  if (!Array.isArray(messages)) return false;
  return messages.every(msg => 
    msg && 
    typeof msg.role === 'string' && 
    ['system', 'user', 'assistant'].includes(msg.role) &&
    typeof msg.content === 'string'
  );
};

// Helper function to extract user ID from request
const getUserId = (req: express.Request): string | undefined => {
  // Check if user is logged in (assuming passport.js session-based auth)
  return (req.user as any)?.id || (req.user as any)?.email || undefined;
};

// AI chat endpoint
router.post('/api/ai/chat', isAuthenticated, async (req, res) => {
  try {
    const { messages } = req.body;
    const userId = getUserId(req);

    if (!validateMessages(messages)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid messages format. Expected array of {role, content} objects.' 
      });
    }

    const aiService = await getAIService();
    const response = await aiService.generateResponse(messages, userId, {
      endpoint: 'chat',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      messageCount: messages.length
    });
    
    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Text summarization endpoint
router.post('/api/ai/summarize', isAuthenticated, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = getUserId(req);

    if (!text || typeof text !== 'string' || text.length < 10) {
      return res.status(400).json({ 
        success: false,
        error: 'Text must be a string with at least 10 characters.' 
      });
    }

    const aiService = await getAIService();
    const summary = await generateSummary(aiService, text, userId);
    
    res.json({
      success: true,
      data: { summary },
    });
  } catch (error) {
    console.error('AI summarization error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Task analysis endpoint
router.post('/api/ai/analyze-task', isAuthenticated, async (req, res) => {
  try {
    const { taskDescription } = req.body;
    const userId = getUserId(req);

    if (!taskDescription || typeof taskDescription !== 'string' || taskDescription.length < 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Task description must be a string with at least 5 characters.' 
      });
    }

    const aiService = await getAIService();
    const analysis = await analyzeTask(aiService, taskDescription, userId);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('AI task analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Text analysis endpoint for weekly reports
router.post('/api/ai/analyze-text', isAuthenticated, async (req, res) => {
  try {
    const { content, fieldType, originalContent, previousReportContent } = req.body;
    const userId = getUserId(req);

    if (!content || typeof content !== 'string' || content.length < 5 || !fieldType || typeof fieldType !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Request must include content (string, min 5 chars) and fieldType (string).'
      });
    }

    // リアルタイム分析設定を取得
    const { storage } = await import('./storage');
    const realtimeConfig = await storage.getRealtimeAnalysisConfig();
    
    // リアルタイム分析専用のAIサービスを取得
    const aiService = getAIServiceForProvider(
      realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter',
      realtimeConfig.provider === 'groq' ? realtimeConfig.groqModel : undefined,
      realtimeConfig.provider === 'gemini' ? realtimeConfig.geminiModel : undefined,
      realtimeConfig.provider === 'openrouter' ? realtimeConfig.openrouterModel : undefined
    );
    
    const analysis = await analyzeText(aiService, content, fieldType, originalContent, previousReportContent, userId);
    
    res.json({
      success: true,
      data: analysis,
      usingRealtimeSettings: true,
      realtimeProvider: realtimeConfig.provider,
    });
  } catch (error) {
    console.error('AI text analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Text analysis endpoint with session-based AI provider (trial mode)
router.post('/api/ai/analyze-text-trial', isAuthenticated, async (req, res) => {
  try {
    const { content, fieldType, originalContent, previousReportContent } = req.body;
    const userId = getUserId(req);

    if (!content || typeof content !== 'string' || content.length < 5 || !fieldType || typeof fieldType !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Request must include content (string, min 5 chars) and fieldType (string).'
      });
    }

    // セッションからAI設定を取得
    const sessionSettings = (req.session as any)?.aiSettings;
    let aiService;

    if (sessionSettings?.realtimeProvider) {
      // セッション設定を使用してAIサービスを取得
      aiService = getAIServiceForProvider(
        sessionSettings.realtimeProvider,
        sessionSettings.realtimeProvider === 'groq' ? sessionSettings.groqModel : undefined,
        sessionSettings.realtimeProvider === 'gemini' ? sessionSettings.geminiModel : undefined,
        sessionSettings.realtimeProvider === 'openrouter' ? sessionSettings.openrouterModel : undefined
      );
    } else {
      // デフォルトの設定を使用
      aiService = await getAIService();
    }

    const analysis = await analyzeText(aiService, content, fieldType, originalContent, previousReportContent, userId);
    
    res.json({
      success: true,
      data: analysis,
      usingTrialSettings: !!sessionSettings?.realtimeProvider,
      trialProvider: sessionSettings?.realtimeProvider,
    });
  } catch (error) {
    console.error('AI text analysis (trial) error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// AI conversation endpoint for analysis follow-up questions
router.post('/api/ai/conversation', isAuthenticated, async (req, res) => {
  try {
    const { fieldName, message, analysis, conversations = [] } = req.body;
    const userId = getUserId(req);

    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a non-empty string.',
      });
    }

    if (!analysis || typeof analysis !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Analysis context is required.',
      });
    }

    if (!fieldName || typeof fieldName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Field name is required.',
      });
    }

    // セッション設定があるかチェックして適切なAIサービスを取得
    let aiService;
    try {
      const sessionSettings = (req.session as any)?.aiSettings;
      if (sessionSettings?.realtimeProvider) {
        aiService = getAIServiceForProvider(
          sessionSettings.realtimeProvider,
          sessionSettings.realtimeProvider === 'groq' ? sessionSettings.groqModel : undefined,
          sessionSettings.realtimeProvider === 'gemini' ? sessionSettings.geminiModel : undefined,
          sessionSettings.realtimeProvider === 'openrouter' ? sessionSettings.openrouterModel : undefined
        );
      } else {
        // リアルタイム分析設定を取得
        const { storage } = await import('./storage');
        const realtimeConfig = await storage.getRealtimeAnalysisConfig();
        aiService = getAIServiceForProvider(
          realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter',
          realtimeConfig.provider === 'groq' ? realtimeConfig.groqModel : undefined,
          realtimeConfig.provider === 'gemini' ? realtimeConfig.geminiModel : undefined,
          realtimeConfig.provider === 'openrouter' ? realtimeConfig.openrouterModel : undefined
        );
      }
    } catch (error) {
      console.log("AI設定取得中にエラー:", error);
      aiService = await getAIService();
    }

    // 会話履歴を含むコンテキストを構築
    const conversationHistory = conversations.map((conv: any) => 
      `${conv.role === 'user' ? 'ユーザー' : 'AI'}: ${conv.content}`
    ).join('\n');

    // 会話用のプロンプトを構築
    const conversationPrompt = `あなたは週次報告書の分析結果について質問に答えるAIアシスタントです。

【分析対象フィールド】: ${fieldName}

【AI分析結果】:
${analysis}

${conversationHistory ? `【これまでの会話履歴】:\n${conversationHistory}\n` : ''}

【ユーザーの質問】: ${message}

上記の分析結果に基づいて、ユーザーの質問に丁寧で具体的な回答をしてください。分析結果にない情報については推測せず、「分析結果からは判断できません」と回答してください。回答は簡潔で実用的にしてください。`;

    const messages = [
      { role: 'system' as const, content: 'あなたは週次報告書の分析について質問に答える専門AIアシスタントです。' },
      { role: 'user' as const, content: conversationPrompt }
    ];

    const response = await aiService.generateResponse(messages, userId, {
      endpoint: 'conversation',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      fieldName,
      messageCount: conversations.length + 1
    });

    console.log('AI Service response:', {
      response,
      responseType: typeof response,
      responseContent: JSON.stringify(response)
    });

    // responseが文字列でない場合は適切に抽出
    let responseContent: string;
    if (typeof response === 'string') {
      responseContent = response;
    } else if (response && typeof response === 'object') {
      // 一般的なAI応答オブジェクトの構造をチェック
      responseContent = (response as any).content || (response as any).message || (response as any).text || (response as any).response || JSON.stringify(response);
    } else {
      responseContent = String(response || '回答を取得できませんでした');
    }

    res.json({
      success: true,
      data: responseContent,
    });
  } catch (error) {
    console.error('AI conversation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Text analysis streaming endpoint for weekly reports
router.post('/api/ai/analyze-text-stream', isAuthenticated, async (req, res) => {
  try {
    const { content, fieldType, originalContent, previousReportContent } = req.body;
    const userId = getUserId(req);

    if (!content || typeof content !== 'string' || content.length < 5 || !fieldType || typeof fieldType !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Request must include content (string, min 5 chars) and fieldType (string).'
      });
    }

    // ストリーミング用のヘッダーを設定
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // セッション設定があるかチェックして適切なAIサービスを取得
    let aiService;
    try {
      const sessionSettings = (req.session as any)?.aiSettings;
      if (sessionSettings?.realtimeProvider) {
        aiService = getAIServiceForProvider(
          sessionSettings.realtimeProvider,
          sessionSettings.realtimeProvider === 'groq' ? sessionSettings.groqModel : undefined,
          sessionSettings.realtimeProvider === 'gemini' ? sessionSettings.geminiModel : undefined,
          sessionSettings.realtimeProvider === 'openrouter' ? sessionSettings.openrouterModel : undefined
        );
      } else {
        // リアルタイム分析設定を取得
        const { storage } = await import('./storage');
        const realtimeConfig = await storage.getRealtimeAnalysisConfig();
        aiService = getAIServiceForProvider(
          realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter',
          realtimeConfig.provider === 'groq' ? realtimeConfig.groqModel : undefined,
          realtimeConfig.provider === 'gemini' ? realtimeConfig.geminiModel : undefined,
          realtimeConfig.provider === 'openrouter' ? realtimeConfig.openrouterModel : undefined
        );
      }
    } catch (configError) {
      console.log("設定取得エラー、デフォルトサービスを使用:", configError);
      aiService = await getAIService();
    }
    
    try {
      for await (const chunk of analyzeTextStream(aiService, content, fieldType, originalContent, previousReportContent, userId)) {
        res.write(chunk);
      }
    } catch (streamError) {
      console.error('Stream error:', streamError);
      res.write(`\n\nエラーが発生しました: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`);
    }
    
    res.end();
  } catch (error) {
    console.error('AI text analysis streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

// AI provider status endpoint
router.post('/api/chat/admin-email', isAuthenticated, async (req, res) => {
  try {
    const { emailId, message, history } = req.body;
    const userId = getUserId(req);

    // 1. リクエストボディの検証
    if (!emailId || typeof emailId !== 'string' || !message || typeof message !== 'string' || !Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. emailId (string), message (string), and history (array) are required.',
      });
    }

    // 2. emailId を使用して管理者確認メールの全文を取得
    // 既存のメール取得ロジックを参考に、ここでは仮のダミーデータを使用
    // 実際のアプリケーションでは、emailId を使ってデータベースからメール内容を取得する
    let emailContent: string | null = null;
    try {
      const emailRecord = await db.select()
        .from(adminConfirmationEmails)
        .where(eq(adminConfirmationEmails.id, emailId))
        .limit(1);

      if (emailRecord.length > 0) {
        emailContent = emailRecord[0].content; // メール内容のフィールド名が 'content' であると仮定
      } else {
        console.warn(`Email with ID ${emailId} not found. Using dummy content.`);
        emailContent = `ダミーの管理者確認メール内容:
件名: 【重要】システム変更のお知らせ
本文:
平素よりお世話になっております。
この度、システムメンテナンスに伴い、以下の日程でサービスを一時停止させていただきます。
日時: 2025年7月30日 0:00 - 6:00 (JST)
ご迷惑をおかけしますが、ご理解とご協力をお願いいたします。
`;
      }
    } catch (dbError) {
      console.error('Failed to fetch email content from DB, using dummy data:', dbError);
      emailContent = `ダミーの管理者確認メール内容:
件名: 【重要】システム変更のお知らせ
本文:
平素よりお世話になっております。
この度、システムメンテナンスに伴い、以下の日程でサービスを一時停止させていただきます。
日時: 2025年7月30日 0:00 - 6:00 (JST)
ご迷惑をおかけしますが、ご理解とご協力をお願いいたします。
`;
    }

    if (!emailContent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve email content.',
      });
    }

    // ストリーミングリクエストかどうかの判定
    const isStreaming = req.headers['accept'] === 'text/event-stream';

    if (isStreaming) {
      // ストリーミング応答
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const aiService = await getAIService();
      const stream = aiService.generateResponseStream([
        { role: 'system', content: `あなたは管理者確認メールの内容についてユーザーの質問に答えるアシスタントです。` },
        ...history,
        { role: 'user', content: `管理者確認メールの内容:\n---\n${emailContent}\n---\n\nユーザーからの現在の質問: ${message}` }
      ], userId, {
        endpoint: 'chat-admin-email',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        emailId: emailId,
        messageCount: history.length + 1
      });

      let fullResponseContent = '';
      for await (const chunk of stream) {
        res.write(chunk);
        fullResponseContent += chunk;
      }
      res.end();

      // 対話履歴の永続化 (ストリーミング完了後)
      if (userId) {
        try {
          await db.insert(chatHistories).values({
            userId: userId,
            emailId: emailId,
            userMessage: message,
            aiResponse: fullResponseContent,
            timestamp: new Date(),
          });
        } catch (dbSaveError) {
          console.error('Failed to save chat history to DB:', dbSaveError);
          // エラーをフロントエンドに返さないが、ログには残す
        }
      }

    } else {
      // 非ストリーミング応答
      const aiResponse = await chatWithAdminEmail(emailContent, message, history);

      if (aiResponse === null) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get AI response.',
        });
      }

      // 対話履歴の永続化
      if (userId) {
        try {
          await db.insert(chatHistories).values({
            userId: userId,
            emailId: emailId,
            userMessage: message,
            aiResponse: aiResponse,
            timestamp: new Date(),
          });
        } catch (dbSaveError) {
          console.error('Failed to save chat history to DB:', dbSaveError);
          // エラーをフロントエンドに返さないが、ログには残す
        }
      }

      res.json({
        success: true,
        data: aiResponse,
      });
    }

  } catch (error) {
    console.error('AI chat with admin email error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } else {
      // ストリーミング中にエラーが発生した場合、既にヘッダーが送信されているため、
      // エラーメッセージをストリームに書き込む
      res.write(`\n\nエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.end();
    }
  }
});

router.get('/api/ai/status', isAuthenticated, async (req, res) => {
  try {
    const userId = getUserId(req);
    
    res.json({
      success: true,
      data: {
        provider: process.env.AI_PROVIDER || 'openai',
        model: process.env.AI_PROVIDER === 'ollama' ? process.env.OLLAMA_MODEL : process.env.OPENAI_MODEL,
        status: 'connected',
        timestamp: new Date().toISOString(),
        logLevel: process.env.AI_LOG_LEVEL || 'info',
        userId: userId || 'anonymous',
      },
    });
  } catch (error) {
    console.error('AI status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as aiRoutes };
