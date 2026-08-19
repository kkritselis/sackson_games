(() => {
  const statusEl = document.getElementById("status");
  const currentEl = document.getElementById("current");
  const movesEl = document.getElementById("moves");
  const usedEl = document.getElementById("used");

  let master, used, owners, scores, current, turn, over;

  function isScoring(n) {
    const s = String(n);
    if (s.includes(String(master))) return true;
    if (n < 10) return false;
    const a = Math.floor(n / 10);
    const b = n % 10;
    if (a + b === master) return true;
    if (Math.abs(a - b) === master) return true;
    if (a * b === master) return true;
    if (b !== 0 && a % b === 0 && a / b === master) return true;
    if (a !== 0 && b % a === 0 && b / a === master) return true;
    return false;
  }

  function derives(from) {
    const out = new Set();
    if (from === 1) {
      for (let i = 1; i <= 30; i++) if (!used.has(i)) out.add(i);
      return [...out];
    }
    if (from >= 10) {
      const a = Math.floor(from / 10);
      const b = from % 10;
      for (const v of [a + b, Math.abs(a - b), a * b]) {
        if (v >= 1 && v <= 30) out.add(v);
      }
      if (b && a % b === 0) {
        const q = a / b;
        if (q >= 1 && q <= 30) out.add(q);
      }
      if (a && b % a === 0) {
        const q = b / a;
        if (q >= 1 && q <= 30) out.add(q);
      }
    }
    if (from * 2 <= 30) out.add(from * 2);
    if (from % 2 === 0) out.add(from / 2);
    if (from * from <= 30) out.add(from * from);
    const root = Math.sqrt(from);
    if (Number.isInteger(root) && root >= 1) out.add(root);
    return [...out].filter((n) => n >= 1 && n <= 30 && !used.has(n));
  }

  function play(n) {
    used.add(n);
    owners.set(n, turn);
    if (isScoring(n)) scores[turn]++;
    current = n;
    const next = turn === "you" ? "ai" : "you";
    const opts = derives(current);
    if (!opts.length) {
      over = true;
      const msg =
        scores.you > scores.ai
          ? `You win ${scores.you}–${scores.ai}.`
          : scores.ai > scores.you
            ? `AI wins ${scores.ai}–${scores.you}.`
            : `Tie ${scores.you}–${scores.ai}.`;
      statusEl.textContent = "No moves left. " + msg;
      render();
      return;
    }
    turn = next;
    statusEl.textContent = turn === "you" ? "Your turn — pick a derivation." : "AI thinking…";
    render();
    if (turn === "ai") setTimeout(aiTurn, 350);
  }

  function aiTurn() {
    const opts = derives(current);
    if (!opts.length) {
      over = true;
      statusEl.textContent = `No moves. Final ${scores.you}–${scores.ai}.`;
      render();
      return;
    }
    let best = opts[0], bestS = -Infinity;
    for (const n of opts) {
      let s = (isScoring(n) ? 5 : 0) + Math.random();
      const leave = (() => {
        used.add(n);
        const d = derives(n).length;
        used.delete(n);
        return d;
      })();
      s += leave * 0.3;
      if (s > bestS) { bestS = s; best = n; }
    }
    play(best);
  }

  function render() {
    document.getElementById("you-score").textContent = scores.you;
    document.getElementById("ai-score").textContent = scores.ai;
    currentEl.textContent = current == null ? "—" : current;
    usedEl.innerHTML = "";
    for (let i = 1; i <= 30; i++) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = i;
      if (used.has(i)) {
        chip.classList.add("on", owners.get(i));
        if (isScoring(i)) chip.classList.add("score");
      }
      usedEl.appendChild(chip);
    }
    movesEl.innerHTML = "";
    if (over || turn !== "you" || current == null) return;
    for (const n of derives(current).sort((a, b) => a - b)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = n + (isScoring(n) ? " ★" : "");
      btn.addEventListener("click", () => play(n));
      movesEl.appendChild(btn);
    }
  }

  function startGame() {
    master = +document.getElementById("master").value;
    used = new Set();
    owners = new Map();
    scores = { you: 0, ai: 0 };
    over = false;
    turn = "you";
    // opening: any non-scoring 1-30
    const openers = [];
    for (let i = 1; i <= 30; i++) if (!isScoring(i)) openers.push(i);
    current = null;
    document.getElementById("setup").style.display = "none";
    statusEl.textContent = "Choose a starting number (non-scoring).";
    currentEl.textContent = "—";
    movesEl.innerHTML = "";
    for (const n of openers) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(n);
      btn.addEventListener("click", () => {
        play(n);
      });
      movesEl.appendChild(btn);
    }
    render();
    // clear moves overwrite in render — fix by not calling full render moves wipe incorrectly
    movesEl.innerHTML = "";
    for (const n of openers) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(n);
      btn.addEventListener("click", () => play(n));
      movesEl.appendChild(btn);
    }
  }

  document.getElementById("start").addEventListener("click", startGame);
  document.getElementById("new-game").addEventListener("click", () => {
    document.getElementById("setup").style.display = "flex";
    statusEl.textContent = "Pick a master number and start.";
    currentEl.textContent = "—";
    movesEl.innerHTML = "";
    usedEl.innerHTML = "";
    scores = { you: 0, ai: 0 };
    document.getElementById("you-score").textContent = "0";
    document.getElementById("ai-score").textContent = "0";
  });
})();
