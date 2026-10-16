import 'server-only';
import { FilterXSS } from 'xss';
import { getDB } from '@/lib/db';
import { randomToken } from '@/lib/auth/crypto';

// 건강 칼럼 (블로그 글). 관리자 에디터의 HTML은 저장할 때 허용 목록 기준으로 정제한다.
// → 공개 페이지에서 그대로 보여 줘도 스크립트·위험한 링크가 실행되지 않는다.

export type Post = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string;
  contentHtml: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: string | null;
  updatedBy: string | null;
};

type Row = {
  id: string; slug: string; title: string; summary: string; cover_image: string; content_html: string;
  status: 'draft' | 'published'; published_at: string | null; created_at: string; updated_at: string;
  author: string | null; updated_by: string | null;
};

const toPost = (r: Row): Post => ({
  id: r.id, slug: r.slug, title: r.title, summary: r.summary, coverImage: r.cover_image, contentHtml: r.content_html,
  status: r.status, publishedAt: r.published_at, createdAt: r.created_at, updatedAt: r.updated_at,
  author: r.author, updatedBy: r.updated_by,
});

// ---------- HTML 정제 ----------

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const SAFE_IMG = /^(https:\/\/|\/images\/|\/media\/posts\/)/i; // 사이트 이미지 · 업로드 이미지 · https 주소

const filter = new FilterXSS({
  whiteList: {
    p: ['style'], br: [], hr: [], h2: [], h3: [], h4: [], strong: [], b: [], em: [], i: [], u: [], s: [], mark: [],
    blockquote: [], code: [], pre: [], ul: [], ol: ['start'], li: [], span: [],
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    figure: [], figcaption: [],
    table: [], thead: [], tbody: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'], colgroup: [], col: [],
  },
  stripIgnoreTag: true,             // 허용하지 않은 태그는 태그만 지우고 글자는 남긴다
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template'],
  onTagAttr(tag, name, value) {
    if (tag === 'a' && name === 'href') return SAFE_URL.test(value.trim()) ? `href="${escapeAttr(value.trim())}"` : '';
    if (tag === 'img' && name === 'src') return SAFE_IMG.test(value.trim()) ? `src="${escapeAttr(value.trim())}"` : '';
    if (tag === 'p' && name === 'style') {
      // 문단 정렬만 허용
      const m = /text-align:\s*(left|center|right|justify)/i.exec(value);
      return m ? `style="text-align: ${m[1].toLowerCase()}"` : '';
    }
    return undefined; // 기본 처리(허용 목록 기준)
  },
});

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeHtml(html: string): string {
  let out = filter.process(String(html ?? ''));
  // 새 창 링크는 opener 차단
  out = out.replace(/<a ([^>]*target="_blank"[^>]*)>/gi, (m, attrs: string) => (/rel=/.test(attrs) ? m : `<a ${attrs} rel="noopener noreferrer">`));
  return out.slice(0, 200_000);
}

// 목록용 요약이 비어 있으면 본문에서 만든다
export function textExcerpt(html: string, max = 120): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ---------- 조회 ----------

export async function listPosts(opts: { includeDrafts?: boolean; limit?: number } = {}): Promise<Post[]> {
  const db = await getDB();
  const where = opts.includeDrafts ? '' : "WHERE status = 'published'";
  const order = opts.includeDrafts ? 'ORDER BY updated_at DESC' : 'ORDER BY published_at DESC';
  const limit = opts.limit ? `LIMIT ${Math.max(1, Math.min(100, Math.floor(opts.limit)))}` : '';
  const { results } = await db.prepare(`SELECT * FROM posts ${where} ${order} ${limit}`).all<Row>();
  return results.map(toPost);
}

export async function getPostBySlug(slug: string, opts: { includeDrafts?: boolean } = {}): Promise<Post | null> {
  const db = await getDB();
  const row = await db.prepare('SELECT * FROM posts WHERE slug = ?').bind(String(slug ?? '')).first<Row>();
  if (!row) return null;
  const p = toPost(row);
  return p.status === 'published' || opts.includeDrafts ? p : null;
}

// ---------- 저장 ----------

export class PostError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type PostInput = { id?: string; slug: string; title: string; summary: string; coverImage: string; contentHtml: string; status: 'draft' | 'published' };

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function savePost(input: PostInput, adminName: string): Promise<{ id: string; slug: string }> {
  const title = String(input.title ?? '').trim().slice(0, 120);
  if (title.length < 2) throw new PostError('제목을 입력해 주세요.');
  const slug = String(input.slug ?? '').trim().toLowerCase() || `post-${randomToken(5).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  if (!SLUG_RE.test(slug)) throw new PostError('주소(slug)는 영문 소문자·숫자·하이픈(-)으로 2~80자 입력해 주세요.');
  const contentHtml = sanitizeHtml(input.contentHtml);
  if (textExcerpt(contentHtml, 10).length < 2 && !/<img /.test(contentHtml)) throw new PostError('본문을 입력해 주세요.');
  const summary = String(input.summary ?? '').trim().slice(0, 300) || textExcerpt(contentHtml, 120);
  const coverImage = String(input.coverImage ?? '').trim();
  if (coverImage && !SAFE_IMG.test(coverImage)) throw new PostError('대표 이미지는 사이트 이미지, 업로드한 이미지, https:// 주소만 쓸 수 있습니다.');
  const status = input.status === 'published' ? 'published' : 'draft';
  const now = new Date().toISOString();
  const db = await getDB();

  try {
    if (!input.id) {
      const id = `p_${randomToken(9)}`;
      await db.prepare(
        `INSERT INTO posts (id, slug, title, summary, cover_image, content_html, status, published_at, created_at, updated_at, author, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, slug, title, summary, coverImage, contentHtml, status, status === 'published' ? now : null, now, now, adminName, adminName).run();
      return { id, slug };
    }
    const prev = await db.prepare('SELECT status, published_at FROM posts WHERE id = ?').bind(input.id).first<{ status: string; published_at: string | null }>();
    if (!prev) throw new PostError('글을 찾을 수 없습니다.', 404);
    // 처음 공개할 때 공개일을 기록 (다시 공개해도 처음 공개일 유지)
    const publishedAt = status === 'published' ? prev.published_at ?? now : prev.published_at;
    await db.prepare(
      `UPDATE posts SET slug = ?, title = ?, summary = ?, cover_image = ?, content_html = ?, status = ?, published_at = ?,
         updated_at = ?, updated_by = ? WHERE id = ?`,
    ).bind(slug, title, summary, coverImage, contentHtml, status, publishedAt, now, adminName, input.id).run();
    return { id: input.id, slug };
  } catch (e) {
    if (String((e as Error).message).includes('posts.slug')) throw new PostError('이미 사용 중인 주소(slug)입니다.', 409);
    throw e;
  }
}

export async function setPostStatus(id: string, status: 'draft' | 'published', adminName: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const r = await db.prepare(
    `UPDATE posts SET status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
       updated_at = ?, updated_by = ? WHERE id = ?`,
  ).bind(status, status, now, now, adminName, id).run();
  if (!r.meta?.changes) throw new PostError('글을 찾을 수 없습니다.', 404);
}

export async function deletePost(id: string): Promise<void> {
  const db = await getDB();
  const r = await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  if (!r.meta?.changes) throw new PostError('글을 찾을 수 없습니다.', 404);
}
