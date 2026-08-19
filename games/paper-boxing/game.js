(() => {
  const by = document.getElementById("board-you");
  const ba = document.getElementById("board-ai");
  const statusEl = document.getElementById("status");
  const scYou = document.getElementById("sc-you");
  const scAi = document.getElementById("sc-ai");
  const roleYou = document.getElementById("role-you");
  const roleAi = document.getElementById("role-ai");
  const actions = document.getElementById("actions");
  const btnShuffle = document.getElementById("btn-shuffle");
  const btnLock = document.getElementById("btn-lock");
  const btnNew = document.getElementById("btn-new");

  let youBoard, aiBoard, phase, posYou, posAi, usedYou, usedAi, scores, leader, youRole, over, waitingHuman;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeBoard() {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const g = Array.from({ length: 4 }, () => Array(4).fill(0));
    g[0][0] = "S";
    let k = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        if (r === 0 && c === 0) continue;
        g[r][c] = nums[k++];
      }
    return g;
  }

  function reset() {
    youBoard = makeBoard();
    aiBoard = makeBoard();
    phase = "build";
    posYou = [0, 0];
    posAi = [0, 0];
    usedYou = new Set(["0,0"]);
    usedAi = new Set(["0,0"]);
    scores = { you: 0, ai: 0 };
    over = false;
    waitingHuman = false;
    actions.style.display = "flex";
    statusEl.textContent = "Shuffle your board, then lock to start boxing.";
    render();
  }

  function neighbors(r, c, used) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 3 || nc < 0 || nc > 3) continue;
        if (used.has(nr + "," + nc)) continue;
        out.push([nr, nc]);
      }
    return out;
  }

  function startFight() {
    const sum = youBoard[3][3] + aiBoard[3][3];
    youRole = sum % 2 === 0 ? "even" : "odd";
    const aiRole = youRole === "even" ? "odd" : "even";
    roleYou.textContent = `(${youRole})`;
    roleAi.textContent = `(${aiRole})`;
    leader = sum % 2 === 0 ? (youRole === "even" ? "you" : "ai") : (youRole === "odd" ? "you" : "ai");
    // If sum even, even goes first; if odd, odd goes first
    if (sum % 2 === 0) leader = youRole === "even" ? "you" : "ai";
    else leader = youRole === "odd" ? "you" : "ai";
    phase = "fight";
    actions.style.display = "none";
    statusEl.textContent = `Lower-right sum ${sum} — ${leader === "you" ? "you" : "computer"} leads round 1.`;
    playRound();
  }

  function playRound() {
    if (over) return;
    if (usedYou.size >= 16 && usedAi.size >= 16) {
      finish();
      return;
    }
    waitingHuman = false;
    const yMoves = neighbors(posYou[0], posYou[1], usedYou);
    const aMoves = neighbors(posAi[0], posAi[1], usedAi);
    if (!yMoves.length) {
      over = true;
      statusEl.textContent = "You have no move — knockout loss.";
      render();
      return;
    }
    if (!aMoves.length) {
      over = true;
      statusEl.textContent = "Computer has no move — you win by knockout!";
      render();
      return;
    }

    if (leader === "you") {
      waitingHuman = true;
      statusEl.textContent = "Your lead — pick an adjacent unused square.";
      render(yMoves);
    } else {
      // AI moves first, then human
      const am = pickAi(aMoves, true);
      applyAi(am);
      waitingHuman = true;
      statusEl.textContent = `Computer moved to ${aiBoard[am[0]][am[1]]}. Your reply.`;
      render(neighbors(posYou[0], posYou[1], usedYou));
    }
  }

  function pickAi(moves, leading) {
    // Prefer higher numbers when leading? Actually when moving, want high if... both reveal simultaneously in spirit but sequential here.
    // Aim for high numbers when possible, avoid trapping.
    return moves.slice().sort((a, b) => {
      const va = aiBoard[a[0]][a[1]];
      const vb = aiBoard[b[0]][b[1]];
      const fa = neighbors(a[0], a[1], new Set([...usedAi, a[0] + "," + a[1]])).length;
      const fb = neighbors(b[0], b[1], new Set([...usedAi, b[0] + "," + b[1]])).length;
      return vb + fb * 0.5 - (va + fa * 0.5);
    })[0];
  }

  function applyAi(m) {
    posAi = m;
    usedAi.add(m[0] + "," + m[1]);
  }

  function resolveRound() {
    const yv = youBoard[posYou[0]][posYou[1]];
    const av = aiBoard[posAi[0]][posAi[1]];
    if (yv > av) {
      scores.you++;
      leader = "you";
      statusEl.textContent = `You ${yv} vs AI ${av} — you win the round.`;
    } else if (av > yv) {
      scores.ai++;
      leader = "ai";
      statusEl.textContent = `You ${yv} vs AI ${av} — computer wins the round.`;
    } else {
      statusEl.textContent = `Tie at ${yv}. Same leader continues.`;
    }
    scYou.textContent = scores.you;
    scAi.textContent = scores.ai;
    render();
    if (usedYou.size >= 16) {
      finish();
      return;
    }
    setTimeout(playRound, 550);
  }

  function finish() {
    over = true;
    if (scores.you === scores.ai) {
      statusEl.textContent = `Tied rounds — first player of the match wins the tiebreak (${leader === "you" && false}).`;
      // victory to who played first at start
      const firstWasYou = (youRole === "even" && (youBoard[3][3] + aiBoard[3][3]) % 2 === 0) ||
        (youRole === "odd" && (youBoard[3][3] + aiBoard[3][3]) % 2 === 1);
      statusEl.textContent = scores.you + "–" + scores.ai + " — tie goes to the original first player: " + (firstWasYou ? "you!" : "computer.");
    } else if (scores.you > scores.ai) statusEl.textContent = `Final ${scores.you}–${scores.ai}. You win!`;
    else statusEl.textContent = `Final ${scores.you}–${scores.ai}. Computer wins.`;
    render();
  }

  function render(legal) {
    const paint = (el, board, pos, used, leg) => {
      el.innerHTML = "";
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          const d = document.createElement("div");
          d.className = "cell";
          const v = board[r][c];
          d.textContent = v === "S" ? "S" : v;
          if (v === "S") d.classList.add("start");
          if (used.has(r + "," + c)) d.classList.add("used");
          if (pos[0] === r && pos[1] === c) d.classList.add("here");
          if (leg && leg.some(([lr, lc]) => lr === r && lc === c)) {
            d.classList.add("legal");
            d.onclick = () => humanPick(r, c);
          }
          el.appendChild(d);
        }
    };
    paint(by, youBoard, posYou, usedYou, phase === "fight" && waitingHuman ? legal : null);
    paint(ba, aiBoard, posAi, usedAi, null);
    scYou.textContent = scores.you;
    scAi.textContent = scores.ai;
  }

  let pendingHuman = null;
  function humanPick(r, c) {
    if (!waitingHuman || over) return;
    posYou = [r, c];
    usedYou.add(r + "," + c);
    waitingHuman = false;
    if (leader === "you") {
      // AI replies
      const am = pickAi(neighbors(posAi[0], posAi[1], usedAi), false);
      applyAi(am);
    }
    resolveRound();
  }

  btnShuffle.addEventListener("click", () => {
    if (phase !== "build") return;
    youBoard = makeBoard();
    render();
  });
  btnLock.addEventListener("click", () => {
    if (phase !== "build") return;
    startFight();
  });
  btnNew.addEventListener("click", reset);
  reset();
})();
