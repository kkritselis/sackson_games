(() => {
  const N = 4;
  const STOCK0 = 40;

  const statusEl = document.getElementById("status");
  const youCupsEl = document.getElementById("you-cups");
  const aiCupsEl = document.getElementById("ai-cups");

  let you, ai, turn, over;

  function side() {
    return { cups: [0, 0, 0, 0], pot: 0, stock: STOCK0 };
  }

  function canSow(s, i) {
    const need = N - i;
    return s.cups[i] === need;
  }

  function anyPlay(s) {
    if (s.stock > 0) return true;
    for (let i = 0; i < N; i++) if (canSow(s, i)) return true;
    return false;
  }

  function place(s, opp, n) {
    if (n < 1 || n > 4 || s.stock < n) return false;
    s.stock -= n;
    let lastEmpty = false;
    let lastI = -1;
    for (let k = 0; k < n; k++) {
      const i = k;
      if (s.cups[i] === 0) lastEmpty = true;
      else lastEmpty = false;
      s.cups[i]++;
      lastI = i;
    }
    // Opposite cup is the same index in the opponent's line (both count from far-left).
    if (lastEmpty && lastI >= 0 && opp.cups[lastI] > 0) {
      s.pot += opp.cups[lastI];
      opp.cups[lastI] = 0;
    }
    return true;
  }

  function sow(s, i) {
    if (!canSow(s, i)) return false;
    let beans = s.cups[i];
    s.cups[i] = 0;
    for (let j = i + 1; j < N; j++) {
      s.cups[j]++;
      beans--;
    }
    if (beans === 1) s.pot++;
    return true;
  }

  function endCheck() {
    if (anyPlay(you) || anyPlay(ai)) return;
    over = true;
    const msg =
      you.pot > ai.pot
        ? `You win ${you.pot}–${ai.pot}.`
        : ai.pot > you.pot
          ? `AI wins ${ai.pot}–${you.pot}.`
          : `Tie ${you.pot}–${ai.pot}.`;
    statusEl.textContent = "Game over. " + msg;
    render();
  }

  function evaluate() {
    return you.pot - ai.pot + (you.stock - ai.stock) * 0.15;
  }

  function aiTurn() {
    if (over) return;
    if (!anyPlay(ai)) {
      turn = "you";
      statusEl.textContent = "AI has no plays. Your turn.";
      endCheck();
      render();
      if (!over && anyPlay(you) === false) endCheck();
      return;
    }

    let best = null;
    let bestScore = -Infinity;

    if (ai.stock > 0) {
      for (let n = 1; n <= Math.min(4, ai.stock); n++) {
        const a = JSON.parse(JSON.stringify(ai));
        const y = JSON.parse(JSON.stringify(you));
        place(a, y, n);
        const score = a.pot - y.pot + Math.random();
        if (score > bestScore) {
          bestScore = score;
          best = { type: "place", n };
        }
      }
    }
    for (let i = 0; i < N; i++) {
      if (!canSow(ai, i)) continue;
      const a = JSON.parse(JSON.stringify(ai));
      sow(a, i);
      const score = a.pot * 1.2 - (a.cups.some((c, j) => c > N - j) ? 3 : 0) + Math.random();
      if (score > bestScore) {
        bestScore = score;
        best = { type: "sow", i };
      }
    }

    if (!best) {
      turn = "you";
      render();
      return;
    }
    if (best.type === "place") place(ai, you, best.n);
    else sow(ai, best.i);

    turn = "you";
    if (!anyPlay(you) && anyPlay(ai)) {
      statusEl.textContent = "You have no plays. AI continues…";
      render();
      setTimeout(aiTurn, 400);
      return;
    }
    statusEl.textContent = anyPlay(you) ? "Your turn." : "No plays left…";
    endCheck();
    render();
  }

  function afterYou() {
    if (!anyPlay(ai) && anyPlay(you)) {
      statusEl.textContent = "AI has no plays. Play again.";
      turn = "you";
      endCheck();
      render();
      return;
    }
    turn = "ai";
    statusEl.textContent = "AI thinking…";
    render();
    setTimeout(aiTurn, 350);
  }

  function render() {
    document.getElementById("you-stock").textContent = you.stock;
    document.getElementById("ai-stock").textContent = ai.stock;
    document.getElementById("you-pot-n").textContent = you.pot;
    document.getElementById("ai-pot-n").textContent = ai.pot;

    youCupsEl.innerHTML = "";
    aiCupsEl.innerHTML = "";

    for (let i = 0; i < N; i++) {
      const cup = document.createElement("button");
      cup.type = "button";
      cup.className = "cup you" + (canSow(you, i) ? " sowable" : you.cups[i] > N - i ? " blocked" : "");
      cup.innerHTML = `<span class="beans"></span><span>${you.cups[i]}</span>`;
      const beans = cup.querySelector(".beans");
      for (let b = 0; b < Math.min(you.cups[i], 16); b++) {
        beans.appendChild(Object.assign(document.createElement("span"), { className: "bean" }));
      }
      cup.disabled = over || turn !== "you" || !canSow(you, i);
      cup.addEventListener("click", () => {
        if (over || turn !== "you") return;
        if (sow(you, i)) afterYou();
      });
      youCupsEl.appendChild(cup);
    }

    for (let i = N - 1; i >= 0; i--) {
      const cup = document.createElement("div");
      cup.className = "cup ai";
      cup.innerHTML = `<span class="beans"></span><span>${ai.cups[i]}</span>`;
      const beans = cup.querySelector(".beans");
      for (let b = 0; b < Math.min(ai.cups[i], 16); b++) {
        beans.appendChild(Object.assign(document.createElement("span"), { className: "bean" }));
      }
      aiCupsEl.appendChild(cup);
    }

    document.querySelectorAll("[data-place]").forEach((btn) => {
      const n = +btn.dataset.place;
      btn.disabled = over || turn !== "you" || you.stock < n;
    });
  }

  document.getElementById("actions").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn || over || turn !== "you") return;
    const n = +btn.dataset.place;
    if (place(you, ai, n)) afterYou();
  });

  function newGame() {
    you = side();
    ai = side();
    turn = "you";
    over = false;
    statusEl.textContent = "Your turn — place beans or sow a cup.";
    render();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
