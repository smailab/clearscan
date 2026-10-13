// 정적 사이트 빌드 (Cloudflare Pages 등) → web/out
// 서버 전용 라우트(*.server.ts(x): API, 관리자)는 next.config의 pageExtensions 설정으로 제외된다
// 경로 접두사가 필요하면 NEXT_PUBLIC_BASE_PATH=/clearscan 처럼 지정
import { spawnSync } from 'node:child_process';
import { copyFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
rmSync(path.join(root, 'out'), { recursive: true, force: true });

const res = spawnSync('npx', ['next', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NEXT_PUBLIC_STATIC_SITE: '1' },
});

// Next 16 정적 출력은 prefetch 데이터를 `__next.seg/__PAGE__.txt`(폴더)로 쓰지만
// 클라이언트는 `__next.seg.__PAGE__.txt`(점으로 이은 파일)를 요청한다 → 같은 내용으로 평평한 사본을 만든다
function flattenSegments(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith('__next.')) {
      const walk = (d, prefix) => {
        for (const n of readdirSync(d)) {
          const p = path.join(d, n);
          if (statSync(p).isDirectory()) walk(p, `${prefix}.${n}`);
          else copyFileSync(p, path.join(dir, `${prefix}.${n}`));
        }
      };
      walk(full, name);
    } else {
      flattenSegments(full);
    }
  }
}

if (res.status === 0) {
  flattenSegments(path.join(root, 'out'));
  // Cloudflare Pages 캐시 헤더: 해시가 붙은 빌드 파일은 오래 캐시
  writeFileSync(path.join(root, 'out', '_headers'), '/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n');
  console.log('\n정적 빌드 완료 → web/out');
}
process.exit(res.status ?? 1);
