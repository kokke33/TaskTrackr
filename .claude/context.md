# TaskTrackr Project Context

## Project Overview
TaskTracker is a full-stack TypeScript application that provides unified management of projects, cases, and weekly reports, featuring AI analysis, meeting minute generation, and performance optimization capabilities.

## Tech Stack (Latest as of January 2025)
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Wouter (routing)
- **Backend**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **Authentication**: Passport.js (session-based) + automatic fallback
- **UI**: Shadcn/ui (48+ components available) + Radix UI primitives
- **State Management**: TanStack Query (React Query v5.60.5)
- **AI Integration**: 5 providers supported (OpenAI, Ollama, Gemini, Groq, OpenRouter)
- **WebSocket**: Real-time features (ws v8.18.0)
- **Testing**: Vitest 3.2.4 + React Testing Library + MSW + Supertest

## Project Goals
- Build comprehensive task and project management system
- Provide AI-powered document summarization and analysis
- Implement role-based access control (admin/general users)
- Enable full-text search across projects, cases, and reports
- Deliver detailed weekly reporting with progress tracking

## Key Constraints

### Architecture Constraints
- **Integrated Server Design**: No separate frontend/backend startup commands exist
- **Session-Based Auth**: Uses PostgreSQL → MemoryStore automatic fallback, not JWT
- **PostgreSQL Dependency**: Neon.tech compatible + connection retry logic implemented

### Technical Constraints
- **TypeScript Type Errors**: Form null value handling (known issues)
  - `client/src/pages/weekly-report.tsx` Textarea handling
  - `server/routes.ts` user object access
- **Drizzle ORM**: Schema management and migrations required
- **RESTful API**: Express.js + lightweight API implementation

### Operational Constraints
- **Development**: `npm run dev` starts integrated server (port 5000)
- **Production**: Vite (frontend → dist/public/) + ESBuild (backend → dist/index.js)
- **Database**: `npm run db:push` for Drizzle Kit migrations
- **Testing**: 51 tests (currently 1.06% coverage, foundation complete)

## Technology Choice Rationale

### React + Wouter
- Chose Wouter as lightweight routing library alternative
- Prioritized lightweight, simple implementation over React Router

### Drizzle ORM
- Selected for type safety emphasis
- Strong PostgreSQL compatibility
- Simplified migration management

### TanStack Query
- Server state management optimization
- Improved caching strategies
- Efficient API data fetching

### Shadcn/ui
- Consistent design system
- High-quality Radix UI-based components
- Balance of customization and maintainability

## Current Key Features (January 2025)

### Core Features
- **Integrated project/case/weekly report management**
- **Full-text search** (20 item limit for performance)
- **Role-based access control** (admin/general users)
- **Real-time auto-save** + WebSocket communication

### AI Features (5 providers supported)
- **Weekly report AI analysis** (field-by-field analysis, real-time config)
- **Automatic meeting minute generation** (including admin confirmation emails)
- **Parallel AI processing for admin edits** (30-50% speed improvement)
- **Streaming support** (Gemini, OpenAI)

### UI/UX Improvements
- **Modal case selection** (project-specific/recent/all cases tabs)
- **Previous report comparison tooltips**
- **Responsive design** (TailwindCSS + Shadcn/ui)

### Performance Optimizations
- **Lightweight API** (minimal required fields only)
- **React Query optimization** (2-5 minute caching)
- **N+1 problem resolution** (batch data fetching)
- **Database index optimization**

## Environment Requirements
- **Node.js**: v20.x+ (TypeScript 5.6.3)
- **Database**: PostgreSQL 15+ or Neon.tech
- **AI Providers**: One or more of:
  - OpenAI (GPT-4o-mini recommended)
  - Google Gemini (2.5-Flash recommended)
  - Groq (Llama-3.3-70B)
  - Ollama (local execution)
  - OpenRouter (Claude-3.5-Sonnet)
- **Session Secret Key**
- **Log Configuration**: AI_LOG_LEVEL (debug/info/warn/error)

## Development Team Structure
- **Personal development project**
- **Claude Code development assistance**
- **Japanese communication required**
- **Continuous knowledge management** (`.claude/` directory system)