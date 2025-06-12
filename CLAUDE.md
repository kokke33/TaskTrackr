# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **UI**: Shadcn/ui components (Radix UI primitives)
- **State Management**: TanStack Query (React Query)
- **AI Integration**: OpenAI API / Ollama with configurable providers

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
│   ├── auth.ts          # Passport.js authentication
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
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr
SESSION_SECRET=your-session-secret
AI_PROVIDER=openai  # or "ollama"
OPENAI_API_KEY=sk-...  # if using OpenAI
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
- Comprehensive logging system for AI interactions

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
- Use Shadcn/ui components from `client/src/components/ui/`
- Implement proper TypeScript typing and error handling