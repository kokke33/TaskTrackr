# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the configuration file for Claude Code in the TaskTrackr project. This file provides guidance for Claude Code when working with this repository.

## Update History
- **2025/1/30**: Full documentation update, reflecting the latest tech stack and features
- **Late 2024**: AI provider expansion (5 supported), test infrastructure built

## Knowledge Management System

This project systematically manages knowledge with the following file structure:

- **CLAUDE.md** (This file) - Project overview and development guide
- **.claude/context.md** - Project background and constraints
- **.claude/project-knowledge.md** - Technical insights and patterns
- **.claude/project-improvements.md** - Improvement history and lessons learned
- **.claude/common-patterns.md** - Frequently used command patterns
- **.claude/debug-log.md** - Important debug records
- **.claude/debug/** - Session-specific logs and archives
- **.claude/commands/** - Command-related records
- **.claude/settings.local.json** - Claude Code local settings

This system aims to continuously accumulate and share project knowledge, improving development efficiency and quality.

## Global Settings
- All responses must be in Japanese
- YOU MUST always respond in Japanese

## Development Commands

### Basic Development Commands
- `npm run dev` - Start development server (Express backend serves frontend on localhost:5000)
- `npm run build` - Production build (Vite frontend + ESBuild backend)
- `npm start` - Start production server
- `npm run check` - TypeScript type check (Note: currently type errors in forms)
- `npm run db:push` - Push database schema changes using Drizzle Kit
- `tsx server/index.ts` - Direct server execution (for debugging)
- `npx drizzle-kit push` - Manual database schema push

### Test Commands
- `npm test` - Run all tests (unit + integration tests)
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:watch` - Watch mode (during development)
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Display test results in browser
- `npm test tests/unit/server/basic.test.ts` - Run specific file tests
- `npm test button` - Run tests by pattern matching
- `npm test -- --reporter=verbose` - Run tests with detailed logs

### Important: Integrated Server Design
- **Unified Port Configuration**: During development, a single Express server serves both frontend and backend on port 5000.
- **No Separate Startup**: There are no commands to start frontend and backend separately.
- **Build Output**: Frontend outputs to `dist/public/`, backend to `dist/index.js`.

### Known Issues (as of January 2025)
TypeScript checks currently fail with the following form value type errors:
- `client/src/pages/weekly-report.tsx` - Textarea component receives `null` values
- `server/routes.ts` - User object property access issues

**Workaround**: Use `value={field.value ?? ""}` pattern for form fields.

## Architecture Overview

### Tech Stack (Latest as of January 2025)
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Wouter (routing)
- **Backend**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **Authentication**: Passport.js session-based authentication + automatic fallback (PostgreSQL → MemoryStore)
- **UI**: Shadcn/ui components (Radix UI primitives) - 48+ components available
- **State Management**: TanStack Query (React Query v5.60.5)
- **AI Integration**: Full support for 5 providers (OpenAI, Ollama, Google Gemini, Groq, OpenRouter)
- **Form Handling**: React Hook Form + Zod validation
- **Styling**: TailwindCSS + Tailwind Animate + class-variance-authority
- **Testing**: Vitest 3.2.4 + React Testing Library + MSW + Supertest + Happy DOM (51 tests)
- **WebSocket**: Real-time communication (ws v8.18.0)
- **Logging**: Winston + daily-rotate-file (AI-specific logging)

### Project Structure
```
TaskTrackr/
├── client/src/           # React Frontend
│   ├── components/       # Reusable React components
│   │   ├── ui/          # Shadcn/ui components (48+ components)
│   │   ├── ai-analysis-result.tsx      # AI analysis result display
│   │   ├── case-selector-modal.tsx     # Case selection modal
│   │   ├── previous-report-tooltip.tsx # Previous report comparison feature
│   │   └── search-bar.tsx              # Full-text search feature
│   ├── pages/           # Route components (Wouter routing)
│   ├── lib/             # Utilities and authentication helpers
│   │   ├── auth.tsx     # Authentication context
│   │   ├── queryClient.ts # API request common processing
│   │   └── utils.ts     # Utility functions
│   ├── hooks/           # Custom React hooks
│   │   ├── use-ai-analysis.ts # AI analysis hook
│   │   └── use-toast.ts       # Toast notification hook
│   └── utils/           # Other utilities
├── server/              # Express Backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database operations (Drizzle ORM)
│   ├── ai-service.ts    # AI provider abstraction
│   ├── ai-logger.ts     # AI interaction logs
│   ├── ai-routes.ts     # AI-specific routes
│   ├── auth.ts          # Passport.js authentication settings
│   ├── config.ts        # Configuration validation
│   ├── db.ts            # Database connection settings
│   ├── migrations/      # Database migration files
│   └── prompts/         # AI Prompt templates
│       ├── config/      # Configuration prompts
│       ├── core/        # Core prompts
│       └── reports/     # Report prompts
├── shared/              # Shared TypeScript type definitions
│   └── schema.ts        # Drizzle ORM schema definition
├── tests/               # Test files
│   ├── unit/           # Unit tests
│   │   ├── client/     # Frontend tests
│   │   └── server/     # Backend tests
│   ├── integration/    # Integration tests
│   ├── __fixtures__/   # Test data
│   ├── __mocks__/      # MSW mocks
│   ├── utils/          # Test utilities
│   └── setup.ts        # Test environment setup
├── .claude/             # Claude Code Knowledge Management
│   ├── context.md       # Project context
│   ├── project-knowledge.md # Technical knowledge
│   └── common-patterns.md   # Common patterns
```

### Database Schema
Key entities managed by Drizzle ORM:
- **users** - Authentication and role-based access (admin/general)
- **projects** - High-level project information with detailed tracking fields
- **cases** - Specific cases/tasks within a project
- **weeklyReports** - Comprehensive weekly status reports linked to cases
- **managerMeetings** - Meeting minutes and records linked to projects
- **weeklyReportMeetings** - Meeting records linked to weekly reports
- **systemSettings** - Application settings

### Important Architecture Patterns

#### API Client Pattern
All API calls use `apiRequest(url, { method, data? })` in `client/src/lib/queryClient.ts`:
- Always includes `credentials: "include"` for session cookies
- Handles 401 errors with detailed logging
- Returns typed responses with `throwIfResNotOk` error handling

#### Authentication Flow
- Passport.js based session authentication using PostgreSQL session store
- Fallback to MemoryStore for Neon.tech compatibility
- `isAuthenticated` and `isAdmin` middleware protect routes
- Authentication context in `client/src/lib/auth.tsx` manages user state

#### Database Access Pattern
All database operations are executed via `server/storage.ts`, including:
- Automatic retry logic with `withRetry()` function
- Connection pooling and error handling
- Consistent interface abstraction for Drizzle ORM
- Soft delete pattern (isDeleted flag)

#### AI Service Architecture
The abstract `AIService` class in `server/ai-service.ts` supports multiple providers:
- OpenAI, Ollama, Google Gemini, Groq, OpenRouter implementations
- Comprehensive logging via `ai-logger.ts`
- Content cleaning (removes `<think>` tags, markdown blocks)
- Token usage tracking and request ID generation
- Dynamic configuration via `getDynamicAIConfig()`

#### Form Handling Pattern
- React Hook Form + Zod validation used throughout
- Shared schema in `shared/schema.ts` using `drizzle-zod`
- Known issue: forms expect non-null values but DB fields are nullable
- Debounced auto-save feature for weekly reports

### Key Features
- **Full-text search** and suggestion functionality across projects, cases, and reports
- **AI integration** for text summarization and real-time analysis
- **Role-based access control** (admin/general user)
- **Session management** with PostgreSQL storage
- **Comprehensive form handling** with React Hook Form + Zod validation
- **Previous report comparison tooltip** for weekly report editing
- **Case selection modal** with project-based filtering and history feature

## Environment Configuration

Required environment variables:
```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr

# Session
SESSION_SECRET=your-session-secret

# AI Provider
AI_PROVIDER=openai  # or "ollama", "gemini", "groq", "openrouter"
AI_LOG_LEVEL=info   # debug, info, warn, error (automatically set to warn in production)
AI_LOG_CONSOLE=true # automatically set to false in production
AI_LOG_FILE=false   # set to true to enable file logging
AI_LOG_MASK_SENSITIVE=true  # enable masking of sensitive data

# OpenAI (if used)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=10000
OPENAI_TEMPERATURE=0.7

# Ollama (if used)
OLLAMA_BASE_URL=http://localhost:11434/
OLLAMA_MODEL=qwen3:latest

# Gemini (if used)
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash

# Groq (if used)
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.1-70b-versatile

# OpenRouter (if used)
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # or "anthropic/claude-sonnet-4", "google/gemini-2.0-flash-001", "google/gemini-2.5-flash", "google/gemini-2.5-pro"
OPENROUTER_MAX_TOKENS=4000
OPENROUTER_TEMPERATURE=0.7

# Development Environment Settings
PORT=3000
NODE_ENV=development
```

## Development Patterns

### Adding New Database Fields
1. Update schema in `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update TypeScript types and forms as needed
4. Handle nullable fields appropriately in components

### Adding New API Routes
1. Add route handler in `server/routes.ts`
2. Add corresponding storage method in `server/storage.ts`
3. Use `isAuthenticated`/`isAdmin` middleware for protection
4. Update frontend hooks/queries for data fetching

### Component Development
- Use Shadcn/ui components in `client/src/components/ui/`
- Follow existing patterns in `client/src/components/`
- Implement proper TypeScript typing and error handling
- Use PreviousReportTooltip for form fields with historical data

### AI Integration
- Use the abstract AIService pattern for new AI features
- Log all AI interactions via aiLogger
- Clean content with cleanThinkTags method
- Handle provider switching via configuration

### Form Development Pattern
```typescript
// React Hook Form + Zod Validation
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";

const form = useForm<z.infer<typeof insertProjectSchema>>({
  resolver: zodResolver(insertProjectSchema),
  defaultValues: {
    name: "",
    overview: "",
    // Handle null values: value={field.value ?? ""}
  },
});
```

## Special Configurations

### Database Compatibility
- **Neon.tech Support**: Automatic fallback to MemoryStore if PostgreSQL session fails
- **Connection Retry Logic**: Gracefully handles connection failures in storage operations
- **Migration System**: Uses Drizzle Kit for schema versioning

### Build Configuration
- **Hybrid Build System**: Frontend built with Vite, backend with ESBuild
- **Path Aliases**: `@/` for client code, `@shared/` for shared types
- **Development Server**: Single `npm run dev` command runs both frontend and backend
- **Output**: Frontend to `dist/public/`, backend to `dist/index.js`
- **TypeScript Configuration**: Fast compilation with incremental build and tsBuildInfoFile
- **Module Resolution**: Bundler method with allowImportingTsExtensions enabled

### Authentication Features
- **Initial User Creation**: Automatic admin user setup on first run (admin/password)
- **Session Debugging**: Development middleware for session troubleshooting
- **Role-Based Middleware**: `isAuthenticated` and `isAdmin` guards for API routes

## Important Implementation Notes

### Form Null Value Handling
Known TypeScript issue: Database fields are nullable but React components expect non-null values. Use `value={field.value ?? ""}` pattern for TextAreas.

### API Request Pattern
Always use `apiRequest(url, { method: "GET"|"POST"|"PUT"|"DELETE", data? })` - do not call `fetch` directly.

### AI Analysis Integration
Weekly report fields automatically trigger AI analysis on blur only for the first edit. Subsequent edits require manual regeneration via a button. Use `analyzeField(fieldName, content, originalContent?, previousReportContent?)` pattern. The `hasRunAnalysis` flag in `useAIAnalysis` hook tracks the first run.

### Previous Report Data
Use `latestReport` from weekly report queries for historical comparison. Reports are fetched via `/api/weekly-reports/previous/:caseId` endpoint based on case and date relationships.

### Configuration Key Name Consistency
Real-time analysis configuration uses `REALTIME_PROVIDER` key (not `REALTIME_AI_PROVIDER`). Ensure consistency across screen display, DB storage, and server loading.

### AI Logging Features
AI service logs are automatically optimized in production environments:
- Log level automatically set to WARNING
- Console logging automatically disabled
- Large response bodies truncated to 1000 characters
- API keys automatically masked (OpenAI, Groq, Gemini, OpenRouter supported)
- Request data cached and reused in response/error logs

### Streaming Support
Supports real-time streaming for some AI providers:
- **Gemini**: Streaming supported with `generateStreamResponse` method
- **OpenAI**: Provides streaming functionality by default
- Managed in frontend `streamingSupportedProviders` array

### Admin Confirmation Email Feature
Automatically generates confirmation emails for administrators when weekly reports are created:
- Email content generated in `generate-admin-confirmation-email.usecase.ts`
- Administrators can review and regenerate emails on the report detail page
- Regenerate via `/api/weekly-reports/:id/regenerate-admin-email` endpoint

## Debugging and Troubleshooting

### Common Issues and Solutions

#### 1. TypeScript Type Errors
```bash
# Run type check
npm run check

# Known issues:
# - TextArea null value error in client/src/pages/weekly-report.tsx
# - User object property access in server/routes.ts
```

#### 2. Database Connection Errors
```bash
# Push schema
npm run db:push

# Check connection
# Verify DATABASE_URL environment variable
# Check connection status to PostgreSQL/Neon.tech
```

#### 3. Debugging AI Features
```bash
# Check AI logs
# Set AI_LOG_LEVEL=debug in environment variables
# Enable console output with AI_LOG_CONSOLE=true

# Provider-specific troubleshooting:
# - OpenAI: Check API key and usage limits
# - Ollama: Check local server status
# - Gemini: Check API key and regional restrictions
# - Groq: Check API key and rate limits
```

#### 4. Session Authentication Errors
```bash
# Check session storage
# Check status of PostgreSQL session table
# Verify MemoryStore fallback behavior
```

### Development Server Restart Procedure
```bash
# Full restart (recommended)
npm run dev

# Note: No separate startup commands exist
# npm run dev starts the integrated server on localhost:5000
```

### Development Port Configuration
- **Development Server**: `localhost:5000` - Integrated server (frontend + backend)
- **Production Server**: Specified by `PORT` environment variable (default 5000)
- **Database**: PostgreSQL standard port 5432 or Neon.tech

### Performance Monitoring
- Use React Query DevTools to check cache status
- Monitor API calls in browser's Network tab
- Check AI analysis processing response times in `ai-logger.ts`
- Monitor database query performance

## Knowledge Management and Continuous Improvement

### Knowledge Recording Locations
- **.claude/context.md** - Project background and constraint information
- **.claude/project-knowledge.md** - Technical insights and implementation patterns
- **.claude/project-improvements.md** - Improvement history and lessons learned
- **.claude/common-patterns.md** - Frequently used commands and patterns
- **.claude/debug-log.md** - Important debug records

### Continuous Improvement Process
1. **Discovery of new technical patterns** → Record in `.claude/project-knowledge.md`
2. **Problem-solving procedures** → Record in `.claude/debug-log.md`
3. **Improved implementations** → Record in `.claude/project-improvements.md`
4. **Frequently used commands** → Record in `.claude/common-patterns.md`

## Testing and Deployment

### Initial User Creation
An administrator user is automatically created on first run:
- **Username**: `admin`
- **Password**: `password`

### Test Execution
A comprehensive testing infrastructure has been built:

#### Basic Test Execution
```bash
npm test                    # Run all tests (51 tests)
npm run test:unit          # Unit tests (26 tests)
npm run test:integration   # Integration tests (25 tests)
npm run test:watch         # Watch mode (during development)
npm run test:coverage      # Generate coverage report
```

#### Individual Test Execution
```bash
npm test tests/unit/server/basic.test.ts    # Specific file
npm test button                             # Pattern match
npm test -- --reporter=verbose             # Detailed logs
```

#### Test Environment
- **Test Framework**: Vitest 3.2.4
- **React Testing**: React Testing Library 16.3.0
- **Mocking**: MSW (Mock Service Worker)
- **Coverage**: @vitest/coverage-v8
- **Current Coverage**: 1.06% (foundation building complete)

#### CI/CD Integration
- Automated test execution with GitHub Actions
- Node.js 18.x, 20.x matrix testing
- PostgreSQL database service
- Codecov coverage report

### Quality Checks
```bash
npm run check    # TypeScript type check
npm run build    # Build error check
npm test         # Run all tests
```

## Security and Best Practices

### Authentication and Session Management
- Adopts Passport.js for session-based authentication
- Uses PostgreSQL session store (falls back to MemoryStore in Neon.tech environment)
- Proper management of session expiration and cookie settings
- Initial administrator account (admin/password) must be changed in production

### Database Security
- Drizzle ORM for protection against query injection
- Input validation with appropriate validation (Zod)
- Data protection with soft delete pattern (isDeleted flag)

### AI Integration Security
- Environment variable management and automatic masking of API keys
- Protection against prompt injection
- Content cleaning of AI responses (removes `<think>` tags)

## Performance Optimization Guide

### Frontend Optimization
- Appropriate caching strategy with React Query (2-5 minutes)
- Proper component splitting and rendering optimization
- Search limits (20 items) and pagination for large datasets

### Backend Optimization
- Database query optimization (fetching minimum required fields)
- Resolution of N+1 problems (batch data fetching)
- Reduced response times with parallel AI processing (30-50% improvement)

## Test Development Patterns

### Creating New Tests
1. **Unit Tests**: `tests/unit/[client|server]/component.test.ts`
2. **Integration Tests**: `tests/integration/feature.test.ts`
3. **Test Data**: Add to `tests/__fixtures__/testData.ts`
4. **Mocks**: Add MSW handlers in `tests/__mocks__/handlers.ts`

### Test Best Practices
- Component testing with React Testing Library's `render()`
- User interactions with `userEvent.setup()`
- Mock external dependencies with `vi.mock()`
- Assert DOM element presence with `expect().toBeInTheDocument()`
- Properly await asynchronous operations with `waitFor()`

### Test Environment Setup
- `.env.test`: Environment variables for testing
- `tests/setup.ts`: Global test setup
- `vitest.config.ts`: Vitest configuration and aliases
- `tests/utils/testUtils.tsx`: Custom render function

Refer to `TESTING.md` for more details.
