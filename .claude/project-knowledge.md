# Project Technical Knowledge

## Architectural Decisions

### Database Design
- **Drizzle ORM + PostgreSQL**: Type-safety focused design
- **Session Storage**: Automatic MemoryStore fallback when PostgreSQL fails
- **Connection Retry Logic**: Graceful handling of connection failures in storage operations
- **Migration System**: Schema management via SQL files in `server/migrations/`

### Authentication System
- **Passport.js + Session-Based Auth**: Session management instead of JWT
- **Initial User Creation**: Automatic admin user setup on first run
- **Role-Based Middleware**: API protection via `isAuthenticated` and `isAdmin` guards

### Frontend Architecture
- **React 18 + TypeScript**: Type-safety focused component development
- **Wouter**: Lightweight routing alternative to React Router
- **TanStack Query**: Server state management and cache strategy optimization
- **Shadcn/ui**: Consistent design system with 30+ components

## Implementation Patterns

### Form Handling Pattern
```typescript
// React Hook Form + Zod Validation
- Shared schema definition in shared/schema.ts
- Note: Nullable database fields vs non-null component values mismatch
- Known issue: TextArea component null value reception error
```

### API Route Design
```typescript
// RESTful API structure in server/routes.ts
- Protected routes using isAuthenticated, isAdmin middleware
- Database operation abstraction in server/storage.ts
- Error handling with proper HTTP status returns
```

### AI Service Integration
```typescript
// Configurable provider in server/ai-service.ts
- Dynamic OpenAI/Ollama switching support
- Comprehensive logging system in server/ai-logger.ts
- Token usage monitoring and cost tracking
- Content cleaning and post-processing
```

## Libraries and Tools

### Main Dependencies
- `@tanstack/react-query`: Server state management
- `react-hook-form`: Form state management
- `zod`: Schema validation
- `drizzle-orm`: Database ORM
- `tailwindcss`: Utility-first CSS
- `radix-ui`: Accessible UI primitives

### Development Tools
- `vite`: Frontend build tool
- `esbuild`: Backend build tool
- `typescript`: Type system
- `drizzle-kit`: Database migrations

## Patterns to Avoid

### Database Operations
- Avoid direct SQL operations (use Drizzle ORM)
- Avoid manual migration execution (use `npm run db:push`)
- Avoid manual session storage configuration

### Frontend
- Avoid excessive global state usage (optimize with TanStack Query)
- Avoid direct DOM manipulation (follow React patterns)
- Avoid inline styling (use TailwindCSS classes)

### API Design
- Avoid excessive nested route structures
- Avoid sensitive data access without authentication
- Avoid exposing detailed information in error responses

## Performance Optimization

### Build Optimization
- **Hybrid Build System**: Vite (frontend) + ESBuild (backend)
- **Path Aliases**: `@/` (client code), `@shared/` (shared types)
- **Development Server**: Single `npm run dev` command for frontend + backend
- **Output**: Frontend to `dist/public/`, backend to `dist/index.js`

### Database Optimization
- **Connection Pooling**: Efficient PostgreSQL connection management
- **Query Optimization**: Type-safe query construction with Drizzle ORM
- **Full-Text Search**: High-performance search functionality

### Frontend Optimization
- **Lazy Loading**: Dynamic imports for components and routes
- **Memoization**: Proper use of React.memo and useMemo
- **Query Cache**: Efficient data management with TanStack Query

## Security Considerations

### Authentication & Authorization
- Session-based state management
- CSRF token implementation considerations
- Password hashing (implementation details need verification)

### Data Protection
- Environment variable-based sensitive information management
- Prohibition of hardcoding API keys or secrets in code
- Prevention of sensitive information exposure in logs

### AI Integration Security
- Safe management of AI provider API keys
- User input sanitization
- AI response content filtering