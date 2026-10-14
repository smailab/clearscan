import 'server-only';
import { cache } from 'react';
import { getDB } from '@/lib/db';
import { CENTER_ID_RE, type Center, type CenterHours, type CenterLink, type Doctor } from './centers-shared';

// 검진 센터 (D1 centers)

type Row = {
  id: string; name: string; region: string; address: string; address_detail: string; phone: string; homepage: string;
  notice: string; intro: string; image: string; gallery: string; hours: string; links: string; equipment: string;
  highlights: string; plan_ids: string; doctors: string; active: number; sort_order: number; updated_at: string; updated_by: string | null;
};

const arr = <T,>(json: string): T[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const toCenter = (r: Row): Center & { updatedAt: string; updatedBy: string | null } => ({
  id: r.id, name: r.name, region: r.region, address: r.address, addressDetail: r.address_detail, phone: r.phone,
  homepage: r.homepage || undefined, notice: r.notice || undefined, intro: r.intro, image: r.image,
  gallery: arr<string>(r.gallery), hours: arr<CenterHours>(r.hours), links: arr<CenterLink>(r.links),
  equipment: arr<string>(r.equipment), highlights: arr<string>(r.highlights), planIds: arr<string>(r.plan_ids),
  doctors: arr<Doctor>(r.doctors), active: Boolean(r.active), sortOrder: r.sort_order, updatedAt: r.updated_at, updatedBy: r.updated_by,
});

export const listCenters = cache(async (opts: { includeInactive?: boolean } = {}) => {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT * FROM centers ${opts.includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort_order, name`,
  ).all<Row>();
  return results.map(toCenter);
});

export async function getCenter(id: string, opts: { includeInactive?: boolean } = {}) {
  const c = (await listCenters({ includeInactive: true })).find(x => x.id === id) ?? null;
  return c && (c.active || opts.includeInactive) ? c : null;
}

export class CenterError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type CenterInput = Omit<Center, 'active' | 'sortOrder'> & { active: boolean; sortOrder: number };

const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const lines = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : []).map(x => s(x, maxLen)).filter(Boolean).slice(0, maxItems);
const isImage = (v: string) => v.startsWith('/images/');
const isUrl = (v: string) => /^https?:\/\/[^\s]+$/i.test(v);

function validate(input: CenterInput): CenterInput {
  const id = s(input.id, 32).toLowerCase();
  if (!CENTER_ID_RE.test(id)) throw new CenterError('센터 ID는 영문 소문자·숫자·하이픈(-) 2~31자로 입력해 주세요.');
  const name = s(input.name, 40);
  if (name.length < 2) throw new CenterError('센터 이름을 입력해 주세요.');
  const address = s(input.address, 120);
  if (address.length < 5) throw new CenterError('주소를 입력해 주세요.');
  const image = s(input.image, 200);
  if (!isImage(image)) throw new CenterError('대표 사진을 선택해 주세요.');
  const homepage = s(input.homepage, 200);
  if (homepage && !isUrl(homepage)) throw new CenterError('홈페이지 주소는 http:// 또는 https://로 시작해야 합니다.');

  const hours = (Array.isArray(input.hours) ? input.hours : []).slice(0, 3).map(h => ({
    label: s(h.label, 20), value: s(h.value, 60), ...(s(h.note, 80) ? { note: s(h.note, 80) } : {}),
  })).filter(h => h.label && h.value);
  const links = (Array.isArray(input.links) ? input.links : []).slice(0, 8).map(l => ({ label: s(l.label, 20), url: s(l.url, 300) }))
    .filter(l => l.label && isUrl(l.url));
  const doctors = (Array.isArray(input.doctors) ? input.doctors : []).slice(0, 30).map(d => {
    const photo = s(d.photo, 200);
    const doc: Doctor = { name: s(d.name, 20), title: s(d.title, 20) };
    if (s(d.specialty, 40)) doc.specialty = s(d.specialty, 40);
    if (photo && isImage(photo)) doc.photo = photo;
    const edu = lines(d.education, 10, 80), car = lines(d.career, 15, 80), soc = lines(d.societies, 15, 80);
    if (edu.length) doc.education = edu;
    if (car.length) doc.career = car;
    if (soc.length) doc.societies = soc;
    return doc;
  }).filter(d => d.name);

  return {
    id, name, region: s(input.region, 30), address, addressDetail: s(input.addressDetail, 80), phone: s(input.phone, 20),
    homepage, notice: s(input.notice, 200), intro: s(input.intro, 1000), image,
    gallery: lines(input.gallery, 20, 200).filter(isImage), hours, links,
    equipment: lines(input.equipment, 20, 60), highlights: lines(input.highlights, 10, 80),
    planIds: lines(input.planIds, 50, 32), doctors, active: Boolean(input.active), sortOrder: Math.round(Number(input.sortOrder) || 0),
  };
}

export async function saveCenter(raw: CenterInput, mode: 'create' | 'update', adminName: string): Promise<void> {
  const c = validate(raw);
  const db = await getDB();
  const now = new Date().toISOString();
  const vals = [c.name, c.region, c.address, c.addressDetail, c.phone, c.homepage ?? '', c.notice ?? '', c.intro, c.image,
    JSON.stringify(c.gallery), JSON.stringify(c.hours), JSON.stringify(c.links ?? []), JSON.stringify(c.equipment),
    JSON.stringify(c.highlights), JSON.stringify(c.planIds), JSON.stringify(c.doctors), c.active ? 1 : 0, c.sortOrder, now, adminName];
  if (mode === 'create') {
    try {
      await db.prepare(
        `INSERT INTO centers (name, region, address, address_detail, phone, homepage, notice, intro, image, gallery, hours, links,
           equipment, highlights, plan_ids, doctors, active, sort_order, updated_at, updated_by, id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(...vals, c.id).run();
    } catch (e) {
      if (String((e as Error).message).includes('centers.id')) throw new CenterError('이미 사용 중인 센터 ID입니다.', 409);
      throw e;
    }
    return;
  }
  const r = await db.prepare(
    `UPDATE centers SET name = ?, region = ?, address = ?, address_detail = ?, phone = ?, homepage = ?, notice = ?, intro = ?,
       image = ?, gallery = ?, hours = ?, links = ?, equipment = ?, highlights = ?, plan_ids = ?, doctors = ?, active = ?,
       sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
  ).bind(...vals, c.id).run();
  if (!r.meta?.changes) throw new CenterError('센터를 찾을 수 없습니다.', 404);
}

export async function deleteCenter(id: string): Promise<{ name: string }> {
  const db = await getDB();
  const c = await db.prepare('SELECT name FROM centers WHERE id = ?').bind(String(id ?? '')).first<{ name: string }>();
  if (!c) throw new CenterError('센터를 찾을 수 없습니다.', 404);
  const total = await db.prepare('SELECT COUNT(*) AS n FROM centers WHERE active = 1 AND id != ?').bind(id).first<{ n: number }>();
  if (!total?.n) throw new CenterError('공개 중인 센터가 최소 1곳은 있어야 합니다. 다른 센터를 먼저 공개해 주세요.');
  await db.prepare('DELETE FROM centers WHERE id = ?').bind(id).run();
  return c;
}
