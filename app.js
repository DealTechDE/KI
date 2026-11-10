(() => {
  const app = document.getElementById("app");
  const STORAGE_KEY = "grammarlab-progress";
  const PASS_PERCENT = 80;
  const QUIZ_LENGTH = 10;

  // ---------- Fortschritt ----------
  const loadProgress = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  };
  const saveScore = (id, percent) => {
    const p = loadProgress();
    p[id] = Math.max(p[id] || 0, percent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    renderOverall();
  };
  const renderOverall = () => {
    const p = loadProgress();
    const done = TOPICS.filter((t) => (p[t.id] || 0) >= PASS_PERCENT).length;
    document.getElementById("overallProgress").textContent = `✓ ${done} / ${TOPICS.length} Themen`;
  };

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Gesamten Lernfortschritt löschen?")) {
      localStorage.removeItem(STORAGE_KEY);
      renderOverall();
      route();
    }
  });

  // ---------- Hilfsfunktionen ----------
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normalize = (s) =>
    s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const correctText = (ex) => (ex.type === "mc" ? ex.options[ex.answer] : ex.answer[0]);

  // ---------- Startseite ----------
  let levelFilter = "Alle";

  function renderHome() {
    const p = loadProgress();
    const levels = ["Alle", ...new Set(TOPICS.map((t) => t.level))].sort((a, b) =>
      a === "Alle" ? -1 : b === "Alle" ? 1 : a.localeCompare(b)
    );
    const topics = TOPICS.filter((t) => levelFilter === "Alle" || t.level === levelFilter);

    app.innerHTML = `
      <h1>Englische Grammatik – verständlich erklärt</h1>
      <p class="lead">Wähle ein Thema, lies die Erklärung und teste dich mit Übungen.
      Ab ${PASS_PERCENT}&nbsp;% richtig gilt ein Thema als geschafft.</p>
      <div class="filters">
        ${levels.map((l) => `<button class="chip ${l === levelFilter ? "active" : ""}" data-level="${l}">${l}</button>`).join("")}
      </div>
      <div class="grid">
        ${topics.map((t) => {
          const score = p[t.id];
          const done = score >= PASS_PERCENT;
          return `
            <a class="card" href="#/topic/${t.id}">
              <h3>${t.title}</h3>
              <p>${t.summary}</p>
              <div class="card-meta">
                <span class="level ${t.level}">${t.level}</span>
                <span class="score ${done ? "done" : ""}">
                  ${score === undefined ? "Noch nicht geübt" : (done ? "✓ " : "") + "Bestwert " + score + " %"}
                </span>
              </div>
            </a>`;
        }).join("")}
      </div>`;

    app.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => { levelFilter = b.dataset.level; renderHome(); })
    );
  }

  // ---------- Themenseite ----------
  function renderTopic(id, tab = "learn") {
    const t = TOPICS.find((x) => x.id === id);
    if (!t) { location.hash = "#/"; return; }

    app.innerHTML = `
      <a class="back" href="#/">← Alle Themen</a>
      <h1>${t.title} <span class="level ${t.level}">${t.level}</span></h1>
      <p class="lead">${t.summary}</p>
      <div class="tabs">
        <button class="tab ${tab === "learn" ? "active" : ""}" data-tab="learn">📖 Erklärung</button>
        <button class="tab ${tab === "practice" ? "active" : ""}" data-tab="practice">✏️ Übungen (${t.exercises.length})</button>
      </div>
      <div id="tabContent"></div>`;

    app.querySelectorAll(".tab").forEach((b) =>
      b.addEventListener("click", () => renderTopic(id, b.dataset.tab))
    );

    const content = document.getElementById("tabContent");
    if (tab === "learn") {
      content.innerHTML = `
        <div class="panel">
          <h3>Wann benutze ich es?</h3>
          <ul>${t.usage.map((u) => `<li>${u}</li>`).join("")}</ul>
        </div>
        <div class="panel">
          <h3>Bildung</h3>
          ${t.forms.map((f) => `<div class="formula">${f}</div>`).join("")}
        </div>
        <div class="panel">
          <h3>Beispiele</h3>
          <ul class="examples">
            ${t.examples.map(([en, de]) => `<li><span class="en">${en}</span><span class="de">${de}</span></li>`).join("")}
          </ul>
          ${t.signal.length ? `<h3 style="margin-top:1.25rem">Signalwörter</h3>
            <div class="signal">${t.signal.map((s) => `<span>${s}</span>`).join("")}</div>` : ""}
          <div class="tip"><strong>💡 Tipp:</strong> ${t.tip}</div>
        </div>
        <div class="btn-row"><button class="btn" id="toPractice">Jetzt üben →</button></div>`;
      document.getElementById("toPractice").addEventListener("click", () => renderTopic(id, "practice"));
    } else {
      runExercises(content, t.exercises.map((e) => ({ ...e, topic: t })), {
        onFinish: (percent) => saveScore(t.id, percent),
        retry: () => renderTopic(id, "practice"),
      });
    }
  }

  // ---------- Gemischtes Quiz ----------
  function renderQuiz() {
    const pool = TOPICS.flatMap((t) => t.exercises.map((e) => ({ ...e, topic: t })));
    const questions = shuffle(pool).slice(0, QUIZ_LENGTH);
    app.innerHTML = `
      <a class="back" href="#/">← Alle Themen</a>
      <h1>Gemischtes Quiz</h1>
      <p class="lead">${QUIZ_LENGTH} zufällige Fragen aus allen Themen.</p>
      <div id="quizContent"></div>`;
    runExercises(document.getElementById("quizContent"), questions, {
      showTopic: true,
      retry: renderQuiz,
    });
  }

  // ---------- Übungs-Engine ----------
  function runExercises(container, questions, { onFinish, retry, showTopic = false }) {
    let index = 0;
    const mistakes = [];

    const next = () => {
      index++;
      if (index < questions.length) show();
      else finish();
    };

    function show() {
      const ex = questions[index];
      const pct = (index / questions.length) * 100;
      const panel = el(`
        <div class="panel exercise">
          <div class="q-head">
            <span>Frage ${index + 1} von ${questions.length}</span>
            ${showTopic ? `<span>${ex.topic.title}</span>` : `<span>${ex.type === "mc" ? "Multiple Choice" : "Lückentext"}</span>`}
          </div>
          <div class="bar"><div style="width:${pct}%"></div></div>
          <div class="question">${escapeHtml(ex.q)}</div>
          <div class="answer-area"></div>
          <div class="feedback-area"></div>
          <div class="btn-row next-row" hidden><button class="btn next-btn">${index + 1 < questions.length ? "Weiter →" : "Ergebnis anzeigen"}</button></div>
        </div>`);
      container.replaceChildren(panel);

      const area = panel.querySelector(".answer-area");
      const nextRow = panel.querySelector(".next-row");
      const nextBtn = panel.querySelector(".next-btn");
      nextBtn.addEventListener("click", next);

      const reveal = (ok) => {
        if (!ok) mistakes.push(ex);
        panel.querySelector(".feedback-area").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            ${ok ? "✓ Richtig!" : `✗ Leider falsch. Richtig: <b>${escapeHtml(correctText(ex))}</b>`}
            <span class="explain">${ex.explain}</span>
          </div>`;
        nextRow.hidden = false;
        nextBtn.focus();
      };

      if (ex.type === "mc") {
        const opts = el(`<div class="options"></div>`);
        ex.options.forEach((o, i) => {
          const b = el(`<button class="option">${escapeHtml(o)}</button>`);
          b.addEventListener("click", () => {
            const buttons = opts.querySelectorAll(".option");
            buttons.forEach((x) => (x.disabled = true));
            buttons[ex.answer].classList.add("correct");
            if (i !== ex.answer) b.classList.add("wrong");
            reveal(i === ex.answer);
          });
          opts.appendChild(b);
        });
        area.appendChild(opts);
      } else {
        const form = el(`
          <form class="fill">
            <input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Deine Antwort…" />
            <button class="btn" type="submit">Prüfen</button>
          </form>`);
        const input = form.querySelector("input");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          if (!input.value.trim() || input.disabled) return;
          const ok = ex.answer.some((a) => normalize(a) === normalize(input.value));
          input.disabled = true;
          form.querySelector("button").disabled = true;
          input.classList.add(ok ? "correct" : "wrong");
          reveal(ok);
        });
        area.appendChild(form);
        input.focus();
      }
    }

    function finish() {
      const correct = questions.length - mistakes.length;
      const percent = Math.round((correct / questions.length) * 100);
      if (onFinish) onFinish(percent);
      const msg =
        percent === 100 ? "Perfekt! 🎉" :
        percent >= PASS_PERCENT ? "Sehr gut – Thema geschafft! 💪" :
        percent >= 50 ? "Nicht schlecht – noch ein bisschen üben." :
        "Lies dir die Erklärung nochmal durch und versuch es erneut.";

      container.replaceChildren(el(`
        <div class="panel result">
          <div class="big">${percent} %</div>
          <p>${correct} von ${questions.length} richtig. ${msg}</p>
          ${mistakes.length ? `
            <div class="review">
              <h3>Deine Fehler zum Wiederholen</h3>
              <ul>${mistakes.map((m) => `<li>${escapeHtml(m.q)} → <b>${escapeHtml(correctText(m))}</b>
                ${showTopic ? `<a href="#/topic/${m.topic.id}">(${m.topic.title})</a>` : ""}</li>`).join("")}</ul>
            </div>` : ""}
          <div class="btn-row" style="justify-content:center">
            <button class="btn retry">Nochmal</button>
            <a class="btn secondary" href="#/" style="text-decoration:none">Zur Übersicht</a>
          </div>
        </div>`));
      container.querySelector(".retry").addEventListener("click", retry);
    }

    show();
  }

  // ---------- Router ----------
  function route() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [page, id] = hash.split("/");
    window.scrollTo(0, 0);
    if (page === "topic" && id) renderTopic(id);
    else if (page === "quiz") renderQuiz();
    else renderHome();
  }

  window.addEventListener("hashchange", route);
  renderOverall();
  route();
})();
