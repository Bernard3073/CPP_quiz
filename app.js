(() => {
  "use strict";

  const VAULT = "Obsidian Vault";
  const FLASH_NOTE = "cpp/C++ Systems Quiz";
  const STORE_KEY = "cppquiz.v1";
  const app = document.getElementById("app");

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function inline(s) {
    // s is already escaped; handle `code`, **bold**, [[wikilinks]]
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) =>
        `<a href="${obsidianUrl(target)}" title="Open in Obsidian">${label || target}</a>`);
  }

  // Minimal markdown: fenced code blocks, paragraphs, inline formatting.
  function md(text) {
    const out = [];
    const parts = String(text).split(/```[a-z]*\n?/);
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        out.push(`<pre><code>${esc(part.replace(/\n$/, ""))}</code></pre>`);
      } else {
        part.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
          .forEach((p) => out.push(`<p>${inline(esc(p)).replace(/\n/g, "<br>")}</p>`));
      }
    });
    return out.join("");
  }

  const obsidianUrl = (note) => `obsidian://open?vault=${encodeURIComponent(VAULT)}&file=${encodeURIComponent(note)}`;
  const noteName = (note) => note.split("/").pop();

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- data ----------
  const MCQ = window.MCQ.map((q) => ({ ...q, id: "m" + hash(q.q) }));
  const CARDS = window.FLASHCARDS.map((c) => ({ ...c, t: c.section }));

  const topicsOf = (items) => {
    const m = new Map();
    items.forEach((x) => m.set(x.t, (m.get(x.t) || 0) + 1));
    return [...m.entries()];
  };

  // ---------- persistence ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  const store = Object.assign({ mcq: {}, flash: {}, settings: {} }, load());
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage unavailable */ }
  }
  function record(kind, id, ok) {
    const s = store[kind][id] || { right: 0, wrong: 0 };
    ok ? s.right++ : s.wrong++;
    s.last = ok ? 1 : 0;
    store[kind][id] = s;
    save();
  }
  const isWeak = (kind, id) => store[kind][id] && store[kind][id].last === 0;

  // ---------- theme ----------
  const themeBtn = document.getElementById("theme-toggle");
  if (store.settings.theme) document.documentElement.dataset.theme = store.settings.theme;
  themeBtn.onclick = () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    store.settings.theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = store.settings.theme;
    save();
  };
  document.getElementById("home-link").onclick = (e) => { e.preventDefault(); renderHome(); };

  // ---------- state ----------
  const settings = Object.assign({ mode: "mcq", count: 15, weakOnly: false, topics: null }, store.settings.quiz || {});
  let session = null;
  let keyHandler = null;
  const onKey = (fn) => { keyHandler = fn; };
  document.addEventListener("keydown", (e) => {
    if (keyHandler && !e.ctrlKey && !e.metaKey && !e.altKey) keyHandler(e);
  });

  function persistSettings() {
    store.settings.quiz = settings;
    save();
  }

  // ---------- home ----------
  function renderHome() {
    onKey(null);
    const items = settings.mode === "mcq" ? MCQ : CARDS;
    const kind = settings.mode === "mcq" ? "mcq" : "flash";
    const topics = topicsOf(items);
    const allTopics = topics.map(([t]) => t);
    if (!settings.topics || !settings.topics.every((t) => allTopics.includes(t))) {
      settings.topics = allTopics.slice();
    }

    const seen = items.filter((x) => store[kind][x.id]).length;
    const attempts = items.reduce((acc, x) => {
      const s = store[kind][x.id];
      return s ? { r: acc.r + s.right, w: acc.w + s.wrong } : acc;
    }, { r: 0, w: 0 });
    const weak = items.filter((x) => isWeak(kind, x.id)).length;
    const acc = attempts.r + attempts.w ? Math.round((100 * attempts.r) / (attempts.r + attempts.w)) + "%" : "—";

    app.innerHTML = `
      <section class="card">
        <h1>Test your C++ knowledge</h1>
        <p class="sub">${MCQ.length} multiple-choice questions written from your notes, plus the ${CARDS.length} open-ended questions in <em>C++ Systems Quiz</em>.</p>

        <div class="modes">
          <button class="mode ${settings.mode === "mcq" ? "active" : ""}" data-mode="mcq">
            <strong>Multiple choice</strong><span>Pick an answer, get instant feedback with an explanation and a link to the note.</span>
          </button>
          <button class="mode ${settings.mode === "flash" ? "active" : ""}" data-mode="flash">
            <strong>Flashcards</strong><span>Answer out loud first, reveal the answer, then grade yourself honestly.</span>
          </button>
        </div>

        <div class="row"><div class="label">Topics</div><span class="spacer"></span>
          <button class="ghost" id="all-topics" style="font-size:.85rem">All</button>
          <button class="ghost" id="no-topics" style="font-size:.85rem">None</button>
        </div>
        <div class="chips">
          ${topics.map(([t, n]) => `<button class="chip ${settings.topics.includes(t) ? "on" : ""}" data-topic="${esc(t)}">${esc(t)}<span class="n">${n}</span></button>`).join("")}
        </div>

        <div class="label">Questions per round</div>
        <div class="chips">
          ${[10, 15, 25, "all"].map((c) => `<button class="chip ${settings.count === c ? "on" : ""}" data-count="${c}">${c === "all" ? "All" : c}</button>`).join("")}
        </div>

        <div class="label">Options</div>
        <label class="toggle"><input type="checkbox" id="weak" ${settings.weakOnly ? "checked" : ""}> Only questions I got wrong last time (${weak})</label>

        <div class="actions">
          <button class="primary" id="start">Start ${settings.mode === "mcq" ? "quiz" : "flashcards"} →</button>
        </div>
      </section>

      <section class="card">
        <div class="row"><h2 style="margin:0">Your progress · ${settings.mode === "mcq" ? "multiple choice" : "flashcards"}</h2><span class="spacer"></span>
          <button class="ghost" id="reset" style="font-size:.85rem">Reset</button></div>
        <div class="stats" style="margin-top:12px">
          <div class="stat"><b>${seen}/${items.length}</b><span>questions seen</span></div>
          <div class="stat"><b>${acc}</b><span>accuracy</span></div>
          <div class="stat"><b>${weak}</b><span>to review</span></div>
        </div>
        <div class="bars" style="margin-top:16px">${topicBars(items, kind)}</div>
      </section>`;

    app.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => {
      settings.mode = b.dataset.mode; settings.topics = null; persistSettings(); renderHome();
    });
    app.querySelectorAll("[data-topic]").forEach((b) => b.onclick = () => {
      const t = b.dataset.topic;
      settings.topics = settings.topics.includes(t) ? settings.topics.filter((x) => x !== t) : [...settings.topics, t];
      persistSettings(); renderStartState();
    });
    app.querySelectorAll("[data-count]").forEach((b) => b.onclick = () => {
      settings.count = b.dataset.count === "all" ? "all" : Number(b.dataset.count); persistSettings(); renderHome();
    });
    document.getElementById("all-topics").onclick = () => { settings.topics = allTopics.slice(); persistSettings(); renderHome(); };
    document.getElementById("no-topics").onclick = () => { settings.topics = []; persistSettings(); renderStartState(); };
    document.getElementById("weak").onchange = (e) => { settings.weakOnly = e.target.checked; persistSettings(); renderStartState(); };
    document.getElementById("reset").onclick = () => {
      if (confirm(`Reset all ${settings.mode === "mcq" ? "multiple-choice" : "flashcard"} progress?`)) {
        store[kind] = {}; save(); renderHome();
      }
    };
    document.getElementById("start").onclick = () => start();
    renderStartState();

    function renderStartState() {
      app.querySelectorAll("[data-topic]").forEach((b) => b.classList.toggle("on", settings.topics.includes(b.dataset.topic)));
      const pool = poolFor(items, kind);
      const btn = document.getElementById("start");
      btn.disabled = pool.length === 0;
      btn.textContent = pool.length ? `Start ${settings.mode === "mcq" ? "quiz" : "flashcards"} (${Math.min(pool.length, settings.count === "all" ? pool.length : settings.count)}) →` : "No questions match";
    }
  }

  function topicBars(items, kind) {
    return topicsOf(items).map(([t]) => {
      let r = 0, w = 0;
      items.filter((x) => x.t === t).forEach((x) => { const s = store[kind][x.id]; if (s) { r += s.right; w += s.wrong; } });
      const pct = r + w ? Math.round((100 * r) / (r + w)) : null;
      const color = pct === null ? "var(--border)" : pct >= 80 ? "var(--good)" : pct >= 60 ? "#e8a317" : "var(--bad)";
      return `<div class="bar"><span>${esc(t)}</span><div class="track"><div class="fill" style="width:${pct ?? 0}%;background:${color}"></div></div><span style="color:var(--muted);text-align:right">${pct === null ? "—" : pct + "%"}</span></div>`;
    }).join("");
  }

  function poolFor(items, kind) {
    return items.filter((x) => settings.topics.includes(x.t) && (!settings.weakOnly || isWeak(kind, x.id)));
  }

  function start(fromItems) {
    const kind = settings.mode === "mcq" ? "mcq" : "flash";
    const items = settings.mode === "mcq" ? MCQ : CARDS;
    let pool = fromItems || shuffle(poolFor(items, kind));
    if (!fromItems && settings.count !== "all") pool = pool.slice(0, settings.count);
    session = { kind, items: pool, i: 0, results: [] };
    kind === "mcq" ? renderMcq() : renderCard();
  }

  // ---------- multiple choice ----------
  function renderMcq() {
    const q = session.items[session.i];
    const order = shuffle(q.o.map((_, i) => i));
    let answered = false;

    app.innerHTML = `
      <section class="card">
        ${header()}
        <div class="question">${inline(esc(q.q))}</div>
        ${q.c ? `<pre><code>${esc(q.c)}</code></pre>` : ""}
        <div class="options">
          ${order.map((oi, k) => `<button class="option" data-oi="${oi}"><span class="key">${k + 1}</span><span>${inline(esc(q.o[oi]))}</span></button>`).join("")}
        </div>
        <div id="fb"></div>
        <div class="actions">
          <button id="quit">End round</button>
          <button class="primary" id="next" disabled>${session.i + 1 === session.items.length ? "See results" : "Next"} →</button>
        </div>
      </section>`;

    const buttons = [...app.querySelectorAll(".option")];
    const choose = (btn) => {
      if (answered) return;
      answered = true;
      const picked = Number(btn.dataset.oi);
      const ok = picked === q.a;
      buttons.forEach((b) => {
        b.disabled = true;
        const oi = Number(b.dataset.oi);
        if (oi === q.a) b.classList.add("correct");
        else if (b === btn) b.classList.add("wrong");
        else b.classList.add("dim");
      });
      record("mcq", q.id, ok);
      session.results.push({ item: q, ok, picked });
      document.getElementById("fb").innerHTML = `
        <div class="feedback ${ok ? "good" : "bad"}">
          <div class="title">${ok ? "Correct" : "Not quite"}</div>
          <div>${inline(esc(q.e))}</div>
          <div class="source">Source: <a href="${obsidianUrl(q.n)}" title="Open in Obsidian">${esc(noteName(q.n))}</a></div>
        </div>`;
      const next = document.getElementById("next");
      next.disabled = false;
      next.focus();
    };
    buttons.forEach((b) => b.onclick = () => choose(b));
    document.getElementById("next").onclick = advance;
    document.getElementById("quit").onclick = renderResults;
    onKey((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= buttons.length && !answered) { e.preventDefault(); choose(buttons[n - 1]); }
      else if (e.key === "Enter" && answered) { e.preventDefault(); advance(); }
    });
  }

  // ---------- flashcards ----------
  function renderCard() {
    const c = session.items[session.i];
    let shown = false;

    app.innerHTML = `
      <section class="card">
        ${header()}
        <div class="question">${inline(esc(c.q))}</div>
        <div id="ans"></div>
        <div class="actions" id="card-actions">
          <button id="quit">End round</button>
          <button class="primary" id="reveal">Show answer <kbd>Space</kbd></button>
        </div>
      </section>`;

    const reveal = () => {
      if (shown) return;
      shown = true;
      document.getElementById("ans").innerHTML = `
        <div class="flash-answer">${md(c.a)}
          <div class="source">Source: <a href="${obsidianUrl(FLASH_NOTE)}">C++ Systems Quiz</a> · ${esc(c.id)}</div>
        </div>`;
      document.getElementById("card-actions").innerHTML = `
        <button id="quit">End round</button>
        <button id="miss" style="border-color:var(--bad);color:var(--bad)">Missed it <kbd>1</kbd></button>
        <button id="got" style="border-color:var(--good);color:var(--good)">Got it <kbd>2</kbd></button>`;
      document.getElementById("quit").onclick = renderResults;
      document.getElementById("miss").onclick = () => grade(false);
      document.getElementById("got").onclick = () => grade(true);
    };
    const grade = (ok) => {
      record("flash", c.id, ok);
      session.results.push({ item: c, ok });
      advance();
    };
    document.getElementById("reveal").onclick = reveal;
    document.getElementById("quit").onclick = renderResults;
    onKey((e) => {
      if ((e.key === " " || e.key === "Enter") && !shown) { e.preventDefault(); reveal(); }
      else if (shown && e.key === "1") grade(false);
      else if (shown && e.key === "2") grade(true);
    });
  }

  // ---------- shared ----------
  function header() {
    const { items, i, results } = session;
    const correct = results.filter((r) => r.ok).length;
    const item = items[i];
    return `
      <div class="progress"><div style="width:${(100 * i) / items.length}%"></div></div>
      <div class="meta">
        <span>Question ${i + 1} of ${items.length} · <span class="tag">${esc(item.t)}</span></span>
        <span>${correct} correct</span>
      </div>`;
  }

  function advance() {
    session.i++;
    if (session.i >= session.items.length) return renderResults();
    session.kind === "mcq" ? renderMcq() : renderCard();
    window.scrollTo({ top: 0 });
  }

  function renderResults() {
    onKey(null);
    const { results, kind } = session;
    const total = results.length;
    const correct = results.filter((r) => r.ok).length;
    const pct = total ? Math.round((100 * correct) / total) : 0;
    const verdict = !total ? "No questions answered." : pct >= 85 ? "Interview-ready on these topics." : pct >= 65 ? "Solid — review the weak topics below." : "Worth re-reading the linked notes before retrying.";
    const missed = results.filter((r) => !r.ok);

    const byTopic = topicsOf(results.map((r) => r.item)).map(([t, n]) => {
      const ok = results.filter((r) => r.item.t === t && r.ok).length;
      const p = Math.round((100 * ok) / n);
      const color = p >= 80 ? "var(--good)" : p >= 60 ? "#e8a317" : "var(--bad)";
      return `<div class="bar"><span>${esc(t)}</span><div class="track"><div class="fill" style="width:${p}%;background:${color}"></div></div><span style="text-align:right;color:var(--muted)">${ok}/${n}</span></div>`;
    }).join("");

    app.innerHTML = `
      <section class="card">
        <p class="score">${correct}/${total}</p>
        <p class="sub">${total ? pct + "% · " : ""}${verdict}</p>
        ${byTopic ? `<div class="bars">${byTopic}</div>` : ""}
        <div class="actions">
          <button id="home">Back to start</button>
          ${missed.length ? `<button id="retry-missed">Retry ${missed.length} missed</button>` : ""}
          <button class="primary" id="again">New round →</button>
        </div>
      </section>
      ${missed.length ? `
      <section class="card">
        <h2>Review what you missed</h2>
        <ol class="missed">
          ${missed.map((r) => kind === "mcq"
            ? `<li>${inline(esc(r.item.q))}<div class="ans">✓ ${inline(esc(r.item.o[r.item.a]))}</div>
                 <div class="source"><a href="${obsidianUrl(r.item.n)}">${esc(noteName(r.item.n))}</a></div></li>`
            : `<li>${inline(esc(r.item.q))}<div class="source">${esc(r.item.id)} · <a href="${obsidianUrl(FLASH_NOTE)}">C++ Systems Quiz</a></div></li>`).join("")}
        </ol>
      </section>` : ""}`;

    document.getElementById("home").onclick = renderHome;
    document.getElementById("again").onclick = () => start();
    const retry = document.getElementById("retry-missed");
    if (retry) retry.onclick = () => start(shuffle(missed.map((r) => r.item)));
    onKey((e) => { if (e.key === "Enter") { e.preventDefault(); start(); } });
  }

  renderHome();
})();
