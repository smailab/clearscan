// Node 서버(Oracle Cloud 등)의 SQLite 파일에 migrations/*.sql을 차례로 적용한다.
// 사용: node migrate-sqlite.mjs <DB 파일 경로> <migrations 폴더>
// 적용한 파일은 d1_migrations 표에 기록해서 한 번만 실행한다 (wrangler D1과 같은 이름의 표).
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dbPath, dir] = process.argv.slice(2);
if (!dbPath || !dir) {
  console.error('사용: node migrate-sqlite.mjs <DB 파일> <migrations 폴더>');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL)');
const done = new Set(db.prepare('SELECT name FROM d1_migrations').all().map(r => r.name));

const files = readdirSync(dir).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
let applied = 0;
for (const f of files) {
  if (done.has(f)) continue;
  const sql = readFileSync(join(dir, f), 'utf8');
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.prepare('INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)').run(f, new Date().toISOString());
    db.exec('COMMIT');
    console.log(`적용: ${f}`);
    applied++;
  } catch (e) {
    db.exec('ROLLBACK');
    console.error(`실패: ${f} — ${e.message}`);
    process.exit(1);
  }
}
console.log(applied ? `마이그레이션 ${applied}개 적용 완료` : '적용할 마이그레이션 없음');
