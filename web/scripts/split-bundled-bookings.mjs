// 예전 방식(여러 상품 = 예약 1건)으로 저장된 묶음 예약을 상품별 예약으로 나눈다 (한 번만 실행)
// 사용: node scripts/split-bundled-bookings.mjs [--remote] [--dry-run]
// - 첫 번째 검사는 원래 예약번호를 그대로 쓰고(검사 결과·쿠폰 기록도 그대로), 나머지 검사는 새 예약번호를 받는다
// - 모두 groupCode = 원래 예약번호로 묶인다. 점유 슬롯(booking_slots)도 검사별 예약번호로 옮긴다
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const dry = args.includes('--dry-run');
const target = remote ? '--remote' : '--local';

const tmp = mkdtempSync(join(tmpdir(), 'sl-split-'));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));

// 셸을 거치지 않고 wrangler를 node로 직접 실행한다 (Windows 셸이 SQL 인자를 깨뜨리지 않게)
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const run = extra => execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'clearscan', target, ...extra], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
});
const query = sqlText => {
  const out = run(['--json', '--command', sqlText]);
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
};
// 여러 문장 실행은 임시 SQL 파일로
const execFile = sqlText => {
  const file = join(tmp, 'split.sql');
  writeFileSync(file, sqlText, 'utf8');
  run([`--file=${file}`]);
};

const rows = query("SELECT code, data FROM bookings WHERE json_array_length(json_extract(data, '$.items')) > 1");
if (!rows.length) { console.log('나눌 묶음 예약이 없습니다.'); process.exit(0); }

const existing = new Set(query('SELECT code FROM bookings').map(r => r.code));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = 'CS-';
    for (let i = 0; i < 6; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!existing.has(c)) { existing.add(c); return c; }
  }
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const q = s => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

// 할인은 금액 비율대로 나눈다 (백원 단위, lib/booking/service.ts의 splitDiscount와 같은 방식)
function split(prices, total) {
  const sum = prices.reduce((n, p) => n + p, 0) || 1;
  const out = prices.map(p => Math.floor((total * p) / sum / 100) * 100);
  let rest = total - out.reduce((n, d) => n + d, 0);
  for (let i = 0; i < out.length && rest > 0; i++) { const add = Math.min(rest, prices[i] - out[i]); out[i] += add; rest -= add; }
  return out;
}

const sql = [];
for (const row of rows) {
  const b = JSON.parse(row.data);
  const shares = split(b.items.map(it => it.price), b.discount ?? 0);
  console.log(`${b.code} (${b.date}, ${b.status}) → ${b.items.length}건`);
  b.items.forEach((it, i) => {
    const code = i === 0 ? b.code : newCode();
    const { items, planName, listPrice, couponCode, discount, ...base } = b;
    const nb = {
      ...base,
      code,
      groupCode: b.code,
      planId: it.planId,
      planName: it.planName,
      resource: it.resource,
      time: it.start,
      slots: it.slots,
      listPrice: it.price,
      price: it.price - shares[i],
      ...(couponCode && shares[i] > 0 ? { couponCode, discount: shares[i] } : {}),
    };
    console.log(`  ${code}  ${it.start}  ${it.planName}  ${nb.price.toLocaleString('ko-KR')}원`);
    const json = q(JSON.stringify(nb));
    if (i === 0) {
      sql.push(`UPDATE bookings SET time = ${q(nb.time)}, resource = ${q(nb.resource)}, data = ${json} WHERE code = ${q(b.code)};`);
    } else {
      sql.push(`INSERT INTO bookings (code, date, time, resource, status, phone, created_at, user_id, data) VALUES (${q(code)}, ${q(b.date)}, ${q(nb.time)}, ${q(nb.resource)}, ${q(b.status)}, ${q(b.person.phone)}, ${q(b.createdAt)}, ${q(b.userId)}, ${json});`);
      const starts = Array.from({ length: it.slots }, (_, k) => toMin(it.start) + k * 30);
      sql.push(`UPDATE booking_slots SET code = ${q(code)} WHERE code = ${q(b.code)} AND resource = ${q(it.resource)} AND slot_start IN (${starts.join(', ')});`);
    }
  });
}

if (dry) { console.log('\n(--dry-run: 저장하지 않았습니다)'); process.exit(0); }

execFile(sql.join('\n'));
console.log(`\n${rows.length}건의 묶음 예약을 나눴습니다 (${remote ? '운영' : '로컬'} DB)`);
