(() => {
  const SYMS = ["O", "+", ".", "x"];
  const SHOW = { O: "○", "+": "+", ".": "·", x: "×" };
  const masterEl = document.getElementById("master");
  const gridA = document.getElementById("grid-a");
  const gridB = document.getElementById("grid-b");
  const gridYou = document.getElementById("grid-you");
  const statusEl = document.getElementById("status");
  const btnReady = document.getElementById("btn-ready");
  const btnNew = document.getElementById("btn-new");
  const symPick = document.getElementById("sym-pick");
  const guessPanel = document.getElementById("guess-panel");
  const designerScore = document.getElementById("designer-score");
  const leftTitle = document.getElementById("left-title");

  let mode, master, brush, phase, sheets, youSel;

  function empty() {
    return Array.from({ length: 6 }, () => Array(6).fill(null));
  }

  function patterns() {
    // Ordered sample patterns for AI designer
    const p1 = empty();
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        if (r === c) p1[r][c] = "+";
        else if (r < c) p1[r][c] = "O";
        else p1[r][c] = ".";
      }
    const p2 = empty();
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) p2[r][c] = (r + c) % 2 ? "+" : "O";
    const p3 = empty();
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        if (r < 2) p3[r][c] = "O";
        else if (r < 4) p3[r][c] = "+";
        else p3[r][c] = ".";
      }
    const p4 = empty();
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        const d = Math.max(Math.abs(r - 2.5), Math.abs(c - 2.5));
        p4[r][c] = d < 1.5 ? "x" : d < 2.5 ? "+" : "O";
      }
    return [p1, p2, p3, p4];
  }

  function reset() {
    mode = document.querySelector('input[name="mode"]:checked').value;
    brush = "O";
    phase = "edit";
    master = empty();
    youSel = new Set();
    sheets = {
      a: { known: empty(), guess: empty(), gaveUp: false, score: null },
      b: { known: empty(), guess: empty(), gaveUp: false, score: null },
      you: { known: empty(), guess: empty(), gaveUp: false, score: null },
    };
    designerScore.textContent = "";
    document.getElementById("score-a").textContent = "";
    document.getElementById("score-b").textContent = "";
    document.getElementById("score-you").textContent = "";

    if (mode === "design") {
      guessPanel.classList.add("hidden");
      leftTitle.textContent = "Master pattern";
      symPick.classList.remove("hidden");
      btnReady.classList.remove("hidden");
      statusEl.textContent = "Paint a pattern, then release it to the AI guessers.";
      // seed a mild pattern for convenience
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++) master[r][c] = r === c ? "+" : r < c ? "O" : ".";
    } else {
      master = patterns()[Math.floor(Math.random() * patterns().length)].map((row) => row.slice());
      guessPanel.classList.remove("hidden");
      leftTitle.textContent = "Hidden (AI designer)";
      symPick.classList.add("hidden");
      btnReady.classList.add("hidden");
      statusEl.textContent = "Select squares to query, then submit your full guess.";
      // hide master visually
    }
    renderAll();
  }

  function renderGrid(el, data, opts) {
    el.innerHTML = "";
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        const d = document.createElement("div");
        d.className = "cell";
        const k = opts && opts.known ? opts.known[r][c] : null;
        const g = opts && opts.guess ? opts.guess[r][c] : null;
        const m = data ? data[r][c] : null;
        if (opts && opts.hideMaster) {
          if (k) {
            d.textContent = SHOW[k];
            d.classList.add("known");
          } else if (g) {
            d.textContent = "(" + SHOW[g] + ")";
            d.classList.add("guess");
          } else d.textContent = "";
        } else {
          d.textContent = m ? SHOW[m] : "";
        }
        if (opts && opts.selectable) {
          const id = r + "," + c;
          if (youSel.has(id)) d.classList.add("sel");
          d.onclick = () => {
            if (phase !== "guessing") return;
            if (sheets.you.known[r][c]) return;
            if (youSel.has(id)) youSel.delete(id);
            else youSel.add(id);
            renderAll();
          };
        }
        if (opts && opts.paint) {
          d.onclick = () => {
            if (phase !== "edit") return;
            master[r][c] = brush;
            renderAll();
          };
        }
        if (opts && opts.fillGuess) {
          d.onclick = () => {
            if (phase !== "guessing") return;
            if (sheets.you.known[r][c]) return;
            sheets.you.guess[r][c] = brush || "O";
            // cycle symbols
            const cur = sheets.you.guess[r][c];
            const i = SYMS.indexOf(cur);
            sheets.you.guess[r][c] = SYMS[(i + 1) % SYMS.length];
            renderAll();
          };
        }
        el.appendChild(d);
      }
  }

  function renderAll() {
    if (mode === "guess") {
      renderGrid(masterEl, null, {
        hideMaster: true,
        known: empty(),
        guess: empty(),
      });
      // show blank master area message
      masterEl.innerHTML = "<p style='max-width:220px;color:#666'>Pattern hidden until scoring.</p>";
    } else {
      renderGrid(masterEl, master, { paint: phase === "edit" });
    }
    renderGrid(gridA, null, { hideMaster: true, known: sheets.a.known, guess: sheets.a.guess });
    renderGrid(gridB, null, { hideMaster: true, known: sheets.b.known, guess: sheets.b.guess });
    if (mode === "guess") {
      renderGrid(gridYou, null, {
        hideMaster: true,
        known: sheets.you.known,
        guess: sheets.you.guess,
        selectable: true,
        fillGuess: true,
      });
    }
  }

  function scoreSheet(sheet) {
    if (sheet.gaveUp) return 0;
    let s = 0;
    let any = false;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        if (sheet.known[r][c]) continue;
        if (!sheet.guess[r][c]) continue;
        any = true;
        s += sheet.guess[r][c] === master[r][c] ? 1 : -1;
      }
    if (!any) return 0;
    return s;
  }

  function aiGuess(sheet, smart) {
    // Query some cells
    const coords = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) coords.push([r, c]);
    shuffle(coords);
    const nQuery = smart ? 14 : 10;
    for (let i = 0; i < nQuery; i++) {
      const [r, c] = coords[i];
      sheet.known[r][c] = master[r][c];
    }
    // Infer simple patterns
    const hyp = infer(sheet.known);
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        if (sheet.known[r][c]) continue;
        sheet.guess[r][c] = hyp[r][c];
      }
    // Weaker guesser introduces errors
    if (!smart) {
      for (let i = 0; i < 6; i++) {
        const [r, c] = coords[20 + i];
        if (sheet.known[r][c]) continue;
        sheet.guess[r][c] = SYMS[Math.floor(Math.random() * 4)];
      }
    }
    sheet.score = scoreSheet(sheet);
  }

  function infer(known) {
    const out = empty();
    // default checker / diagonal-ish from known samples
    const counts = { O: 0, "+": 0, ".": 0, x: 0 };
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) if (known[r][c]) counts[known[r][c]]++;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        if (known[r][c]) {
          out[r][c] = known[r][c];
          continue;
        }
        // nearest known
        let best = "O", bd = 99;
        for (let rr = 0; rr < 6; rr++)
          for (let cc = 0; cc < 6; cc++) {
            if (!known[rr][cc]) continue;
            const d = Math.abs(rr - r) + Math.abs(cc - c);
            if (d < bd) {
              bd = d;
              best = known[rr][cc];
            }
          }
        // diagonal bias
        if (known[r] && false) {}
        if (r === c && counts["+"] > 2) best = "+";
        out[r][c] = best;
      }
    return out;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function designerPoints(scores, giveUps) {
    const vals = scores.slice();
    const best = Math.max(...vals);
    const worst = Math.min(...vals);
    let base = 2 * (best - worst);
    if (giveUps === 1) base -= 5;
    if (giveUps >= 2) base -= 5 + 10 * (giveUps - 1);
    if (giveUps === scores.length) base = -5 - 10 * (giveUps - 1);
    return base;
  }

  function finishDesignMode() {
    aiGuess(sheets.a, true);
    aiGuess(sheets.b, false);
    document.getElementById("score-a").textContent = "Score: " + sheets.a.score;
    document.getElementById("score-b").textContent = "Score: " + sheets.b.score;
    const ds = designerPoints([sheets.a.score, sheets.b.score], 0);
    designerScore.textContent = "Your designer score: " + ds;
    statusEl.textContent = "Round complete.";
    phase = "done";
    renderAll();
    // reveal
    renderGrid(masterEl, master, {});
  }

  symPick.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-s]");
    if (!b) return;
    brush = b.dataset.s;
  });

  btnReady.addEventListener("click", () => {
    if (mode !== "design" || phase !== "edit") return;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) if (!master[r][c]) master[r][c] = "O";
    phase = "scoring";
    finishDesignMode();
  });

  document.getElementById("btn-query").addEventListener("click", () => {
    if (mode !== "guess" || phase !== "guessing" && phase !== "edit") {
      phase = "guessing";
    }
    phase = "guessing";
    youSel.forEach((id) => {
      const [r, c] = id.split(",").map(Number);
      sheets.you.known[r][c] = master[r][c];
      sheets.you.guess[r][c] = null;
    });
    youSel.clear();
    renderAll();
  });

  document.getElementById("btn-submit").addEventListener("click", () => {
    if (mode !== "guess") return;
    // fill empties randomly if missing
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        if (sheets.you.known[r][c]) continue;
        if (!sheets.you.guess[r][c]) sheets.you.guess[r][c] = "O";
      }
    sheets.you.score = scoreSheet(sheets.you);
    // AI guessers also (for designer scoring display)
    aiGuess(sheets.a, true);
    aiGuess(sheets.b, false);
    document.getElementById("score-you").textContent = "Your score: " + sheets.you.score;
    document.getElementById("score-a").textContent = "A: " + sheets.a.score;
    document.getElementById("score-b").textContent = "B: " + sheets.b.score;
    const ds = designerPoints(
      [sheets.you.score, sheets.a.score, sheets.b.score],
      0
    );
    designerScore.textContent = "AI designer score: " + ds + " — pattern revealed below.";
    renderGrid(masterEl, master, {});
    phase = "done";
    statusEl.textContent = "Scored.";
    renderAll();
    renderGrid(masterEl, master, {});
  });

  document.getElementById("btn-giveup").addEventListener("click", () => {
    if (mode !== "guess") return;
    sheets.you.gaveUp = true;
    sheets.you.score = 0;
    aiGuess(sheets.a, true);
    aiGuess(sheets.b, false);
    document.getElementById("score-you").textContent = "You gave up (0)";
    const ds = designerPoints([0, sheets.a.score, sheets.b.score], 1);
    designerScore.textContent = "AI designer score: " + ds;
    renderGrid(masterEl, master, {});
    phase = "done";
  });

  document.querySelectorAll('input[name="mode"]').forEach((el) =>
    el.addEventListener("change", reset)
  );
  btnNew.addEventListener("click", reset);
  reset();
})();
