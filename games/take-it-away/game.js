(() => {
  const SIZE = 8;
  const VAL = { white: 1, red: 2, blue: 3 };
  const DIRS = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  const boardEl = document.getElementById("board");
  const scoresEl = document.getElementById("scores");
  const statusEl = document.getElementById("status");
  const btnNew = document.getElementById("btn-new");
  const btnTia = document.getElementById("btn-tia");
  const aiCountEl = document.getElementById("ai-count");

  let grid;
  let players;
  let turn;
  let firstMove;
  let selected;
  let over;
  let patsyMode;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function freshChips() {
    const chips = [
      ...Array(34).fill("white"),
      ...Array(20).fill("red"),
      ...Array(10).fill("blue"),
    ];
    return shuffle(chips);
  }

  function reset() {
    const nAi = +aiCountEl.value;
    const chips = freshChips();
    grid = Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) => chips[r * SIZE + c])
    );
    players = [
      { id: 0, name: "You", ai: false, score: 0, bag: [], out: false },
    ];
    for (let i = 0; i < nAi; i++) {
      players.push({
        id: i + 1,
        name: "AI " + (i + 1),
        ai: true,
        score: 0,
        bag: [],
        out: false,
      });
    }
    turn = 0;
    firstMove = true;
    selected = null;
    over = false;
    patsyMode = false;
    render();
    statusEl.textContent = "Remove any white chip to start.";
    maybeAi();
  }

  function activePlayers() {
    return players.filter((p) => !p.out);
  }

  function scoreBag(bag) {
    return bag.reduce((s, c) => s + VAL[c], 0);
  }

  function jumpsFrom(r, c) {
    if (!grid[r][c]) return [];
    const out = [];
    for (const [dr, dc] of DIRS) {
      const mr = r + dr, mc = c + dc;
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
      if (grid[mr][mc] && !grid[lr][lc]) out.push({ mr, mc, lr, lc });
    }
    return out;
  }

  function anyJumps() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] && jumpsFrom(r, c).length) return true;
    return false;
  }

  function cellsWithJumps() {
    const list = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] && jumpsFrom(r, c).length) list.push([r, c]);
    return list;
  }

  function collect(chip, player) {
    player.bag.push(chip);
    player.score = scoreBag(player.bag);
  }

  function doJump(r, c, j, player) {
    const jumped = grid[j.mr][j.mc];
    grid[j.mr][j.mc] = null;
    grid[j.lr][j.lc] = grid[r][c];
    grid[r][c] = null;
    collect(jumped, player);
    return [j.lr, j.lc];
  }

  function leftoverPenalty(player) {
    let pen = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c]) pen += VAL[grid[r][c]] * 3;
    player.score -= pen;
    return pen;
  }

  function finish() {
    over = true;
    players.forEach((p) => (p.score = scoreBag(p.bag)));
    // if someone was patsy and finished, penalty already applied during patsy end
    const ranked = players.slice().sort((a, b) => b.score - a.score);
    statusEl.textContent =
      "Final — " +
      ranked.map((p) => `${p.name}: ${p.score}`).join(" · ") +
      (ranked[0].id === 0 ? " — You win!" : "");
    btnTia.disabled = true;
    render();
  }

  function nextTurn() {
    selected = null;
    const active = activePlayers();
    if (active.length === 1) {
      patsyMode = true;
      turn = active[0].id;
      statusEl.textContent = `${active[0].name} is the patsy — keep jumping.`;
      render();
      continuePatsy();
      return;
    }
    let i = turn;
    do {
      i = (i + 1) % players.length;
    } while (players[i].out);
    turn = i;
    render();
    statusEl.textContent = players[turn].ai
      ? `${players[turn].name} thinking…`
      : "Your turn — jump or Take it away.";
    maybeAi();
  }

  function continuePatsy() {
    const p = players[turn];
    const run = () => {
      if (!anyJumps()) {
        const pen = leftoverPenalty(p);
        statusEl.textContent = `Patsy done (−${pen} leftover).`;
        finish();
        return;
      }
      const start = cellsWithJumps()[0];
      let [r, c] = start;
      const chain = () => {
        const js = jumpsFrom(r, c);
        if (!js.length) {
          if (p.ai) setTimeout(run, 200);
          else {
            selected = null;
            render();
            statusEl.textContent = "Patsy: choose another jumping chip.";
          }
          return;
        }
        // must continue — auto if forced chain from same piece; pick best
        const j = js.sort((a, b) => VAL[grid[b.mr][b.mc]] - VAL[grid[a.mr][a.mc]])[0];
        [r, c] = doJump(r, c, j, p);
        render();
        setTimeout(chain, p.ai || patsyMode ? 180 : 180);
      };
      if (p.ai || (patsyMode && p.ai)) {
        chain();
      } else if (patsyMode && !p.ai) {
        // human patsy picks starts
        selected = null;
        render();
      }
    };
    if (p.ai) setTimeout(run, 250);
    else {
      selected = null;
      render();
      statusEl.textContent = "You are the patsy — keep jumping until none remain.";
    }
  }

  function endHumanChain() {
    if (patsyMode) {
      if (!anyJumps()) {
        leftoverPenalty(players[0]);
        finish();
      } else {
        selected = null;
        render();
        statusEl.textContent = "Patsy: select a chip that can jump.";
      }
      return;
    }
    nextTurn();
  }

  function aiTurn() {
    const p = players[turn];
    if (firstMove) {
      const whites = [];
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          if (grid[r][c] === "white") whites.push([r, c]);
      const [r, c] = whites[Math.floor(Math.random() * whites.length)];
      collect(grid[r][c], p);
      grid[r][c] = null;
      firstMove = false;
      render();
      nextTurn();
      return;
    }

    // Drop out heuristic
    const active = activePlayers().length;
    if (!patsyMode && active > 1 && p.score > 18 && Math.random() < 0.25 + p.score / 80) {
      p.out = true;
      statusEl.textContent = `${p.name}: Take it away!`;
      render();
      setTimeout(nextTurn, 400);
      return;
    }

    const starts = cellsWithJumps();
    if (!starts.length) {
      // forced take it away
      p.out = true;
      setTimeout(nextTurn, 200);
      return;
    }

    // Pick jump sequence maximizing immediate value
    let best = null;
    let bestVal = -1;
    for (const [sr, sc] of starts) {
      const sim = simulateChain(sr, sc);
      if (sim.value > bestVal) {
        bestVal = sim.value;
        best = sim.path;
      }
    }
    let [r, c] = best[0];
    let step = 1;
    const play = () => {
      if (step >= best.length) {
        nextTurn();
        return;
      }
      const j = best[step];
      [r, c] = doJump(r, c, j, p);
      step++;
      render();
      setTimeout(play, 160);
    };
    play();
  }

  function simulateChain(r, c) {
    // greedy copy
    const g = grid.map((row) => row.slice());
    let value = 0;
    const path = [[r, c]];
    const jumpsAt = (rr, cc) => {
      const out = [];
      for (const [dr, dc] of DIRS) {
        const mr = rr + dr, mc = cc + dc;
        const lr = rr + 2 * dr, lc = cc + 2 * dc;
        if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
        if (g[mr][mc] && !g[lr][lc]) out.push({ mr, mc, lr, lc });
      }
      return out;
    };
    let cr = r, cc = c;
    while (true) {
      const js = jumpsAt(cr, cc);
      if (!js.length) break;
      js.sort((a, b) => VAL[g[b.mr][b.mc]] - VAL[g[a.mr][a.mc]]);
      const j = js[0];
      value += VAL[g[j.mr][j.mc]];
      g[j.mr][j.mc] = null;
      g[j.lr][j.lc] = g[cr][cc];
      g[cr][cc] = null;
      cr = j.lr;
      cc = j.lc;
      path.push(j);
    }
    return { value, path };
  }

  function maybeAi() {
    if (over) return;
    if (players[turn].ai) setTimeout(aiTurn, 350);
  }

  function render() {
    scoresEl.innerHTML = players
      .map(
        (p) =>
          `<div class="player-card${p.id === turn && !over ? " active" : ""}${p.out ? " out" : ""}"><strong>${p.name}</strong><div>${p.score} pts</div><div>${p.out ? "out" : p.bag.length + " chips"}</div></div>`
      )
      .join("");
    boardEl.innerHTML = "";
    const legalStarts = !firstMove && !over && !players[turn].ai ? cellsWithJumps() : [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + ((r + c) % 2 ? "dark" : "light");
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (grid[r][c]) {
          const d = document.createElement("div");
          d.className = "chip " + grid[r][c];
          cell.appendChild(d);
        }
        if (selected && selected.r === r && selected.c === c) cell.classList.add("sel");
        if (selected && selected.jumps) {
          if (selected.jumps.some((j) => j.lr === r && j.lc === c)) cell.classList.add("legal");
        } else if (legalStarts.some(([lr, lc]) => lr === r && lc === c)) {
          cell.classList.add("legal");
        }
        if (firstMove && grid[r][c] === "white" && turn === 0 && !players[0].ai) cell.classList.add("legal");
        boardEl.appendChild(cell);
      }
    }
    btnTia.disabled = over || players[turn].ai || firstMove || players[turn].out || patsyMode;
  }

  boardEl.addEventListener("click", (e) => {
    if (over || players[turn].ai) return;
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    const p = players[turn];

    if (firstMove) {
      if (grid[r][c] !== "white") return;
      collect(grid[r][c], p);
      grid[r][c] = null;
      firstMove = false;
      render();
      nextTurn();
      return;
    }

    if (selected) {
      const j = selected.jumps.find((x) => x.lr === r && x.lc === c);
      if (j) {
        const [nr, nc] = doJump(selected.r, selected.c, j, p);
        const more = jumpsFrom(nr, nc);
        if (more.length) {
          selected = { r: nr, c: nc, jumps: more };
          render();
          statusEl.textContent = "Continue jumping.";
        } else {
          selected = null;
          render();
          endHumanChain();
        }
        return;
      }
    }

    if (grid[r][c] && jumpsFrom(r, c).length) {
      selected = { r, c, jumps: jumpsFrom(r, c) };
      render();
    }
  });

  btnTia.addEventListener("click", () => {
    if (over || players[turn].ai || firstMove) return;
    players[turn].out = true;
    statusEl.textContent = "You take it away.";
    nextTurn();
  });

  btnNew.addEventListener("click", reset);
  aiCountEl.addEventListener("change", reset);
  reset();
})();
