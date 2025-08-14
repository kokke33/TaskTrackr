# Common Command Patterns

## Development Environment Startup & Management

### Development Server Startup
```bash
# Start frontend and backend simultaneously
npm run dev

# Production startup
npm run build && npm start

# TypeScript type check
npm run check
```

### Database Operations
```bash
# Apply schema changes
npm run db:push

# Verify database connection
psql $DATABASE_URL -c "\dt"
```

## Common File Search Patterns

### Component-Related Searches
```bash
# Find specific component files
find client/src/components -name "*.tsx" | grep -i "button"

# List UI components
ls client/src/components/ui/

# Check page components
ls client/src/pages/
```

### API & Server-Related Searches
```bash
# Check API routes
grep -r "app\." server/routes.ts

# Check database schema
cat shared/schema.ts | grep -A 5 "export const"

# Check environment variables
grep -r "process.env" server/
```

## Debug & Log Verification Patterns

### Log File Verification
```bash
# Check development server logs
tail -f logs/development.log

# Check AI service logs
grep "AI_" logs/*.log

# Extract error logs
grep -i "error" logs/*.log | tail -20
```

### Process & Port Verification
```bash
# Check development server port usage
lsof -i :3000

# Check Node.js processes
ps aux | grep node
```

## Git Operation Patterns

### Development Flow
```bash
# Create new feature branch
git checkout -b feature/new-feature-name

# Check changes
git status
git diff

# Commit
git add .
git commit -m "feat: description of new feature"

# Merge to main branch
git checkout main
git merge feature/new-feature-name
```

### Troubleshooting
```bash
# Undo changes
git checkout -- filename

# Amend last commit
git commit --amend

# Check specific commit
git show commit-hash
```

## Testing & Quality Check Patterns

### TypeScript Check
```bash
# Check type errors
npm run check 2>&1 | grep "error TS"

# Type check specific file
npx tsc --noEmit client/src/pages/project-form.tsx
```

### Code Quality
```bash
# Run ESLint (if configured)
npx eslint client/src/**/*.{ts,tsx}

# Run Prettier (if configured)
npx prettier --check client/src/**/*.{ts,tsx}
```

## AI Feature Testing Patterns

### AI Service Operation Verification
```bash
# Check OpenAI API key
echo $OPENAI_API_KEY | cut -c1-10

# Check Ollama service
curl http://localhost:11434/api/tags

# Check AI logs
tail -f logs/ai-service.log
```

### API Endpoint Testing
```bash
# Test summarization feature
curl -X POST http://localhost:3000/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"Test text content"}'

# Test chat feature
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

## Database Management Patterns

### Schema Verification
```bash
# Check table list
psql $DATABASE_URL -c "\dt"

# Check specific table structure
psql $DATABASE_URL -c "\d projects"

# Check data count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM projects;"
```

### Backup & Restore
```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20240101.sql
```

## Environment Configuration Patterns

### Environment Variable Configuration Check
```bash
# Check required environment variables
env | grep -E "(DATABASE_URL|SESSION_SECRET|AI_|OPENAI_|OLLAMA_)"

# .env file example
cat << EOF > .env.example
DATABASE_URL=postgres://user:pass@localhost:5432/tasktrackr
SESSION_SECRET=your-session-secret
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
EOF
```

### Dependency Management
```bash
# Check package updates
npm outdated

# Check security vulnerabilities
npm audit

# Install dependencies
npm install

# Add development dependencies
npm install --save-dev @types/new-library
```

## Performance Monitoring Patterns

### Build Size Verification
```bash
# Check build results
npm run build
du -sh dist/

# Bundle size analysis (if configured)
npx vite-bundle-analyzer
```

### Memory & CPU Usage Monitoring
```bash
# Node.js process resource usage
top -p $(pgrep -f "node.*server")

# Check disk usage
df -h
du -sh node_modules/
```

## Troubleshooting Command Collection

### Common Problem Resolution
```bash
# Reinstall node_modules
rm -rf node_modules package-lock.json
npm install

# Resolve port conflicts
killall node
lsof -ti:3000 | xargs kill -9

# Clear TypeScript cache
rm -rf node_modules/.cache
```

### Log Collection
```bash
# Collect system information
uname -a > system_info.txt
node --version >> system_info.txt
npm --version >> system_info.txt

# Check current configuration status
env | grep -v "SECRET\|KEY\|PASSWORD" > current_env.txt
```