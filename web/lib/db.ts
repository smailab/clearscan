import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Cloudflare D1 바인딩 (wrangler.jsonc의 "DB"). 로컬은 wrangler dev / next dev가 .wrangler/에 로컬 D1을 만든다.
export type D1Result = { meta?: { changes?: number } };
export type D1Stmt = {
  bind(...v: unknown[]): D1Stmt;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
};
export type D1 = {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<D1Result[]>;
};

export async function getDB(): Promise<D1> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: D1 }).DB;
  if (!db) throw new Error('D1 바인딩(DB)이 없습니다. wrangler.jsonc를 확인하세요.');
  return db;
}
