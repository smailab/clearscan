// 관리자 계정 생성 (첫 대표 관리자를 만들 때 사용)
// 사용: node scripts/create-admin.mjs <이메일> <이름> [owner|staff] [--remote]
// 비밀번호는 무작위로 만들어 한 번만 출력한다. 로그인 후 '내 계정'에서 바꿀 것.
// 비밀번호 해시 방식은 lib/auth/crypto.ts와 같아야 한다 (PBKDF2-SHA256, 100,000회, base64url)
import { execFileSync } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [emailRaw, name, role = 'owner'] = args.filter(a => a !== '--remote');
if (!emailRaw || !name || !['owner', 'staff'].includes(role)) {
  console.error('사용: node scripts/create-admin.mjs <이메일> <이름> [owner|staff] [--remote]');
  process.exit(1);
}
const email = emailRaw.trim().toLowerCase();

const b64url = bytes => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = n => b64url(crypto.getRandomValues(new Uint8Array(n)));

// 영문 대소문자·숫자 섞인 14자 비밀번호 (헷갈리는 글자 제외)
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
let password = '';
for (const b of crypto.getRandomValues(new Uint8Array(14))) password += chars[b % chars.length];
if (!/\d/.test(password)) password = password.slice(0, -1) + '7';
if (!/[A-Za-z]/.test(password)) password = 'a' + password.slice(1);

const salt = randomToken(16);
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 },
  key,
  256,
);
const hash = b64url(new Uint8Array(bits));

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO admins (id, email, name, role, password_hash, password_salt, active, created_at) VALUES (${q(`a_${randomToken(12)}`)}, ${q(email)}, ${q(name)}, ${q(role)}, ${q(hash)}, ${q(salt)}, 1, ${q(new Date().toISOString())});`;

// SQL은 임시 파일로 넘긴다 — 입력값(이메일·이름)이 셸 명령줄에 섞이지 않게
const sqlFile = join(mkdtempSync(join(tmpdir(), 'sl-admin-')), 'create-admin.sql');
writeFileSync(sqlFile, sql, 'utf8');
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'clearscan', remote ? '--remote' : '--local', `--file=${sqlFile}`], {
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32', // Windows에서 npx.cmd 실행용. 인자는 고정값과 임시 파일 경로뿐
  });
} catch {
  console.error('계정을 만들지 못했습니다. 이미 등록된 이메일인지 확인하세요.');
  process.exit(1);
} finally {
  rmSync(sqlFile, { force: true });
}

console.log(`\n관리자 계정을 만들었습니다 (${remote ? '운영' : '로컬'} DB)`);
console.log(`  이메일:   ${email}`);
console.log(`  이름:     ${name}`);
console.log(`  권한:     ${role === 'owner' ? '대표 관리자' : '일반 관리자'}`);
console.log(`  비밀번호: ${password}`);
console.log('\n이 비밀번호는 다시 표시되지 않습니다. 로그인 후 관리자 페이지 > 내 계정에서 바꾸세요.');
