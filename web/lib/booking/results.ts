import 'server-only';
import { getDB } from '@/lib/db';

// 검사 결과 (텍스트 입력). 관리자가 공개(published)해야 회원 내 페이지에 보인다.
export const RESULT_STATUS = {
  normal: { label: '정상', tone: 'ok' },
  followup: { label: '추적 관찰', tone: 'warn' },
  detail: { label: '정밀검사 권고', tone: 'alert' },
} as const;
export type ResultStatus = keyof typeof RESULT_STATUS;

export type ExamResult = {
  bookingCode: string;
  userId: string;
  status: ResultStatus;
  summary: string;
  findings: string;
  recommendation: string;
  published: boolean;
  updatedAt: string;
};

type Row = {
  booking_code: string; user_id: string; status: ResultStatus; summary: string; findings: string;
  recommendation: string; published: number; updated_at: string;
};
const toResult = (r: Row): ExamResult => ({
  bookingCode: r.booking_code, userId: r.user_id, status: r.status, summary: r.summary, findings: r.findings,
  recommendation: r.recommendation, published: Boolean(r.published), updatedAt: r.updated_at,
});

export async function resultsByUser(userId: string, publishedOnly = true): Promise<ExamResult[]> {
  const db = await getDB();
  const { results } = await db.prepare(
    `SELECT * FROM results WHERE user_id = ? ${publishedOnly ? 'AND published = 1' : ''} ORDER BY updated_at DESC`,
  ).bind(userId).all<Row>();
  return results.map(toResult);
}

export async function resultByCode(code: string): Promise<ExamResult | null> {
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM results WHERE booking_code = ?').bind(code).first<Row>();
  return row ? toResult(row) : null;
}

export async function allResults(): Promise<Map<string, ExamResult>> {
  const db = await getDB();
  const { results } = await db.prepare('SELECT * FROM results').all<Row>();
  return new Map(results.map(r => [r.booking_code, toResult(r)]));
}

export async function saveResult(r: Omit<ExamResult, 'updatedAt'>): Promise<void> {
  const db = await getDB();
  await db.prepare(
    `INSERT INTO results (booking_code, user_id, status, summary, findings, recommendation, published, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(booking_code) DO UPDATE SET status = excluded.status, summary = excluded.summary,
       findings = excluded.findings, recommendation = excluded.recommendation,
       published = excluded.published, updated_at = excluded.updated_at`,
  ).bind(r.bookingCode, r.userId, r.status, r.summary, r.findings, r.recommendation, r.published ? 1 : 0, new Date().toISOString()).run();
}
