import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// __dirname をESMで再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let pool;
let db;

if (process.env.DATABASE_URL?.includes("neon.tech")) {
  // Neon用（WebSocket経由）
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const ws = (await import('ws')).default;
  const schema = await import("@shared/schema");
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
} else {
  // ローカルPostgreSQL用（TCP経由）
  const pgModule = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import("@shared/schema");
  const Pool = pgModule.Pool || (pgModule.default && pgModule.default.Pool);
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { pool, db };
