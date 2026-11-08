(function () {
  "use strict";

  /* ── 저장소 (localStorage, 실패해도 동작) */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("lt-" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("lt-" + k, JSON.stringify(v)); } catch (e) {} }
  };

  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const GRAD = {
    aging: ["#3b2a8f", "#7b5cff"], mito: ["#7a3d00", "#ffb020"],
    metabolism: ["#2f7d1f", "#9bd24a"], gut: ["#8a2f5b", "#f07aa8"], sleep: ["#14204d", "#4a6ad8"],
    heart: ["#8f1330", "#ff4f6d"], mental: ["#5b1d7a", "#d05ce3"], prevention: ["#7a1010", "#e0574a"], cancer: ["#1f4e79", "#5aa9e6"], skin: ["#a14a2a", "#f5b38a"], hormone: ["#6b2d6b", "#e48ad1"],
    bluezones: ["#0d4a35", "#3fbf7f"]
  };

  const $ = s => document.querySelector(s);
  const app = $("#app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function allVideos() {
    const mine = store.get("mine", []).map(v => Object.assign({ mine: true }, v));
    return mine.concat(VIDEOS);
  }
  const byId = id => allVideos().find(v => v.id === id);
  const ALIAS = typeof CATEGORY_ALIAS === "object" ? CATEGORY_ALIAS : {};
  const catId = c => ALIAS[c] || c;
  const catsOf = v => [v.cat].concat(v.cats || []).map(catId).filter((c, i, a) => CAT[c] && a.indexOf(c) === i);
  const inCat = (v, id) => catsOf(v).includes(id);
  const isKoV = v => (v.tags || []).includes("한국어");

  /* ── 상태 */
  let liked = new Set(store.get("liked", []));
  let saved = store.get("saved", []);
  let history = store.get("history", []);
  let sort = store.get("sort", "pop");
  let koSubs = store.get("koSubs", true); // 한국어 자막 자동 켜기 (기본: 켜짐)
  if (!["pop", "ko", "liked", "title"].includes(sort)) sort = "pop";

  /* ── 공통 렌더 조각 */
  function hue(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  function avatar(name, cls = "") {
    const n = name || "?";
    return `<span class="avatar ${cls}" style="background:hsl(${hue(n)} 45% 42%)" aria-hidden="true">${esc(n.trim()[0].toUpperCase())}</span>`;
  }
  function genThumb(v) {
    const g = (CAT[catId(v.cat)] && CAT[catId(v.cat)].colors) || GRAD[catId(v.cat)] || ["#334", "#667"];
    const c = CAT[catId(v.cat)];
    return `<div class="gen" style="background:linear-gradient(135deg,${g[0]},${g[1]})">
      <span class="gen-icon" aria-hidden="true">${c ? c.icon : "▶"}</span>
      <span class="gen-cat">${esc(c ? c.name : "LONGEVITY")}</span>
      <span class="gen-title">${esc(v.title)}</span></div>`;
  }
  function thumb(v) {
    const inner = v.yt
      ? genThumb(v) + `<img src="https://i.ytimg.com/vi/${esc(v.yt)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">`
      : genThumb(v);
    const badge = v.format ? `<span class="badge">${esc(v.format)}</span>` : (v.yt ? "" : `<span class="badge">검색 연결</span>`);
    return `<a class="thumb" href="#/v/${encodeURIComponent(v.id)}">${inner}<span class="badge left">${esc(v.level || "입문")}</span>${badge}</a>`;
  }
  const speakerLink = s => `<a href="#/s/${encodeURIComponent(s)}">${esc(s)}</a>`;
  function card(v) {
    const sp = v.speaker || "알 수 없음";
    return `<article class="card">${thumb(v)}
      <div class="meta">${avatar(sp)}
        <div class="meta-body">
          <h3 class="title"><a href="#/v/${encodeURIComponent(v.id)}" title="${esc(v.title)}">${esc(v.title)}</a></h3>
          <div class="sub">${speakerLink(sp)}</div>
          <div class="sub">${esc(v.channel || (CAT[catId(v.cat)] ? CAT[catId(v.cat)].name : ""))}${liked.has(v.id) ? " · ♥" : ""}${v.mine ? " · 내가 추가" : ""}</div>
        </div></div></article>`;
  }
  function grid(list, emptyMsg) {
    if (!list.length) return `<div class="empty"><div class="big">🌱</div>${emptyMsg || "영상이 없습니다."}</div>`;
    return `<div class="grid">${list.map(card).join("")}</div>`;
  }
  function sorted(list) {
    const l = list.slice();
    if (sort === "title") l.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    if (sort === "ko") l.sort((a, b) => (isKoV(b) ? 1 : 0) - (isKoV(a) ? 1 : 0));
    if (sort === "liked") l.sort((a, b) => (liked.has(b.id) ? 1 : 0) - (liked.has(a.id) ? 1 : 0));
    return l;
  }
  function sortBar(title) {
    const opt = [["pop", "인기순"], ["ko", "한국어 먼저"], ["title", "가나다순"], ["liked", "좋아요 먼저"]];
    return `<div class="toolbar"><h1>${title}</h1><div class="seg" role="group" aria-label="정렬">${opt.map(([k, n]) =>
      `<button data-sort="${k}" class="${sort === k ? "active" : ""}" aria-pressed="${sort === k}">${n}</button>`).join("")}</div></div>`;
  }
  function chips(active) {
    return `<div class="chips" role="tablist">
      <a class="chip ${!active ? "active" : ""}" href="#/">전체</a>
      ${CATEGORIES.map(c => `<a class="chip ${active === c.id ? "active" : ""}" href="#/c/${c.id}">${c.name}</a>`).join("")}</div>`;
  }

  /* ── 사이드바 */
  function speakers() {
    const m = new Map();
    allVideos().forEach(v => { if (v.speaker) m.set(v.speaker, (m.get(v.speaker) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0]);
  }
  function renderSidebar(route) {
    const link = (href, ico, label, key) =>
      `<a class="side-link ${route === key ? "active" : ""}" href="${href}"><span class="ico" aria-hidden="true">${ico}</span><span>${label}</span></a>`;
    $("#sidebar").innerHTML = `
      <div class="side-group">
        ${link("#/", "🏠", "홈", "home")}
        ${link("#/ko", "🇰🇷", "한국어 영상", "ko")}
        ${link("#/mine", "➕", "내가 추가한 영상", "mine")}
        ${link("#/saved", "🔖", "나중에 볼 영상", "saved")}
        ${link("#/history", "🕘", "시청 기록", "history")}
        ${link("#/liked", "♥", "좋아요 표시한 영상", "liked")}
      </div>
      <div class="side-group"><div class="side-title">ORAE LONGEVITY CLUB</div>
        ${link("/", "🩺", "ORAE 홈", "orae-home")}
        ${link("/booking", "📅", "검진 예약", "orae-booking")}
        ${link("/membership", "👑", "멤버십 가입", "orae-membership")}
      </div>
      <div class="side-group"><div class="side-title">카테고리</div>
        ${CATEGORIES.map(c => link("#/c/" + c.id, c.icon, c.name, "c:" + c.id)).join("")}
      </div>
      <div class="side-group"><div class="side-title">연사 · 채널</div>
        ${speakers().slice(0, 14).map(s => `<a class="side-link ${route === "s:" + s ? "active" : ""}" href="#/s/${encodeURIComponent(s)}">${avatar(s)}<span>${esc(s)}</span></a>`).join("")}
      </div>
      <div class="side-foot">LongeviTube는 ORAE LONGEVITY CLUB이 운영하는 장수·건강수명 영상 큐레이션입니다. 영상 내용은 의학적 진단·치료를 대신하지 않습니다.<br><br>© LongeviTube · <a href="/admin/longevitube/">관리자</a></div>`;
  }

  /* ── 페이지 */
  function pageHome() {
    const vids = allVideos();
    const banner = `<section class="banner">
      <div><h2>오래 사는 것보다, 건강하게 오래</h2>
      <p>노화 과학부터 운동·영양·수면·뇌 건강까지. 건강수명(healthy lifespan)을 늘리는 데 도움이 되는 강의와 인터뷰를 주제별로 모았습니다.</p></div>
      <div class="banner-stats"><div><b>${vids.length}</b><span>영상</span></div><div><b>${CATEGORIES.length}</b><span>주제</span></div><div><b>${speakers().length}</b><span>연사·채널</span></div></div>
    </section>`;
    return chips() + banner + sortBar("모든 영상") + grid(sorted(vids));
  }
  function pageCat(id) {
    const c = CAT[id];
    if (!c) return notFound();
    return chips(id) + sortBar(`${c.icon} ${c.name}`) + grid(sorted(allVideos().filter(v => inCat(v, id))));
  }
  function pageNew() {
    const l = allVideos().filter(v => v.mine);
    return `<div class="toolbar" style="margin-top:20px"><h1>➕ 내가 추가한 영상</h1></div>` + grid(l, "상단의 ‘영상 추가’ 버튼으로 유튜브 영상을 추가해 보세요.");
  }
  function pageList(title, ids, emptyMsg, clearKey) {
    const l = ids.map(byId).filter(Boolean);
    const clear = clearKey && l.length ? `<button class="link-btn" data-clear="${clearKey}">모두 지우기</button>` : "";
    return `<div class="toolbar" style="margin-top:20px"><h1>${title}</h1>${clear}</div>` + grid(l, emptyMsg);
  }
  function pageSpeaker(name) {
    const l = allVideos().filter(v => v.speaker === name);
    if (!l.length) return notFound();
    const cats = [...new Set(l.flatMap(v => catsOf(v).map(c => CAT[c].name)))];
    return `<section class="channel-head">${avatar(name)}<div><h1>${esc(name)}</h1>
      <div class="sub">영상 ${l.length}개 · ${esc(cats.join(", "))}</div>
      <div class="sub"><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(name)}" target="_blank" rel="noopener">유튜브에서 더 찾아보기 ↗</a></div></div></section>` + grid(sorted(l));
  }
  function pageSearch(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = v => [v.title, v.orig, v.channel, v.desc, v.speaker, catsOf(v).map(c => CAT[c].name).join(" "), (v.tags || []).join(" "), (v.points || []).join(" ")].join(" ").toLowerCase();
    const l = allVideos().filter(v => terms.every(t => hay(v).includes(t)));
    return `<div class="toolbar" style="margin-top:20px"><h1>‘${esc(q)}’ 검색 결과 ${l.length}개</h1></div>` +
      grid(l, `일치하는 영상이 없습니다.<br><br><a class="pill" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q + " longevity")}" target="_blank" rel="noopener">유튜브에서 ‘${esc(q)}’ 검색 ↗</a>`);
  }
  function pageWatch(id) {
    const v = byId(id);
    if (!v) return notFound();
    history = [id].concat(history.filter(x => x !== id)).slice(0, 60);
    store.set("history", history);

    const sp = v.speaker || "알 수 없음";
    const ytSearch = "https://www.youtube.com/results?search_query=" + encodeURIComponent(v.q || v.orig || v.title);
    const isKo = isKoV(v);
    const ytWatch = v.yt ? "https://www.youtube.com/watch?v=" + encodeURIComponent(v.yt) : ytSearch;
    const player = v.yt
      ? `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.yt)}?rel=0&hl=ko${koSubs && !isKo ? "&cc_load_policy=1&cc_lang_pref=ko" : ""}" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
      : `<div class="player">${genThumb(v)}<div class="player-cta"><a href="${ytSearch}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg>유튜브에서 영상 찾아보기</a></div></div>`;

    const related = allVideos().filter(x => x.id !== id)
      .map(x => ({ x, s: (catId(x.cat) === catId(v.cat) ? 3 : catsOf(x).some(c => catsOf(v).includes(c)) ? 1 : 0) + (x.speaker === v.speaker ? 2 : 0) + (x.tags || []).filter(t => (v.tags || []).includes(t)).length }))
      .sort((a, b) => b.s - a.s).slice(0, 14).map(r => r.x);

    const notes = store.get("notes", {})[id] || "";
    const isSaved = saved.includes(id), isLiked = liked.has(id);

    return `<div class="watch">
      <div>
        ${player}
        ${v.yt && !isKo ? `<div class="langbar">
          <button class="pill ${koSubs ? "on" : ""}" data-act="subs" aria-pressed="${koSubs}"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h2M11 11h6"/></svg>한국어 자막 ${koSubs ? "켜짐" : "꺼짐"}</button>
          <details class="langhelp"><summary>한국어 자막·더빙이 안 나오나요?</summary>
            <ol>
              <li><b>자막이 영어로 나오면:</b> 플레이어 오른쪽 아래 ⚙️ 설정 → <b>자막</b> → <b>자동 번역</b> → <b>한국어</b></li>
              <li><b>한국어 더빙:</b> 유튜브 자동 더빙을 지원하는 영상만 ⚙️ 설정 → <b>오디오 트랙</b> → <b>한국어</b>가 나옵니다. 메뉴에 없으면 더빙이 없는 영상입니다.</li>
              <li>휴대폰 유튜브 앱으로 보면(‘유튜브에서 열기’) 앱 언어 설정에 따라 자막·더빙이 더 잘 적용되기도 합니다.</li>
            </ol>
          </details>
        </div>` : ""}
        <h1>${esc(v.title)}</h1>
        <div class="watch-bar">
          <div class="owner">${avatar(sp)}<div><b>${speakerLink(sp)}</b><span class="sub">${esc(v.channel ? v.channel : "")}${v.channel && catsOf(v).length ? " · " : ""}${esc(catsOf(v).map(c => CAT[c].icon + " " + CAT[c].name).join(", "))}</span></div></div>
          <div class="actions">
            <button class="pill ${isLiked ? "on" : ""}" data-act="like" aria-pressed="${isLiked}"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>좋아요</button>
            <button class="pill ${isSaved ? "on" : ""}" data-act="save" aria-pressed="${isSaved}"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>${isSaved ? "저장됨" : "나중에 보기"}</button>
            <a class="pill" href="${ytWatch}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>유튜브에서 열기</a>
            <button class="pill" data-act="share"><svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7M21 12H9a6 6 0 00-6 6"/></svg>공유</button>
            ${v.mine ? `<button class="pill" data-act="delete"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>삭제</button>` : ""}
          </div>
        </div>
        <div class="descbox">
          <div class="sub"><b>${esc(v.level || "입문")}</b>${v.format ? " · " + esc(v.format) : ""}${v.channel ? " · " + esc(v.channel) : ""}</div>
          ${v.orig ? `<div class="orig">원제: ${esc(v.orig)}</div>` : ""}
          ${v.desc ? `<p>${esc(v.desc)}</p>` : ""}
          ${v.points && v.points.length ? `<ul class="points">${v.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
          <div class="tags">${catsOf(v).map(c => `<a href="#/c/${c}">${CAT[c].icon} ${esc(CAT[c].name)}</a>`).join("")}</div>
          ${v.tags && v.tags.length ? `<div class="tags">${v.tags.map(t => `<a href="#/search/${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>` : ""}
          <div class="notice">※ 교육용 정보입니다. 약물·보충제 복용이나 식단·운동 변화는 의료진과 상의하세요.</div>
        </div>
        <section class="notes">
          <h3>📝 내 메모</h3>
          <textarea id="noteBox" placeholder="이 영상에서 기억할 내용이나 실천할 점을 적어보세요. (이 브라우저에만 저장)">${esc(notes)}</textarea>
          <div class="sub" id="noteState"></div>
        </section>
      </div>
      <aside class="related" aria-label="관련 영상">
        ${related.map(r => `<article class="rel">${thumb(r)}<div><h3 class="title"><a href="#/v/${encodeURIComponent(r.id)}">${esc(r.title)}</a></h3>
          <div class="sub">${speakerLink(r.speaker || "알 수 없음")}</div><div class="sub">${esc(r.channel || (CAT[catId(r.cat)] ? CAT[catId(r.cat)].name : ""))}</div></div></article>`).join("")}
      </aside></div>`;
  }
  function notFound() {
    return `<div class="empty"><div class="big">🔍</div>페이지를 찾을 수 없습니다.<br><br><a class="pill" href="#/">홈으로</a></div>`;
  }

  /* ── 라우터 */
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const [p, ...rest] = parts;
    const arg = decodeURIComponent(rest.join("/") || "");
    let html, key = "";
    switch (p) {
      case "": html = pageHome(); key = "home"; break;
      case "c":
        if (ALIAS[arg]) { location.replace("#/c/" + ALIAS[arg]); return; }
        html = pageCat(arg); key = "c:" + arg; break;
      case "s": html = pageSpeaker(arg); key = "s:" + arg; break;
      case "v": html = pageWatch(arg); break;
      case "mine": html = pageNew(); key = "mine"; break;
      case "ko": html = sortBar("🇰🇷 한국어 영상") + grid(sorted(allVideos().filter(isKoV))); key = "ko"; break;
      case "saved": html = pageList("🔖 나중에 볼 영상", saved, "‘나중에 보기’를 누른 영상이 여기에 모입니다."); key = "saved"; break;
      case "history": html = pageList("🕘 시청 기록", history, "아직 시청한 영상이 없습니다.", "history"); key = "history"; break;
      case "liked": html = pageList("♥ 좋아요 표시한 영상", [...liked], "좋아요를 누른 영상이 여기에 모입니다."); key = "liked"; break;
      case "search": html = pageSearch(arg); $("#searchInput").value = arg; break;
      default: html = notFound();
    }
    app.innerHTML = html;
    renderSidebar(key);
    document.body.classList.remove("drawer", "searching");
    window.scrollTo(0, 0);
    const v = p === "v" && byId(arg);
    document.title = v ? v.title + " - LongeviTube" : "LongeviTube | 장수 · 건강수명 영상 큐레이션";
    if (p === "v") bindNotes(arg);
  }

  function bindNotes(id) {
    const box = $("#noteBox"); if (!box) return;
    let t;
    box.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const n = store.get("notes", {}); n[id] = box.value; store.set("notes", n);
        $("#noteState").textContent = "저장됨 · " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      }, 400);
    });
  }

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ── 이벤트 */
  app.addEventListener("click", e => {
    const s = e.target.closest("[data-sort]");
    if (s) { sort = s.dataset.sort; store.set("sort", sort); route(); return; }
    const c = e.target.closest("[data-clear]");
    if (c) { history = []; store.set("history", []); route(); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const id = decodeURIComponent(location.hash.replace(/^#\/v\//, ""));
    const act = a.dataset.act;
    if (act === "like") {
      liked.has(id) ? liked.delete(id) : liked.add(id);
      store.set("liked", [...liked]); toast(liked.has(id) ? "좋아요 표시한 영상에 추가했습니다" : "좋아요를 취소했습니다");
    } else if (act === "save") {
      saved = saved.includes(id) ? saved.filter(x => x !== id) : [id].concat(saved);
      store.set("saved", saved); toast(saved.includes(id) ? "나중에 볼 영상에 저장했습니다" : "저장을 취소했습니다");
    } else if (act === "subs") {
      koSubs = !koSubs; store.set("koSubs", koSubs);
      toast(koSubs ? "한국어 자막을 자동으로 켭니다" : "자막 자동 켜기를 껐습니다");
    } else if (act === "share") {
      const url = location.href;
      if (navigator.share) { navigator.share({ title: document.title, url }).catch(() => {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("링크를 복사했습니다"), () => toast(url));
      return;
    } else if (act === "delete") {
      if (!confirm("내가 추가한 이 영상을 삭제할까요?")) return;
      store.set("mine", store.get("mine", []).filter(v => v.id !== id));
      toast("삭제했습니다"); location.hash = "#/"; return;
    }
    const y = window.scrollY; route(); window.scrollTo(0, y);
  });

  $("#searchForm").addEventListener("submit", e => {
    e.preventDefault();
    const q = $("#searchInput").value.trim();
    if (q) location.hash = "#/search/" + encodeURIComponent(q);
  });
  $("#searchToggle").addEventListener("click", () => { document.body.classList.add("searching"); $("#searchInput").focus(); });
  $("#searchInput").addEventListener("blur", () => setTimeout(() => document.body.classList.remove("searching"), 150));

  $("#menuBtn").addEventListener("click", () => {
    if (window.innerWidth <= 960) document.body.classList.toggle("drawer");
    else document.body.classList.toggle("mini");
  });
  $("#scrim").addEventListener("click", () => document.body.classList.remove("drawer"));

  $("#themeBtn").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("lt-theme", root.dataset.theme); } catch (e) {}
  });

  /* ── 영상 추가 */
  const dlg = $("#addDialog");
  $("#addCat").innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
  $("#addBtn").addEventListener("click", () => { $("#addForm").reset(); $("#addError").hidden = true; dlg.showModal(); });
  function parseYt(url) {
    const m = String(url).trim().match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/) || String(url).trim().match(/^([A-Za-z0-9_-]{11})$/);
    return m ? m[1] : null;
  }
  $("#addForm").addEventListener("submit", e => {
    if (e.submitter && e.submitter.value === "cancel") return;
    const f = new FormData(e.target);
    const yt = parseYt(f.get("url"));
    if (!yt) { e.preventDefault(); const er = $("#addError"); er.textContent = "유튜브 링크에서 영상 ID를 찾지 못했습니다."; er.hidden = false; return; }
    const v = {
      id: "my-" + yt, yt, cat: f.get("cat"), level: f.get("level"),
      title: f.get("title").trim(), speaker: f.get("speaker").trim() || "내 큐레이션",
      desc: f.get("desc").trim(), points: f.get("points").split("\n").map(s => s.trim()).filter(Boolean),
      date: new Date().toISOString().slice(0, 10), tags: []
    };
    store.set("mine", [v].concat(store.get("mine", []).filter(x => x.id !== v.id)));
    toast("영상을 추가했습니다");
    location.hash = "#/v/" + v.id;
  });

  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $("#searchInput").focus(); }
  });

  window.addEventListener("hashchange", route);
  route();
})();
