import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// DB 연결 — 두 가지 실행 환경을 지원한다.
// 1) Cloudflare Workers: D1 바인딩 (wrangler.jsonc의 "DB"). 로컬은 wrangler dev / next dev가 .wrangler/에 로컬 D1을 만든다.
// 2) 일반 Node 서버 (Oracle Cloud 등): 환경 변수 DB_PATH의 SQLite 파일. D1과 같은 SQLite라 SQL·마이그레이션을 그대로 쓴다.
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
  if (process.env.DB_PATH) return sqliteDB(process.env.DB_PATH);
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: D1 }).DB;
  if (!db) throw new Error('D1 바인딩(DB)이 없습니다. wrangler.jsonc를 확인하세요.');
  return db;
}

// ---------- Node 서버용: node:sqlite를 D1과 같은 모양으로 감싼다 ----------

type SqliteStatement = {
  all(...p: unknown[]): unknown[];
  get(...p: unknown[]): unknown;
  run(...p: unknown[]): { changes: number | bigint };
};
type SqliteDatabase = { prepare(sql: string): SqliteStatement; exec(sql: string): void };

let opened: Promise<D1> | null = null;

function sqliteDB(path: string): Promise<D1> {
  opened ??= (async () => {
    // Cloudflare 빌드에는 들어가지 않도록 번들러가 따라가지 않는 동적 import
    const mod = 'node:sqlite';
    const { DatabaseSync } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ mod)) as {
      DatabaseSync: new (p: string) => SqliteDatabase;
    };
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    return wrap(db);
  })();
  return opened;
}

// D1은 undefined를 거부하고 boolean을 숫자로 바꾼다 — 같은 규칙으로 맞춘다
const norm = (v: unknown[]) => v.map(x => (x === undefined ? null : typeof x === 'boolean' ? (x ? 1 : 0) : x));

function wrap(db: SqliteDatabase): D1 {
  class Stmt implements D1Stmt {
    constructor(public sql: string, public params: unknown[] = []) {}
    bind(...v: unknown[]) { return new Stmt(this.sql, norm(v)); }
    exec() {
      const r = db.prepare(this.sql).run(...this.params);
      return { meta: { changes: Number(r.changes) } };
    }
    async all<T>() { return { results: db.prepare(this.sql).all(...this.params) as T[] }; }
    async first<T>() { return (db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
    async run() { return this.exec(); }
  }
  return {
    prepare: sql => new Stmt(sql),
    // D1 batch처럼 하나의 트랜잭션: 하나라도 실패하면 전부 되돌린다
    async batch(stmts) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = stmts.map(s => (s as Stmt).exec());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
