const TEST_DEFAULT = "postgres://localhost:5432/ferry_test";

export function databaseUrl(): string {
  if (process.env.VITEST) return process.env.DATABASE_URL_TEST ?? TEST_DEFAULT;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return url;
}
