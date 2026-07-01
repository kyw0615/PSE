/* =========================================================
   PSE 단어장 — 앱 로직
   - 사이드바 네비게이션 (월/일)
   - URL 해시 라우팅 (#/AM1/day05)  → 월/일 왕복이 쉬움
   - 통합 퀴즈 엔진 (셔플 · 오답 재시도 · 스킵 · 방향전환)
   - 진행 상황 저장 (localStorage)
   ========================================================= */
(function () {
  "use strict";

  const DATA = window.PSE_DATA || { title: "PSE 단어장", subtitle: "", months: [] };
  const PREF_KEY = "pse.v1.prefs";
  const STAT_KEY = "pse.v1.stats";

  /* ---------- 저장소 헬퍼 ---------- */
  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  const prefs = Object.assign(
    { theme: null, shuffle: false, direction: "ko2en", collapsed: {} },
    lsGet(PREF_KEY, {})
  );
  function savePrefs() { lsSet(PREF_KEY, prefs); }

  let stats = lsGet(STAT_KEY, {}); // { "AM1/day05": { done:true, bestPct:100, bestWrong:0, attempts:3 } }
  function saveStats() { lsSet(STAT_KEY, stats); }

  /* ---------- 유틸 ---------- */
  // 대소문자 · 공백 · 문장부호 무시 (한글/영문/숫자만 비교)
  function normalize(str) {
    return (str || "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  }
  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  /* ---------- 데이터 접근 ---------- */
  function isDayDeck(id) { return /^day\d+$/.test(id); }

  function monthById(id) { return DATA.months.find(m => m.id === id) || null; }

  // 월의 "전체(모든 날)" 가상 덱 만들기
  function virtualAll(month) {
    const days = month.days.filter(d => isDayDeck(d.id));
    if (days.length < 2) return null;
    return {
      id: "__all__", label: "전체", topic: `${days.length}일 · 모든 날 복습`,
      count: days.reduce((s, d) => s + d.count, 0), virtual: true,
    };
  }

  // 실제 단어 목록을 가진 덱 해석 (words 포함)
  function resolveDeck(monthId, deckId) {
    const month = monthById(monthId);
    if (!month) return null;
    if (deckId === "__all__") {
      const v = virtualAll(month);
      if (!v) return null;
      const words = [];
      month.days.filter(d => isDayDeck(d.id)).forEach(d => words.push.apply(words, d.words));
      return { monthId, month, deckId, label: v.label, topic: v.topic, words, virtual: true };
    }
    const deck = month.days.find(d => d.id === deckId);
    if (!deck) return null;
    return { monthId, month, deckId, label: deck.label, topic: deck.topic, words: deck.words, virtual: false };
  }

  function deckKey(monthId, deckId) { return monthId + "/" + deckId; }

  // 월 진행률 (완료한 day / 전체 day)
  function monthProgress(month) {
    const days = month.days.filter(d => isDayDeck(d.id));
    const done = days.filter(d => stats[deckKey(month.id, d.id)] && stats[deckKey(month.id, d.id)].done).length;
    return { done, total: days.length };
  }
  // 월 단어 수 — 통합본(all) 같은 중복 덱은 제외하고 실제 day 덱만 합산
  function monthWordCount(month) {
    return month.days.filter(d => isDayDeck(d.id)).reduce((s, d) => s + d.count, 0);
  }

  /* ---------- 라우팅 ---------- */
  function parseHash() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    if (!h) return { view: "home" };
    const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
    const parts = h.split("/").filter(Boolean);
    if (parts.length >= 2) return { view: "deck", monthId: dec(parts[0]), deckId: dec(parts[1]) };
    if (parts.length === 1) return { view: "month", monthId: dec(parts[0]) };
    return { view: "home" };
  }
  function hashOf(monthId, deckId) {
    return deckId ? `#/${encodeURIComponent(monthId)}/${encodeURIComponent(deckId)}` : (monthId ? `#/${encodeURIComponent(monthId)}` : "#/");
  }
  function go(monthId, deckId) { location.hash = hashOf(monthId, deckId); }

  /* ---------- 사이드바 렌더 ---------- */
  let searchTerm = "";

  function renderSidebar(route) {
    const nav = document.getElementById("nav");
    nav.innerHTML = "";
    const q = searchTerm.trim().toLowerCase();

    let anyShown = false;
    DATA.months.forEach(month => {
      const va = virtualAll(month);
      const decks = [];
      if (va) decks.push(va);
      month.days.forEach(d => decks.push(d));

      // 검색 필터
      const filtered = decks.filter(d => {
        if (!q) return true;
        const hay = (d.label + " " + (d.topic || "") + " " + month.name + " " + d.id).toLowerCase();
        return hay.includes(q);
      });
      if (!filtered.length) return;
      anyShown = true;

      const prog = monthProgress(month);
      const collapsed = q ? false : !!prefs.collapsed[month.id];
      const group = el(`<div class="month-group ${collapsed ? "collapsed" : ""}" data-month="${esc(month.id)}"></div>`);

      const head = el(`
        <button class="month-head" type="button">
          <span class="caret">▼</span>
          <span>${esc(month.name)}</span>
          ${prog.total ? `<span class="prog">${prog.done}/${prog.total}</span>` : ""}
          <span class="count-pill">${monthWordCount(month)}단어</span>
        </button>`);
      head.addEventListener("click", () => {
        prefs.collapsed[month.id] = !prefs.collapsed[month.id];
        savePrefs();
        group.classList.toggle("collapsed");
      });
      group.appendChild(head);

      const list = el(`<div class="day-list"></div>`);
      filtered.forEach(d => {
        const key = deckKey(month.id, d.id);
        const st = stats[key];
        const isActive = route.view === "deck" && route.monthId === month.id && route.deckId === d.id;
        const item = el(`
          <a class="day-item ${d.virtual ? "all-item" : ""} ${isActive ? "active" : ""}" href="#/${esc(month.id)}/${esc(d.id)}">
            <span class="d-label">${esc(d.label)}${d.topic && !d.virtual ? ` <span class="d-topic">· ${esc(d.topic)}</span>` : ""}</span>
            <span class="d-count">${d.count}</span>
            ${st && st.done ? `<span class="d-check" role="img" aria-label="완료" title="완료">✓</span>` : ""}
          </a>`);
        item.addEventListener("click", () => { closeNav(); });
        list.appendChild(item);
      });
      group.appendChild(list);
      nav.appendChild(group);
    });

    if (!anyShown) nav.appendChild(el(`<div class="nav-empty">검색 결과가 없어요.</div>`));
  }

  /* ---------- 퀴즈 세션 ---------- */
  let session = null; // 활성 세션

  function newSession(rd) {
    return {
      rd,                       // resolveDeck 결과
      stage: "preview",
      baseList: rd.words.slice(),
      quizList: rd.words.slice(),
      history: [],
      correct: 0, wrong: 0,
      shuffle: prefs.shuffle,
      direction: prefs.direction, // ko2en | en2ko
    };
  }

  function rebuildQuizList(s) {
    // 이미 푼 단어(done) + 남은 단어(remaining). 완전히 동일한 단어쌍은 한 번만 출제.
    const doneSet = new Set(s.history.map(h => h.korean + "|" + h.english));
    const seen = new Set(doneSet);
    let remaining = s.baseList.filter(w => {
      const k = w.korean + "|" + w.english;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    if (s.shuffle) remaining = shuffleArray(remaining);
    const done = s.history.map(h => ({ korean: h.korean, english: h.english }));
    s.quizList = done.concat(remaining);
  }

  function promptText(s, w) { return s.direction === "ko2en" ? w.korean : w.english; }
  function answerText(s, w) { return s.direction === "ko2en" ? w.english : w.korean; }

  /* ---------- 메인 렌더 ---------- */
  function render() {
    const route = parseHash();
    renderSidebar(route);

    if (route.view === "deck") {
      const rd = resolveDeck(route.monthId, route.deckId);
      if (!rd) { renderNotFound(); return; }
      // 같은 덱이면 세션 유지, 아니면 새로 시작
      if (!session || deckKey(session.rd.monthId, session.rd.deckId) !== deckKey(rd.monthId, rd.deckId)) {
        session = newSession(rd);
      }
      renderDeck();
    } else if (route.view === "month") {
      const m = monthById(route.monthId);
      if (!m) { renderNotFound(); return; }
      // 월 클릭 시 첫 번째 날로 이동. replace 로 중간 이력을 남기지 않아 뒤로가기가 정상 동작.
      const first = (virtualAll(m) ? "__all__" : (m.days[0] && m.days[0].id));
      if (first) { location.replace(hashOf(m.id, first)); return; }
      renderHome();
    } else {
      session = null;
      renderHome();
    }
    // 마지막 위치 기억
    if (route.view === "deck") lsSet("pse.v1.last", route);
  }

  function mainEl() { return document.getElementById("main-content"); }

  function renderNotFound() {
    mainEl().innerHTML = `
      <div class="content">
        <div class="card" style="text-align:center">
          <div style="font-size:44px">🤔</div>
          <h2>페이지를 찾을 수 없어요</h2>
          <p class="deck-sub">주소가 바뀌었거나 삭제된 단어장일 수 있어요.</p>
          <a class="btn btn-primary" href="#/">홈으로</a>
        </div>
      </div>`;
  }

  /* ----- 홈 ----- */
  function renderHome() {
    // 통합본(all)·전체 같은 중복/가상 덱은 제외하고 실제 day 덱 기준으로 집계
    let totalWords = 0, totalDecks = 0, doneDecks = 0;
    DATA.months.forEach(m => m.days.forEach(d => {
      if (!isDayDeck(d.id)) return;
      totalWords += d.count; totalDecks++;
      const st = stats[deckKey(m.id, d.id)];
      if (st && st.done) doneDecks++;
    }));

    const last = lsGet("pse.v1.last", null);
    let continueHtml = "";
    if (last && last.monthId && resolveDeck(last.monthId, last.deckId)) {
      const rd = resolveDeck(last.monthId, last.deckId);
      continueHtml = `<div class="continue-cta">
        <a class="btn btn-primary btn-lg" href="#/${esc(last.monthId)}/${esc(last.deckId)}">▶ 이어서 학습 — ${esc(rd.month.name)} ${esc(rd.label)}</a>
      </div>`;
    }

    const cards = DATA.months.map(m => {
      const prog = monthProgress(m);
      const pct = prog.total ? Math.round(prog.done / prog.total * 100) : 0;
      const words = monthWordCount(m);
      const chips = m.days.map(d => {
        const st = stats[deckKey(m.id, d.id)];
        const done = st && st.done;
        return `<a class="day-chip ${done ? "done" : ""}" href="#/${esc(m.id)}/${esc(d.id)}" title="${esc(d.topic || d.label)} · ${d.count}단어${done ? " · 완료" : ""}">${esc(d.label)}</a>`;
      }).join("");
      return `
        <div class="month-card">
          <h3>📗 ${esc(m.name)}</h3>
          <div class="m-meta">${prog.total}개 단어장 · ${words}단어 · 완료 ${prog.done}/${prog.total}</div>
          <div class="m-prog"><span style="width:${pct}%"></span></div>
          <div class="day-chips">${chips}</div>
        </div>`;
    }).join("");

    mainEl().innerHTML = `
      <div class="content">
        <div class="home-hero">
          <div class="logo-lg">P</div>
          <h1>${esc(DATA.title || "PSE 단어장")}</h1>
          <p>${esc(DATA.subtitle || "월별 · 일별 영단어 퀴즈")}</p>
        </div>
        <div class="stat-strip">
          <div class="stat"><div class="num">${DATA.months.length}</div><div class="lbl">월(月)</div></div>
          <div class="stat"><div class="num">${totalDecks}</div><div class="lbl">단어장</div></div>
          <div class="stat"><div class="num">${totalWords}</div><div class="lbl">단어</div></div>
          <div class="stat"><div class="num">${doneDecks}</div><div class="lbl">완료</div></div>
        </div>
        ${continueHtml}
        <div class="month-cards">${cards}</div>
      </div>`;
  }

  /* ----- 덱(단어장) 뷰 ----- */
  function renderDeck() {
    const s = session, rd = s.rd;
    const prevNext = neighborDecks(rd.monthId, rd.deckId);

    const breadcrumb = `
      <div class="breadcrumb">
        <a href="#/">홈</a><span class="sep">/</span>
        <a href="#/${esc(rd.monthId)}">${esc(rd.month.name)}</a><span class="sep">/</span>
        <span class="cur">${esc(rd.label)}</span>
        <span class="deck-nav">
          ${prevNext.prev ? `<a class="btn btn-ghost btn-sm" href="#/${esc(rd.monthId)}/${esc(prevNext.prev.id)}" title="${esc(prevNext.prev.label)}">← 이전</a>` : ""}
          ${prevNext.next ? `<a class="btn btn-ghost btn-sm" href="#/${esc(rd.monthId)}/${esc(prevNext.next.id)}" title="${esc(prevNext.next.label)}">다음 →</a>` : ""}
        </span>
      </div>`;

    // 미리보기 단계에선 전체 단어 수, 퀴즈/결과 단계에선 실제 출제 수(틀린단어 재시도 반영)
    const headerCount = s.stage === "preview" ? rd.words.length : s.quizList.length;
    const header = `
      <div class="deck-title">
        <h1>${esc(rd.month.name)} · ${esc(rd.label)}</h1>
        ${rd.topic ? `<span class="topic-badge">${esc(rd.topic)}</span>` : ""}
      </div>
      <p class="deck-sub">${headerCount}개 단어</p>`;

    let body = "";
    if (s.stage === "preview") body = viewPreview(s);
    else if (s.stage === "quiz") body = viewQuiz(s);
    else body = viewResults(s);

    mainEl().innerHTML = `<div class="content">${breadcrumb}<div class="card">${header}${body}</div></div>`;

    if (s.stage === "preview") bindPreview(s);
    else if (s.stage === "quiz") bindQuiz(s);
    else bindResults(s);
  }

  function neighborDecks(monthId, deckId) {
    const m = monthById(monthId);
    const list = [];
    if (virtualAll(m)) list.push({ id: "__all__", label: "전체" });
    m.days.forEach(d => list.push({ id: d.id, label: d.label }));
    const i = list.findIndex(x => x.id === deckId);
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
  }

  /* ----- Stage: 미리보기 ----- */
  function viewPreview(s) {
    const dirLabel = s.direction === "ko2en" ? "한국어 → English" : "English → 한국어";
    return `
      <div class="btn-row" style="margin:16px 0 18px">
        <button class="toggle ${s.shuffle ? "on" : ""}" id="t-shuffle" aria-pressed="${s.shuffle}"><span class="dot"></span> 셔플 ${s.shuffle ? "ON" : "OFF"}</button>
        <button class="toggle ${s.direction === "en2ko" ? "on" : ""}" id="t-dir" aria-pressed="${s.direction === "en2ko"}"><span class="dot"></span> ${dirLabel}</button>
        <button class="btn btn-primary btn-lg" id="b-start" style="margin-left:auto">퀴즈 시작 ▶</button>
      </div>
      <div class="table-scroll">${vocabTable(s.rd.words)}</div>`;
  }
  function bindPreview(s) {
    document.getElementById("t-shuffle").onclick = () => { s.shuffle = !s.shuffle; prefs.shuffle = s.shuffle; savePrefs(); renderDeck(); };
    document.getElementById("t-dir").onclick = () => {
      s.direction = s.direction === "ko2en" ? "en2ko" : "ko2en";
      prefs.direction = s.direction; savePrefs(); renderDeck();
    };
    document.getElementById("b-start").onclick = () => {
      s.stage = "quiz"; s.history = []; s.correct = 0; s.wrong = 0;
      s.baseList = s.rd.words.slice(); rebuildQuizList(s); renderDeck();
    };
  }

  function vocabTable(words) {
    const rows = words.map((w, i) =>
      `<tr><td class="idx">${i + 1}</td><td class="kor">${esc(w.korean)}</td><td class="eng">${esc(w.english)}</td></tr>`
    ).join("");
    return `<table class="vocab-table"><thead><tr><th class="idx">#</th><th>한국어</th><th>English</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  /* ----- Stage: 퀴즈 ----- */
  function viewQuiz(s) {
    const idx = s.history.length;
    const total = s.quizList.length;
    const curr = s.quizList[idx];
    const pct = total ? Math.round(idx / total * 100) : 0;

    // 마지막 결과 알림
    let lastHtml = "";
    if (s.history.length) {
      const h = s.history[s.history.length - 1];
      lastHtml = h.isCorrect
        ? `<span class="chip ok">✅ ${esc(h.korean)} → ${esc(h.english)}</span>`
        : `<span class="chip no">❌ 정답: ${esc(h.english)}${h.userAnswer ? ` &nbsp;(내 답: ${esc(h.userAnswer)})` : ""}</span>`;
    }

    return `
      <div class="quiz-head">
        <div class="scoreboard"><span class="ok">맞음 ${s.correct}</span><span class="no">틀림 ${s.wrong}</span></div>
        <div class="qcounter">${Math.min(idx + 1, total)} / ${total}</div>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="last-result">${lastHtml}</div>
      <div class="question"><span class="qnum">Q${idx + 1}</span>${esc(promptText(s, curr))}</div>
      <div class="dir-hint">${s.direction === "ko2en" ? "영어로 입력하세요" : "한국어로 입력하세요"}</div>
      <input class="answer-input" id="answer" type="text" aria-label="정답 입력" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="정답 입력 후 Enter" />
      <div class="feedback" id="feedback"></div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-success" id="b-submit">제출 (Enter)</button>
        <button class="btn btn-ghost" id="b-skip">모르겠어요 (Skip)</button>
        <button class="btn btn-danger btn-sm" id="b-stop" style="margin-left:auto">그만두기</button>
      </div>
      <details class="cheat"><summary>단어장 커닝</summary><div class="table-scroll">${vocabTable(s.rd.words)}</div></details>`;
  }

  function bindQuiz(s) {
    const input = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const idx = s.history.length;
    const curr = s.quizList[idx];

    function focus() { input.focus(); try { input.select(); } catch (e) {} }
    focus();

    function submit() {
      const val = input.value.trim();
      if (!val) { feedback.textContent = "정답을 입력한 뒤 Enter를 눌러주세요."; feedback.className = "feedback err"; focus(); return; }
      const ok = normalize(val) === normalize(answerText(s, curr));
      if (!ok) {
        feedback.textContent = "오답이에요. 다시 시도해 보세요.";
        feedback.className = "feedback err";
        input.classList.remove("shake", "wrong"); void input.offsetWidth;
        input.classList.add("shake", "wrong"); focus();
        return; // 정답을 맞힐 때까지 진행하지 않음 (AM1 방식)
      }
      s.history.push({ korean: curr.korean, english: curr.english, isCorrect: true, userAnswer: val });
      s.correct++; goNext();
    }
    function skip() {
      const val = input.value.trim();
      s.history.push({ korean: curr.korean, english: curr.english, isCorrect: false, userAnswer: val });
      s.wrong++; goNext();
    }
    function goNext() {
      if (s.history.length < s.quizList.length) { renderDeck(); }
      else { finish(s); }
    }

    document.getElementById("b-submit").onclick = submit;
    document.getElementById("b-skip").onclick = skip;
    document.getElementById("b-stop").onclick = () => { s.stage = "preview"; renderDeck(); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  }

  /* ----- Stage: 결과 ----- */
  function finish(s) {
    s.stage = "results";
    // 통계 저장
    const total = s.correct + s.wrong;
    const pct = total ? Math.round(s.correct / total * 100) : 0;
    const key = deckKey(s.rd.monthId, s.rd.deckId);
    const prev = stats[key] || { attempts: 0, bestPct: 0, bestWrong: 9999 };
    stats[key] = {
      done: true,
      attempts: (prev.attempts || 0) + 1,
      bestPct: Math.max(prev.bestPct || 0, pct),
      bestWrong: Math.min(prev.bestWrong != null ? prev.bestWrong : 9999, s.wrong),
      lastPct: pct,
    };
    saveStats();
    renderDeck();
    renderSidebar(parseHash()); // 완료 표시(✓)·월 진행률 즉시 갱신
  }

  function viewResults(s) {
    const total = s.correct + s.wrong;
    const pct = total ? Math.round(s.correct / total * 100) : 0;
    const wrongItems = s.history.filter(h => !h.isCorrect);
    const perfect = s.wrong === 0;

    let wrongBlock;
    if (wrongItems.length) {
      const rows = wrongItems.map((h, i) =>
        `<tr><td class="idx">${i + 1}</td><td class="kor">${esc(h.korean)}</td><td class="eng">${esc(h.english)}</td></tr>`
      ).join("");
      wrongBlock = `
        <p class="deck-sub" style="margin-top:18px"><strong>틀린 단어 ${wrongItems.length}개</strong></p>
        <div class="table-scroll"><table class="vocab-table"><thead><tr><th class="idx">#</th><th>한국어</th><th>English</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } else {
      wrongBlock = "";
    }

    const nb = neighborDecks(s.rd.monthId, s.rd.deckId);
    return `
      <div class="result-hero">
        <div class="emoji">${perfect ? "🎉" : pct >= 80 ? "👍" : "💪"}</div>
        <div class="score-ring ${perfect ? "perfect" : ""}">${pct}%</div>
        <h2>${perfect ? "완벽해요!" : "퀴즈 완료!"}</h2>
        <p>맞음 ${s.correct} · 틀림 ${s.wrong} (총 ${total})</p>
      </div>
      <div class="btn-row" style="justify-content:center">
        ${wrongItems.length ? `<button class="btn btn-warn" id="b-retry">틀린 단어만 다시 (${wrongItems.length})</button>` : ""}
        <button class="btn btn-info" id="b-restart">처음부터 다시</button>
        ${nb.next ? `<a class="btn btn-primary" href="#/${esc(s.rd.monthId)}/${esc(nb.next.id)}">다음: ${esc(nb.next.label)} →</a>` : `<a class="btn btn-ghost" href="#/">홈으로</a>`}
      </div>
      ${wrongBlock}`;
  }

  function bindResults(s) {
    const retry = document.getElementById("b-retry");
    if (retry) retry.onclick = () => {
      s.baseList = s.history.filter(h => !h.isCorrect).map(h => ({ korean: h.korean, english: h.english }));
      s.history = []; s.correct = 0; s.wrong = 0; s.stage = "quiz"; rebuildQuizList(s); renderDeck();
    };
    document.getElementById("b-restart").onclick = () => {
      s.baseList = s.rd.words.slice(); s.history = []; s.correct = 0; s.wrong = 0;
      s.stage = "quiz"; rebuildQuizList(s); renderDeck();
    };
  }

  /* ---------- 테마 ---------- */
  function applyTheme(t) {
    const theme = t || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-btn");
    if (btn) btn.innerHTML = theme === "dark" ? "☀️ 라이트 모드" : "🌙 다크 모드";
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    prefs.theme = next; savePrefs(); applyTheme(next);
  }

  /* ---------- 모바일 네비 (접근성: 포커스 이동 · Esc 닫기 · 배경 inert) ---------- */
  let lastFocused = null;
  function openNav() {
    lastFocused = document.activeElement;
    document.body.classList.add("nav-open");
    const btn = document.getElementById("menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "true");
    const main = document.querySelector(".main");
    if (main) main.setAttribute("inert", "");
    const search = document.getElementById("search");
    if (search) search.focus();
  }
  function closeNav() {
    if (!document.body.classList.contains("nav-open")) return;
    document.body.classList.remove("nav-open");
    const btn = document.getElementById("menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
    const main = document.querySelector(".main");
    if (main) main.removeAttribute("inert");
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
  }

  /* ---------- 초기화 ---------- */
  function boot() {
    document.getElementById("app-root").innerHTML = `
      <div class="backdrop" id="backdrop"></div>
      <header class="topbar">
        <button class="icon-btn" id="menu-btn" aria-label="메뉴 열기" aria-controls="nav" aria-expanded="false">☰</button>
        <span class="brand" id="brand-m">${esc(DATA.title || "PSE 단어장")}</span>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-head">
            <div class="title" id="brand"><span class="logo">P</span><span>${esc(DATA.title || "PSE 단어장")}</span></div>
            <div class="subtitle">${esc(DATA.subtitle || "")}</div>
          </div>
          <div class="search-wrap"><input id="search" type="search" aria-label="월 · 일 · 주제 검색" placeholder="🔍 월 · 일 · 주제 검색" autocomplete="off" /></div>
          <nav class="nav" id="nav"></nav>
          <div class="sidebar-foot">
            <button class="theme-btn" id="theme-btn" type="button">🌙 다크 모드</button>
          </div>
        </aside>
        <main class="main"><div id="main-content"></div></main>
      </div>`;

    applyTheme(prefs.theme);

    document.getElementById("theme-btn").onclick = toggleTheme;
    document.getElementById("menu-btn").onclick = openNav;
    document.getElementById("backdrop").onclick = closeNav;
    document.getElementById("brand").onclick = () => { go(""); closeNav(); };
    document.getElementById("brand-m").onclick = () => { go(""); closeNav(); };
    document.getElementById("search").addEventListener("input", e => {
      searchTerm = e.target.value; renderSidebar(parseHash());
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) closeNav();
    });

    window.addEventListener("hashchange", render);
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener && mq.addEventListener("change", () => { if (!prefs.theme) applyTheme(null); });
    }

    render();
  }

  // 데이터 없음 방어
  if (!DATA.months || !DATA.months.length) {
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("app-root").innerHTML =
        `<div style="padding:40px;text-align:center;font-family:sans-serif">
           <h2>데이터를 불러오지 못했어요.</h2>
           <p>먼저 <code>python build.py</code> 를 실행해 <code>docs/data/bundle.js</code> 를 생성하세요.</p>
         </div>`;
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
