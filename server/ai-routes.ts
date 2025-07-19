import express from 'express';
import { getAIServiceDynamic, AIMessage } from './ai-service.js';
import { isAuthenticated } from './auth';

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

    const aiService = await getAIServiceDynamic();
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

    const aiService = await getAIServiceDynamic();
    const summary = await aiService.generateSummary(text, userId);
    
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

    const aiService = await getAIServiceDynamic();
    const analysis = await aiService.analyzeTask(taskDescription, userId);
    
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
    const { text } = req.body;
    const userId = getUserId(req);

    if (!text || typeof text !== 'string' || text.length < 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Text must be a string with at least 5 characters.' 
      });
    }

    // リアルタイム分析設定を取得
    const { storage } = await import('./storage');
    const realtimeConfig = await storage.getRealtimeAnalysisConfig();
    
    // リアルタイム分析専用のAIサービスを取得
    const { getAIServiceForProvider } = await import('./ai-service.js');
    const aiService = await getAIServiceForProvider(
      realtimeConfig.provider as 'openai' | 'ollama' | 'gemini' | 'groq' | 'openrouter',
      realtimeConfig.provider === 'groq' ? realtimeConfig.groqModel : undefined,
      realtimeConfig.provider === 'openrouter' ? realtimeConfig.openrouterModel : undefined
    );
    
    const analysis = await aiService.analyzeText(text, userId);
    
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
    const { text } = req.body;
    const userId = getUserId(req);

    if (!text || typeof text !== 'string' || text.length < 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Text must be a string with at least 5 characters.' 
      });
    }

    // セッションからAI設定を取得
    const sessionSettings = (req.session as any)?.aiSettings;
    let aiService;

    if (sessionSettings?.realtimeProvider) {
      // セッション設定を使用してAIサービスを取得
      const { getAIServiceForProvider } = await import('./ai-service.js');
      aiService = await getAIServiceForProvider(
        sessionSettings.realtimeProvider,
        sessionSettings.realtimeProvider === 'groq' ? sessionSettings.groqModel : undefined,
        sessionSettings.realtimeProvider === 'openrouter' ? sessionSettings.openrouterModel : undefined
      );
    } else {
      // デフォルトの設定を使用
      aiService = await getAIServiceDynamic();
    }

    const analysis = await aiService.analyzeText(text, userId);
    
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

// AI provider status endpoint
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
