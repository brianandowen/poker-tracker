import { Pool } from "pg";

/*
  資料庫連線池（Neon / Postgres）
  注意：Next.js dev 模式會 hot reload，多次建立 Pool 會爆連線數
  所以用 global 緩存一份
*/

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing env DATABASE_URL. Please set it in .env.local");
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}