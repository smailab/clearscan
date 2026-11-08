/* LongeviTube 관리자 (ClearScan / Cloudflare)
 * ClearScan 관리자 계정(이메일·비밀번호)으로 로그인한 상태에서 카테고리·영상을 편집하고
 * '게시하기'를 누르면 /api/admin/longevitube 로 D1 DB에 저장되어 바로 사이트에 반영됩니다.
 */
(function () {
  "use strict";

  const API_URL = "/api/admin/longevitube";
  const LOGIN_URL = "/admin/login?next=" + encodeURIComponent("/admin/longevitube/");
  const DRAFT_KEY = "lt-admin-draft-cf";

  /* 사이트(app.js)의 기본 카테고리 색 — 관리자가 색을 바꾸면 data.js 의 colors 가 우선 */
  const DEFAULT_COLORS = {
    aging: ["#3b2a8f", "#7b5cff"], mito: ["#7a3d00", "#ffb020"], metabolism: ["#2f7d1f", "#9bd24a"],
    gut: ["#8a2f5b", "#f07aa8"], sleep: ["#14204d", "#4a6ad8"], heart: ["#8f1330", "#ff4f6d"],
    mental: ["#5b1d7a", "#d05ce3"], prevention: ["#7a1010", "#e0574a"], cancer: ["#1f4e79", "#5aa9e6"],
    skin: ["#a14a2a", "#f5b38a"], hormone: ["#6b2d6b", "#e48ad1"], bluezones: ["#0d4a35", "#3fbf7f"]
  };
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── 상태 */
  let version = 0;         // 불러온 데이터의 버전 (동시 편집 충돌 감지용)
  let D = null;            // { cats, alias, videos }
  let log = [];            // 변경 내역 (커밋 메시지·표시용)
  let filterOn = false;

  function toast(msg, ms) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), ms || 2600);
  }

  /* ── 서버 API (관리자 세션 쿠키로 인증) */
  async function api(method, payload) {
    const res = await fetch(API_URL, {
      method, credentials: "same-origin",
      headers: payload ? { "Content-Type": "application/json" } : {},
      body: payload ? JSON.stringify(payload) : undefined
    });
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (res.status === 401) { location.href = LOGIN_URL; throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 }); }
    if (!res.ok) throw Object.assign(new Error((body && body.error) || ("HTTP " + res.status)), { status: res.status });
    return body;
  }

  /* ── data.js 직렬화 (기존 파일과 같은 모양) */
  const HEADER = `/* LongeviTube 데이터
 * ─────────────────────────────────────────────────────────────
 * 이 파일은 관리자 페이지(admin.html)에서 편집·게시할 수 있습니다.
 * 영상 항목 필드
 *   yt      : 유튜브 영상 ID (https://www.youtube.com/watch?v=XXXXXXXXXXX 의 XXXXXXXXXXX)
 *   title   : 한국어 제목 (사이트 표시용)
 *   orig    : 유튜브 원제
 *   speaker : 주요 연사 (연사 페이지가 자동 생성됨)
 *   channel : 업로드 채널 / 프로그램
 *   cat     : 대표 카테고리 (CATEGORIES의 id)
 *   cats    : 추가 카테고리 (선택) — 여기 적은 카테고리 목록에도 함께 표시됨
 *   level   : 입문 | 중급 | 심화
 *   format  : 강연 | 팟캐스트 | 인터뷰 | 애니메이션 | 다큐 | 클립
 *   desc    : 소개
 *   tags    : 태그 (한국어 영상은 '한국어' 포함)
 * 배열 순서 = '인기순' 순서
 * ─────────────────────────────────────────────────────────────
 */
`;
  const J = v => JSON.stringify(v);
  const arr = a => "[" + a.map(J).join(", ") + "]";
  const KNOWN = ["id", "yt", "cat", "cats", "level", "format", "title", "orig", "speaker", "channel", "desc", "tags"];

  function serialize(d) {
    const catLines = d.cats.map(c => {
      let s = `  { id: ${J(c.id)}, name: ${J(c.name)}, icon: ${J(c.icon || "")}`;
      if (c.colors && c.colors.length === 2) s += `, colors: ${arr(c.colors)}`;
      return s + " }";
    });
    const aliasKeys = Object.keys(d.alias || {});
    const aliasBody = aliasKeys.map(k => `  ${/^[a-z_$][\w$]*$/i.test(k) ? k : J(k)}: ${J(d.alias[k])}`).join(",\n");
    const vLines = d.videos.map(v => {
      let head = `  { id: ${J(v.id)}, yt: ${J(v.yt || "")}, cat: ${J(v.cat)},`;
      if (v.cats && v.cats.length) head += ` cats: ${arr(v.cats)},`;
      head += ` level: ${J(v.level || "입문")}, format: ${J(v.format || "")},`;
      const lines = [head,
        `    title: ${J(v.title || "")},`,
        `    orig: ${J(v.orig || "")},`,
        `    speaker: ${J(v.speaker || "")}, channel: ${J(v.channel || "")},`,
        `    desc: ${J(v.desc || "")},`];
      Object.keys(v).filter(k => !KNOWN.includes(k) && v[k] !== undefined).forEach(k => lines.push(`    ${k}: ${J(v[k])},`));
      lines.push(`    tags: ${arr(v.tags || [])} }`);
      return lines.join("\n");
    });
    return HEADER + "\nconst CATEGORIES = [\n" + catLines.join(",\n") + "\n];\n\n" +
      "/* 통합·삭제된 카테고리 id → 새 카테고리 id (예전 링크·저장된 영상 호환용) */\n" +
      "const CATEGORY_ALIAS = {\n" + aliasBody + (aliasBody ? "\n" : "") + "};\n\n" +
      "const VIDEOS = [\n" + vLines.join(",\n") + "\n];\n";
  }

  function validate(d) {
    const errs = [];
    const catIds = new Set(d.cats.map(c => c.id));
    const ids = new Set(), yts = new Map();
    if (!d.cats.length) errs.push("카테고리가 하나도 없습니다.");
    d.videos.forEach((v, i) => {
      const n = `#${i + 1} “${v.title || v.id}”`;
      if (!v.id) errs.push(`${n}: id가 없습니다.`);
      else if (ids.has(v.id)) errs.push(`${n}: id가 중복됩니다 (${v.id}).`);
      ids.add(v.id);
      if (!/^[A-Za-z0-9_-]{11}$/.test(v.yt || "")) errs.push(`${n}: 유튜브 영상 ID가 올바르지 않습니다.`);
      else if (yts.has(v.yt)) errs.push(`${n}: 같은 유튜브 영상이 이미 있습니다 (${yts.get(v.yt)}).`);
      else yts.set(v.yt, v.title);
      if (!catIds.has(v.cat)) errs.push(`${n}: 대표 카테고리 ‘${v.cat}’가 없습니다.`);
      if (!v.title) errs.push(`${n}: 제목이 비어 있습니다.`);
    });
    return errs;
  }

  /* ── 초안 (게시 전 변경을 브라우저에 보관) */
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ version, d: D, log })); } catch (e) {}
    renderDirty();
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  function change(msg) { log.push(msg); saveDraft(); }

  function renderDirty() {
    const n = log.length;
    $("#dirty").textContent = n ? `게시 안 된 변경 ${n}건` : "변경 없음";
    $("#dirty").classList.toggle("on", n > 0);
    $("#publishBtn").disabled = !n;
    $("#discardBtn").disabled = !n;
  }

  /* ── 불러오기 */
  async function load(force) {
    $("#admin").setAttribute("aria-busy", "true");
    const st = await api("GET");
    $("#who").textContent = `${st.admin.name} (${st.admin.role === "owner" ? "대표" : "일반"} 관리자)`;
    $("#lastPub").textContent = st.updatedAt ? `마지막 게시: ${new Date(st.updatedAt).toLocaleString("ko-KR")} · ${st.updatedBy || ""}` : "";
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    if (!force && draft && draft.log && draft.log.length) {
      if (draft.version === st.version) {
        version = draft.version; D = draft.d; log = draft.log;
        toast(`게시하지 않은 변경 ${log.length}건을 이어서 편집합니다.`, 3500);
      } else if (confirm(`게시하지 않은 변경 ${draft.log.length}건이 있지만, 그 사이 다른 관리자가 게시했습니다.\n\n확인: 예전 변경을 버리고 최신 내용으로 시작\n취소: 예전 변경을 그대로 불러오기 (게시할 때 최신 내용을 덮어쓰게 됩니다)`)) {
        version = st.version; D = st.data; log = []; clearDraft();
      } else {
        version = st.version; D = draft.d; log = draft.log; saveDraft();
      }
    } else {
      version = st.version; D = st.data; log = []; clearDraft();
    }
    $("#admin").removeAttribute("aria-busy");
    renderAll();
  }

  /* ── 게시 */
  async function publish() {
    const errs = validate(D);
    if (errs.length) { alert("게시할 수 없습니다:\n\n" + errs.slice(0, 15).join("\n") + (errs.length > 15 ? `\n…외 ${errs.length - 15}건` : "")); return; }
    if (!confirm(`다음 변경 ${log.length}건을 게시할까요?\n\n- ${log.slice(-12).join("\n- ")}${log.length > 12 ? "\n…" : ""}\n\n게시하면 바로 모든 방문자에게 반영됩니다.`)) return;
    const btn = $("#publishBtn"); btn.disabled = true; btn.textContent = "게시 중…";
    try {
      const res = await api("PUT", { version, data: D, log });
      version = res.version; log = []; clearDraft(); renderDirty();
      $("#lastPub").textContent = `마지막 게시: ${new Date().toLocaleString("ko-KR")} · ${$("#who").textContent.split(" (")[0]}`;
      toast("게시했습니다. 사이트에 바로 반영됩니다.", 4000);
    } catch (e) {
      if (e.status === 401) return;
      if (e.status === 409) alert(e.message + "\n\n메뉴 ⋮ → ‘최신 내용 다시 불러오기’ 후 다시 수정해 주세요.\n(지금 변경 내용은 ‘data.js 내려받기’로 보관할 수 있습니다.)");
      else alert("게시하지 못했습니다: " + e.message);
    } finally {
      btn.textContent = "게시하기"; renderDirty();
    }
  }

  /* ── 공통 */
  const catName = id => { const c = D.cats.find(x => x.id === id); return c ? `${c.icon || ""} ${c.name}`.trim() : id + " (없음)"; };
  const parseYt = s => {
    const t = String(s || "").trim();
    const m = t.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/) || t.match(/^([A-Za-z0-9_-]{11})$/);
    return m ? m[1] : null;
  };
  function renderAll() {
    $("#editor").hidden = false; $("#topActions").hidden = false;
    renderCatSelects(); renderVideos(); renderCats(); renderDirty();
  }
  function renderCatSelects() {
    const opts = D.cats.map(c => `<option value="${esc(c.id)}">${esc(c.icon || "")} ${esc(c.name)}</option>`).join("");
    const cur = $("#vCat").value;
    $("#vCat").innerHTML = `<option value="">모든 카테고리</option>` + opts;
    $("#vCat").value = D.cats.some(c => c.id === cur) ? cur : "";
    $("#fCat").innerHTML = opts;
    $("#videoCount").textContent = D.videos.length;
    $("#catCount").textContent = D.cats.length;
  }

  /* ── 영상 목록 */
  function renderVideos() {
    const q = $("#vSearch").value.trim().toLowerCase();
    const cf = $("#vCat").value;
    filterOn = !!(q || cf);
    const rows = [];
    D.videos.forEach((v, i) => {
      if (cf && v.cat !== cf && !(v.cats || []).includes(cf)) return;
      if (q && ![v.title, v.orig, v.speaker, v.channel, (v.tags || []).join(" "), v.id].join(" ").toLowerCase().includes(q)) return;
      const cats = [v.cat].concat(v.cats || []);
      rows.push(`<li class="vrow" data-i="${i}">
        <span class="vnum">${i + 1}</span>
        <img class="vthumb" src="https://i.ytimg.com/vi/${esc(v.yt)}/mqdefault.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <div class="vbody">
          <b class="vtitle">${esc(v.title)}</b>
          <span class="muted small">${esc(v.speaker)}${v.channel ? " · " + esc(v.channel) : ""} · ${cats.map(c => esc(catName(c))).join(", ")}</span>
        </div>
        <div class="vact">
          ${filterOn ? "" : `<button class="mini" data-v="top" title="맨 위로" aria-label="맨 위로">⤒</button>
          <button class="mini" data-v="up" title="위로" aria-label="위로">↑</button>
          <button class="mini" data-v="down" title="아래로" aria-label="아래로">↓</button>`}
          <a class="mini" href="/longevitube/#/v/${encodeURIComponent(v.id)}" target="_blank" rel="noopener" title="사이트에서 보기" aria-label="사이트에서 보기">↗</a>
          <button class="mini" data-v="edit">수정</button>
          <button class="mini danger" data-v="del">삭제</button>
        </div></li>`);
    });
    $("#vlist").innerHTML = rows.join("") || `<li class="empty">일치하는 영상이 없습니다.</li>`;
  }

  $("#vlist").addEventListener("click", e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    const i = +b.closest(".vrow").dataset.i; const v = D.videos[i]; const a = b.dataset.v;
    if (a === "edit") return openVideo(i);
    if (a === "del") {
      if (!confirm(`“${v.title}” 영상을 삭제할까요?`)) return;
      D.videos.splice(i, 1); change(`영상 삭제: ${v.title}`);
    } else if (a === "up" && i > 0) {
      [D.videos[i - 1], D.videos[i]] = [D.videos[i], D.videos[i - 1]]; change(`순서 변경: ${v.title} ↑`);
    } else if (a === "down" && i < D.videos.length - 1) {
      [D.videos[i + 1], D.videos[i]] = [D.videos[i], D.videos[i + 1]]; change(`순서 변경: ${v.title} ↓`);
    } else if (a === "top" && i > 0) {
      D.videos.splice(i, 1); D.videos.unshift(v); change(`순서 변경: ${v.title} 맨 위로`);
    } else return;
    renderCatSelects(); renderVideos(); renderCats();
  });
  $("#vSearch").addEventListener("input", renderVideos);
  $("#vCat").addEventListener("change", renderVideos);

  /* ── 영상 편집 대화상자 */
  let editIndex = -1;
  function openVideo(i) {
    editIndex = i;
    const v = i >= 0 ? D.videos[i] : { level: "입문", format: "강연", cat: $("#vCat").value || D.cats[0].id, tags: [] };
    const f = $("#videoForm").elements;
    $("#videoDialogTitle").textContent = i >= 0 ? "영상 수정" : "새 영상 추가";
    f.yt.value = v.yt || ""; f.title.value = v.title || ""; f.orig.value = v.orig || "";
    f.speaker.value = v.speaker || ""; f.channel.value = v.channel || "";
    f.cat.value = v.cat; f.level.value = v.level || "입문"; f.format.value = v.format || "";
    f.desc.value = v.desc || ""; f.tags.value = (v.tags || []).join(", ");
    $("#fCats").innerHTML = D.cats.map(c => `<label class="check"><input type="checkbox" value="${esc(c.id)}" ${(v.cats || []).includes(c.id) ? "checked" : ""}> ${esc(c.icon || "")} ${esc(c.name)}</label>`).join("");
    $("#videoError").hidden = true;
    $("#videoDialog").showModal();
  }
  $("#addVideoBtn").addEventListener("click", () => openVideo(-1));
  $("#videoForm").addEventListener("submit", e => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const f = e.target.elements; const err = $("#videoError");
    const fail = m => { e.preventDefault(); err.textContent = m; err.hidden = false; };
    const yt = parseYt(f.yt.value);
    if (!yt) return fail("유튜브 링크에서 영상 ID를 찾지 못했습니다.");
    const dup = D.videos.findIndex((x, j) => x.yt === yt && j !== editIndex);
    if (dup >= 0) return fail(`이미 등록된 영상입니다: #${dup + 1} ${D.videos[dup].title}`);
    const title = f.title.value.trim(); if (!title) return fail("제목을 입력해 주세요.");
    const cat = f.cat.value;
    const cats = [...$("#fCats").querySelectorAll("input:checked")].map(x => x.value).filter(x => x !== cat);
    const tags = f.tags.value.split(",").map(s => s.trim()).filter(Boolean);
    const old = editIndex >= 0 ? D.videos[editIndex] : null;
    const v = Object.assign({}, old || {}, {
      id: old ? old.id : uniqueId("v-" + yt),
      yt, cat, level: f.level.value, format: f.format.value.trim(),
      title, orig: f.orig.value.trim(), speaker: f.speaker.value.trim(), channel: f.channel.value.trim(),
      desc: f.desc.value.trim(), tags
    });
    if (cats.length) v.cats = cats; else delete v.cats;
    if (old) {
      if (JSON.stringify(old) === JSON.stringify(v)) return;
      D.videos[editIndex] = v; change(`영상 수정: ${title}`);
    } else {
      D.videos.unshift(v); change(`영상 추가: ${title}`);
    }
    renderCatSelects(); renderVideos(); renderCats();
  });
  function uniqueId(base) {
    let id = base, n = 2;
    while (D.videos.some(v => v.id === id)) id = base + "-" + n++;
    return id;
  }

  /* ── 카테고리 */
  function counts(id) {
    let main = 0, extra = 0;
    D.videos.forEach(v => { if (v.cat === id) main++; else if ((v.cats || []).includes(id)) extra++; });
    return { main, extra };
  }
  function renderCats() {
    $("#clist").innerHTML = D.cats.map((c, i) => {
      const n = counts(c.id);
      const col = c.colors || DEFAULT_COLORS[c.id] || ["#334455", "#667788"];
      return `<li class="crow" data-i="${i}">
        <div class="cmove">
          <button class="mini" data-c="up" aria-label="위로" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="mini" data-c="down" aria-label="아래로" ${i === D.cats.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <input class="cicon" data-f="icon" value="${esc(c.icon || "")}" maxlength="4" aria-label="아이콘">
        <input class="cname" data-f="name" value="${esc(c.name)}" maxlength="20" aria-label="이름">
        <code class="cid">#/c/${esc(c.id)}</code>
        <span class="muted small ccount">대표 ${n.main} · 추가 ${n.extra}</span>
        <span class="ccolors" title="썸네일 색상 (기본 카테고리는 비워두면 기존 색 사용)">
          <input type="color" data-f="c0" value="${esc(col[0])}" aria-label="색상 1"><input type="color" data-f="c1" value="${esc(col[1])}" aria-label="색상 2">
        </span>
        <button class="mini danger" data-c="del">삭제</button>
      </li>`;
    }).join("");
  }
  $("#clist").addEventListener("change", e => {
    const inp = e.target.closest("input[data-f]"); if (!inp) return;
    const c = D.cats[+inp.closest(".crow").dataset.i]; const f = inp.dataset.f;
    if (f === "name") {
      const v = inp.value.trim(); if (!v || v === c.name) { inp.value = c.name; return; }
      change(`카테고리 이름 변경: ${c.name} → ${v}`); c.name = v;
    } else if (f === "icon") {
      const v = inp.value.trim(); if (v === (c.icon || "")) return;
      c.icon = v; change(`카테고리 아이콘 변경: ${c.name}`);
    } else {
      const row = inp.closest(".crow");
      c.colors = [row.querySelector('[data-f="c0"]').value, row.querySelector('[data-f="c1"]').value];
      change(`카테고리 색상 변경: ${c.name}`);
    }
    renderCatSelects(); renderVideos();
  });
  $("#clist").addEventListener("click", e => {
    const b = e.target.closest("button[data-c]"); if (!b) return;
    const i = +b.closest(".crow").dataset.i; const c = D.cats[i];
    if (b.dataset.c === "up" && i > 0) { [D.cats[i - 1], D.cats[i]] = [D.cats[i], D.cats[i - 1]]; change(`카테고리 순서 변경: ${c.name} ↑`); }
    else if (b.dataset.c === "down" && i < D.cats.length - 1) { [D.cats[i + 1], D.cats[i]] = [D.cats[i], D.cats[i + 1]]; change(`카테고리 순서 변경: ${c.name} ↓`); }
    else if (b.dataset.c === "del") return openDelCat(i);
    else return;
    renderCatSelects(); renderCats(); renderVideos();
  });

  let delIndex = -1;
  function openDelCat(i) {
    if (D.cats.length < 2) { alert("마지막 남은 카테고리는 삭제할 수 없습니다."); return; }
    delIndex = i; const c = D.cats[i]; const n = counts(c.id);
    $("#delCatTitle").textContent = `‘${c.name}’ 카테고리 삭제`;
    $("#delCatInfo").textContent = `이 카테고리가 대표인 영상 ${n.main}개, 추가 카테고리로 들어 있는 영상 ${n.extra}개가 있습니다.`;
    $("#delCatTarget").innerHTML = D.cats.filter(x => x.id !== c.id).map(x => `<option value="${esc(x.id)}">${esc(x.icon || "")} ${esc(x.name)}</option>`).join("");
    $("#delCatForm").elements.namedItem("mode").value = "move";
    $("#delCatDialog").showModal();
  }
  $("#delCatForm").addEventListener("submit", e => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const f = e.target; const c = D.cats[delIndex]; const mode = f.elements.namedItem("mode").value; const target = $("#delCatTarget").value;
    let moved = 0, removed = 0;
    D.videos = D.videos.filter(v => {
      if (v.cat === c.id) {
        if (mode === "delete") { removed++; return false; }
        v.cat = target; moved++;
      }
      if (v.cats) {
        v.cats = v.cats.filter(x => x !== c.id && x !== v.cat);
        if (!v.cats.length) delete v.cats;
      }
      return true;
    });
    D.cats.splice(delIndex, 1);
    // 예전 링크 처리: 옮긴 경우엔 새 카테고리로 연결, 삭제한 경우엔 연결 제거
    Object.keys(D.alias).forEach(k => { if (D.alias[k] === c.id) { if (mode === "move") D.alias[k] = target; else delete D.alias[k]; } });
    if (mode === "move") D.alias[c.id] = target; else delete D.alias[c.id];
    change(mode === "move" ? `카테고리 삭제: ${c.name} (영상 ${moved}개 → ${catName(target)})` : `카테고리 삭제: ${c.name} (영상 ${removed}개 함께 삭제)`);
    renderCatSelects(); renderCats(); renderVideos();
  });

  $("#addCatBtn").addEventListener("click", () => { $("#catForm").reset(); $("#catError").hidden = true; $("#catDialog").showModal(); });
  $("#catForm").addEventListener("submit", e => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const f = e.target; const err = $("#catError");
    const el = n => f.elements.namedItem(n);
    const id = el("id").value.trim().toLowerCase(); const name = el("name").value.trim();
    const fail = m => { e.preventDefault(); err.textContent = m; err.hidden = false; };
    if (!/^[a-z][a-z0-9-]{1,29}$/.test(id)) return fail("id는 영문 소문자로 시작하는 2~30자(소문자·숫자·-)로 입력해 주세요.");
    if (D.cats.some(c => c.id === id)) return fail("이미 있는 id입니다.");
    if (D.alias[id]) return fail("예전 카테고리 링크로 쓰이는 id입니다. 다른 id를 써 주세요.");
    D.cats.push({ id, name, icon: el("icon").value.trim(), colors: [el("c1").value, el("c2").value] });
    change(`카테고리 추가: ${name}`);
    renderCatSelects(); renderCats();
  });

  /* ── 탭·메뉴 */
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => { x.classList.toggle("active", x === t); x.setAttribute("aria-selected", x === t); });
    $("#tab-videos").hidden = t.dataset.tab !== "videos";
    $("#tab-cats").hidden = t.dataset.tab !== "cats";
  }));
  $("#menuMore").addEventListener("click", e => { e.stopPropagation(); $("#moreMenu").hidden = !$("#moreMenu").hidden; });
  document.addEventListener("click", () => { $("#moreMenu").hidden = true; });
  $("#publishBtn").addEventListener("click", publish);
  $("#discardBtn").addEventListener("click", async () => {
    if (!confirm(`게시하지 않은 변경 ${log.length}건을 모두 취소할까요?`)) return;
    clearDraft(); await safeLoad(true); toast("변경을 취소했습니다.");
  });
  $("#reloadBtn").addEventListener("click", async () => {
    if (log.length && !confirm(`게시하지 않은 변경 ${log.length}건이 사라집니다. 다시 불러올까요?`)) return;
    clearDraft(); await safeLoad(true); toast("최신 내용을 불러왔습니다.");
  });
  $("#downloadBtn").addEventListener("click", () => {
    const blob = new Blob([serialize(D)], { type: "text/javascript;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "data.js"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#logoutBtn").addEventListener("click", async () => {
    if (log.length && !confirm(`게시하지 않은 변경 ${log.length}건은 이 브라우저에 남아 있다가 다음 로그인 때 이어집니다. 로그아웃할까요?`)) return;
    try { await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }); } catch (e) {}
    location.href = LOGIN_URL;
  });
  window.addEventListener("beforeunload", e => { if (log.length) { e.preventDefault(); e.returnValue = ""; } });

  /* ── 시작 */
  (async function init() {
    try { await safeLoad(false); } catch (e) {}
  })();
  async function safeLoad(force) {
    try { await load(force); }
    catch (e) { if (e.status !== 401) alert("데이터를 불러오지 못했습니다: " + e.message); }
  }

  // 테스트·디버그용
  window.__ltAdmin = { serialize: () => serialize(D), validate: () => validate(D) };
})();
