# TaskTrackr

## Overview

TaskTrackr is a comprehensive full-stack TypeScript project management application that integrates project tracking, case management, and weekly reporting with AI-powered analysis and meeting minute generation. The system features a modern React frontend with Express backend, utilizing PostgreSQL for data persistence and supporting both OpenAI and Ollama AI providers.

## System Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Wouter (routing)
- **Backend**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **Authentication**: Passport.js with session-based authentication
- **UI Components**: Shadcn/ui components (Radix UI primitives)
- **State Management**: TanStack Query (React Query) for server state
- **AI Integration**: Configurable OpenAI API / Ollama providers
- **Styling**: TailwindCSS with custom theme configuration

### Database Architecture
The application uses PostgreSQL with Drizzle ORM for type-safe database operations. Key entities include:

- **Users**: Authentication and role-based access (admin/regular users)
- **Projects**: High-level project information with detailed fields
- **Cases**: Individual cases linked to projects
- **Weekly Reports**: Progress reports with AI analysis capabilities
- **Manager Meetings**: Meeting minutes and documentation
- **Weekly Report Meetings**: Meeting records linked to weekly reports

### Authentication & Authorization
- Session-based authentication using Passport.js with PostgreSQL session store
- Role-based access control with admin and regular user roles
- Protected routes with authentication middleware
- Admin-only features for project and case management

## Key Components

### Frontend Architecture
- **Component-based**: Modular React components with TypeScript
- **Routing**: File-based routing using Wouter for lightweight navigation
- **State Management**: TanStack Query for server state with optimistic updates
- **UI System**: Shadcn/ui component library for consistent design
- **Form Handling**: React Hook Form with Zod validation
- **Real-time Features**: Custom event system for component communication

### Backend Architecture
- **Express Server**: RESTful API with TypeScript
- **Database Layer**: Drizzle ORM with connection pooling and retry logic
- **AI Service Layer**: Abstract AI service supporting multiple providers
- **Authentication Layer**: Passport.js integration with session management
- **Route Protection**: Authentication and authorization middleware

### AI Integration
- **Provider Abstraction**: Configurable AI providers (OpenAI/Ollama)
- **AI Logger**: Comprehensive logging for AI interactions
- **Content Analysis**: Weekly report analysis and meeting minute generation
- **Performance Optimization**: Parallel processing for admin operations

## Data Flow

### Weekly Report Flow
1. User creates/edits weekly reports with case selection
2. Real-time auto-save functionality prevents data loss
3. AI analysis generates insights on progress and issues
4. Meeting minutes can be auto-generated from reports
5. Monthly summaries aggregate multiple reports

### Search and Navigation
1. Global search across projects, cases, and reports
2. Breadcrumb navigation for hierarchical browsing
3. Recently used items for quick access
4. Filter and sorting capabilities

### AI Processing Pipeline
1. Content preprocessing and sanitization
2. Provider-specific API calls with retry logic
3. Response processing and content cleaning
4. Logging and error handling
5. Parallel processing for multiple operations

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL (Neon cloud or local)
- **AI Providers**: OpenAI API or Ollama server
- **UI Libraries**: Radix UI primitives for accessible components
- **Form Validation**: Zod schema validation
- **Date Handling**: date-fns for date manipulation

### Development Tools
- **Build System**: Vite for fast development and building
- **TypeScript**: Full type safety across frontend and backend
- **Database Migrations**: Drizzle Kit for schema management
- **Development Server**: tsx for TypeScript execution

## Deployment Strategy

### Replit Deployment
- Configured for Replit with automatic dependency management
- Environment variable configuration for different stages
- Database connection handling for Neon PostgreSQL
- Session storage optimization for cloud deployment

### Build Process
1. Frontend build: Vite builds React application to `dist/public`
2. Backend build: ESBuild bundles Express server to `dist/index.js`
3. Database migrations: Drizzle Kit handles schema updates
4. Production server: Node.js serves built application

### Environment Configuration
- Configurable AI providers (OpenAI/Ollama)
- Database connection with retry logic for cloud deployment
- Session management with fallback to memory store
- Logging configuration with sensitive data masking

## Changelog

Changelog:
- June 14, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.