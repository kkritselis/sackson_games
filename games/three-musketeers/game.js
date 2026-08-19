(() => {
  const N = 5;
  const M = 1;
  const E = 2;
  const EMPTY = 0;
  const ORTH = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const muskImg = "../../assets/Pieces%20(Black)/pieceBlack_border08.png";
  const enemyImg = "../../assets/Pieces%20(Red)/pieceRed_border08.png";

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const sideSel = document.getElementById("side");

  let board, turn, selected, over, humanSide;

  function idx(r, c) { return r * N + c; }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function setup() {
    // Standard: musketeers on main diagonal corners + center; rest enemies.
    const b = Array(N * N).fill(E);
    b[idx(0, 0)] = M;
    b[idx(2, 2)] = M;
    b[idx(4, 4)] = M;
    return b;
  }

  function positions(b, kind) {
    const out = [];
    for (let i = 0; i < b.length; i++) if (b[i] === kind) out.push(i);
    return out;
  }

  function muskSameLine(b) {
    const m = positions(b, M);
    if (m.length !== 3) return false;
    const rs = m.map((i) => Math.floor(i / N));
    const cs = m.map((i) => i % N);
    return rs.every((r) => r === rs[0]) || cs.every((c) => c === cs[0]);
  }

  function muskMoves(b) {
    const moves = [];
    for (const from of positions(b, M)) {
      const r = Math.floor(from / N);
      const c = from % N;
      for (const [dr, dc] of ORTH) {
        const rr = r + dr, cc = c + dc;
        if (!inB(rr, cc)) continue;
        const to = idx(rr, cc);
        if (b[to] === E) moves.push({ from, to });
      }
    }
    return moves;
  }

  function enemyMoves(b) {
    const moves = [];
    for (const from of positions(b, E)) {
      const r = Math.floor(from / N);
      const c = from % N;
      for (const [dr, dc] of ORTH) {
        const rr = r + dr, cc = c + dc;
        if (!inB(rr, cc)) continue;
        const to = idx(rr, cc);
        if (b[to] === EMPTY) moves.push({ from, to });
      }
    }
    return moves;
  }

  function apply(b, move) {
    const next = b.slice();
    next[move.to] = next[move.from];
    next[move.from] = EMPTY;
    return next;
  }

  function legalFor(side, b) {
    return side === M ? muskMoves(b) : enemyMoves(b);
  }

  function checkEnd(afterSide) {
    if (muskSameLine(board)) {
      over = true;
      statusEl.textContent = humanSide === E ? "You win — Musketeers aligned!" : "Enemy wins — Musketeers aligned.";
      return true;
    }
    if (afterSide === E && muskMoves(board).length === 0) {
      over = true;
      statusEl.textContent = humanSide === M ? "You win — Musketeers cannot move!" : "Musketeers win — no captures left.";
      return true;
    }
    return false;
  }

  function scoreEnemyMove(b, move) {
    const next = apply(b, move);
    if (muskSameLine(next)) return 1000;
    const mm = muskMoves(next);
    if (!mm.length) return -500;
    let alignThreat = 0;
    const m = positions(next, M);
    const rs = m.map((i) => Math.floor(i / N));
    const cs = m.map((i) => i % N);
    const rowCounts = {};
    const colCounts = {};
    rs.forEach((r) => (rowCounts[r] = (rowCounts[r] || 0) + 1));
    cs.forEach((c) => (colCounts[c] = (colCounts[c] || 0) + 1));
    alignThreat = Math.max(...Object.values(rowCounts), ...Object.values(colCounts));
    return alignThreat * 40 - mm.length * 2 + Math.random();
  }

  function scoreMuskMove(b, move) {
    const next = apply(b, move);
    if (muskSameLine(next)) return -1000;
    const enemies = positions(next, E).length;
    const mm = muskMoves(next);
    return -enemies * 2 + mm.length + Math.random() * 0.5;
  }

  function aiPlay() {
    if (over) return;
    const side = turn;
    const moves = legalFor(side, board);
    if (side === M && !moves.length) {
      checkEnd(E);
      render();
      return;
    }
    if (!moves.length) {
      turn = side === M ? E : M;
      maybeAI();
      return;
    }
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const s = side === M ? scoreMuskMove(board, m) : scoreEnemyMove(board, m);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    // Musketeers may not move onto same line if another move exists
    if (side === M) {
      const safe = moves.filter((m) => !muskSameLine(apply(board, m)));
      if (safe.length) {
        best = safe[0];
        bestScore = -Infinity;
        for (const m of safe) {
          const s = scoreMuskMove(board, m);
          if (s > bestScore) {
            bestScore = s;
            best = m;
          }
        }
      }
    }
    board = apply(board, best);
    selected = null;
    if (checkEnd(side)) {
      render();
      return;
    }
    turn = side === M ? E : M;
    statusEl.textContent = turn === humanSide ? "Your turn." : "AI thinking…";
    render();
    maybeAI();
  }

  function maybeAI() {
    if (over) return;
    if (turn !== humanSide) setTimeout(aiPlay, 280);
  }

  function render() {
    boardEl.innerHTML = "";
    const moves = !over && turn === humanSide ? legalFor(humanSide, board) : [];
    const dests = selected != null ? new Set(moves.filter((m) => m.from === selected).map((m) => m.to)) : new Set();
    for (let i = 0; i < N * N; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (selected === i) cell.classList.add("selected");
      if (dests.has(i)) cell.classList.add("dest");
      if (board[i] === M || board[i] === E) {
        const img = document.createElement("img");
        img.className = "piece";
        img.src = board[i] === M ? muskImg : enemyImg;
        img.alt = board[i] === M ? "Musketeer" : "Enemy";
        cell.appendChild(img);
      }
      cell.addEventListener("click", () => onClick(i));
      boardEl.appendChild(cell);
    }
  }

  function onClick(i) {
    if (over || turn !== humanSide) return;
    const moves = legalFor(humanSide, board);
    if (selected != null) {
      const hit = moves.find((m) => m.from === selected && m.to === i);
      if (hit) {
        let chosen = hit;
        if (humanSide === M) {
          const wouldAlign = muskSameLine(apply(board, hit));
          const alternatives = moves.filter((m) => !muskSameLine(apply(board, m)));
          if (wouldAlign && alternatives.length) {
            statusEl.textContent = "Musketeers cannot align if another move exists.";
            return;
          }
        }
        board = apply(board, chosen);
        selected = null;
        if (checkEnd(humanSide)) {
          render();
          return;
        }
        turn = humanSide === M ? E : M;
        statusEl.textContent = "AI thinking…";
        render();
        maybeAI();
        return;
      }
    }
    if (board[i] === humanSide && moves.some((m) => m.from === i)) {
      selected = i;
      render();
    } else {
      selected = null;
      render();
    }
  }

  function newGame() {
    board = setup();
    humanSide = sideSel.value === "musk" ? M : E;
    turn = M;
    selected = null;
    over = false;
    statusEl.textContent =
      humanSide === M ? "You are the Musketeers. Capture enemies." : "You are the Enemy. Force an alignment.";
    render();
    maybeAI();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  sideSel.addEventListener("change", newGame);
  newGame();
})();
