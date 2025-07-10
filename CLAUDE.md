# CLAUDE.md

TaskTrackrプロジェクトのClaude Code用設定ファイルです。このファイルは、Claude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## 知識管理システム

このプロジェクトでは、以下のファイル構成で知識を体系的に管理しています：

- **CLAUDE.md** (このファイル) - プロジェクト概要と開発ガイド
- **.claude/context.md** - プロジェクトの背景と制約
- **.claude/project-knowledge.md** - 技術的な洞察とパターン
- **.claude/project-improvements.md** - 改善履歴と学習内容
- **.claude/common-patterns.md** - よく使うコマンドパターン
- **.claude/debug-log.md** - 重要なデバッグ記録
- **.claude/debug/** - セッション固有のログとアーカイブ

このシステムにより、プロジェクトの知識を継続的に蓄積・共有し、開発効率と品質の向上を目指しています。

# グローバル設定
- すべての応答は日本語で行ってください
- YOU MUST always respond in Japanese


## Development Commands

### Core Development
- `npm run dev` - Start development server (Express backend on localhost:3000)
- `npm run build` - Build for production (Vite frontend + ESBuild backend)
- `npm start` - Start production server
- `npm run check` - TypeScript type checking (note: currently has type errors in forms)
- `npm run db:push` - Push database schema changes using Drizzle Kit

### Known Issues
The TypeScript check currently fails with form value type errors in:
- `client/src/pages/project-form.tsx` - Textarea components receiving `null` values
- `client/src/pages/weekly-report.tsx` - Similar textarea null value issues
- `server/routes.ts` - User object property access issues

## Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Wouter (routing)
- **Backend**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **Authentication**: Passport.js with session-based auth
- **UI**: Shadcn/ui components (Radix UI primitives) - 48 components available
- **State Management**: TanStack Query (React Query)
- **AI Integration**: Multi-provider support (OpenAI, Ollama, Google Gemini, Groq)

### Project Structure
```
TaskTrackr/
├── client/src/           # React frontend
│   ├── components/       # Reusable React components
│   │   └── ui/          # Shadcn/ui components
│   ├── pages/           # Route components (Wouter routing)
│   ├── lib/             # Utilities and auth helpers
│   └── hooks/           # Custom React hooks
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database operations (Drizzle ORM)
│   ├── ai-service.ts    # AI provider abstraction
│   ├── ai-logger.ts     # AI interaction logging
│   ├── auth.ts          # Passport.js authentication
│   ├── config.ts        # Configuration validation
│   └── migrations/      # Database migration files
├── shared/              # Shared TypeScript types
│   └── schema.ts        # Drizzle ORM schema definitions
```

### Database Schema
Core entities managed by Drizzle ORM:
- **users** - Authentication and role-based access (admin/regular)
- **projects** - High-level project information with detailed tracking fields
- **cases** - Specific cases/tasks within projects
- **weeklyReports** - Comprehensive weekly status reports linked to cases
- **managerMeetings** - Meeting minutes and records linked to projects

### Key Features
- **Full-text search** across projects, cases, and reports with suggestions
- **AI integration** for text summarization and analysis
- **Role-based access control** (admin/regular users)
- **Session management** with PostgreSQL storage
- **Comprehensive form handling** with React Hook Form + Zod validation

## Environment Configuration

Required environment variables:
```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr

# Session
SESSION_SECRET=your-session-secret

# AI Provider
AI_PROVIDER=openai  # or "ollama"
AI_LOG_LEVEL=info
AI_LOG_CONSOLE=true

# OpenAI (if using)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# Ollama (if using)
OLLAMA_BASE_URL=http://localhost:11434/
OLLAMA_MODEL=llama2
```

## Development Patterns

### Form Handling
- Uses React Hook Form with Zod schema validation
- Shared schemas defined in `shared/schema.ts`
- Known issue: Forms handle nullable database fields but components expect non-null values

### API Routes
- RESTful API structure in `server/routes.ts` 
- Protected routes use `isAuthenticated` and `isAdmin` middleware
- Database operations abstracted in `storage.ts`

### Component Architecture
- Shadcn/ui components in `client/src/components/ui/`
- Custom business components in `client/src/components/`
- Page components in `client/src/pages/` using Wouter routing

### AI Service
- Configurable AI providers (OpenAI/Ollama) in `server/ai-service.ts`
- Main endpoints: `/ai/summarize` and `/ai/chat`
- Comprehensive logging system for AI interactions in `server/ai-logger.ts`
- Configuration validation in `server/config.ts`
- Content cleaning and post-processing capabilities
- Token usage monitoring and cost tracking

## Common Tasks

### Adding New Database Fields
1. Update schema in `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update TypeScript types and forms as needed

### Adding New API Routes
1. Add route handler in `server/routes.ts`
2. Add corresponding storage method in `server/storage.ts`
3. Update frontend hooks/queries for data fetching

### Component Development
- Follow existing patterns in `client/src/components/`
- Use Shadcn/ui components from `client/src/components/ui/` (30+ available components)
- Implement proper TypeScript typing and error handling
- Theme support with dark/light mode toggle available

## Special Configuration

### Database Compatibility
- **Neon.tech support**: Automatic fallback to MemoryStore for sessions when PostgreSQL sessions fail
- **Connection retry logic**: Handles connection failures gracefully in storage operations
- **Migration system**: SQL files in `server/migrations/` for schema versioning

### Build Configuration
- **Hybrid build system**: Frontend built with Vite, backend with ESBuild
- **Path aliases**: `@/` for client code, `@shared/` for shared types
- **Development server**: Single `npm run dev` command runs both frontend and backend

### Authentication Features
- **Initial user creation**: Automatic admin user setup on first run
- **Session debugging**: Development middleware for session troubleshooting
- **Role-based middleware**: `isAuthenticated` and `isAdmin` guards for API routes