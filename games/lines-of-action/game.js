(() => {
  const SIZE = 8;
  const BLACK = 1;
  const WHITE = 2;
  const EMPTY = 0;
  const DIRS = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const blackImg = "../../assets/Pieces%20(Black)/pieceBlack_border05.png";
  const whiteImg = "../../assets/Pieces%20(White)/pieceWhite_border05.png";

  let board = [];
  let turn = BLACK;
  let selected = null;
  let over = false;
  let human = BLACK;

  function idx(r, c) { return r * SIZE + c; }
  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

  function freshBoard() {
    const b = Array(SIZE * SIZE).fill(EMPTY);
    for (let c = 1; c <= 6; c++) {
      b[idx(0, c)] = BLACK;
      b[idx(7, c)] = BLACK;
    }
    for (let r = 1; r <= 6; r++) {
      b[idx(r, 0)] = WHITE;
      b[idx(r, 7)] = WHITE;
    }
    return b;
  }

  function piecesOf(b, color) {
    const out = [];
    for (let i = 0; i < b.length; i++) if (b[i] === color) out.push(i);
    return out;
  }

  function countOnLine(b, r, c, dr, dc) {
    let n = 0;
    let rr = r, cc = c;
    while (inBounds(rr, cc)) {
      if (b[idx(rr, cc)]) n++;
      rr += dr; cc += dc;
    }
    rr = r - dr; cc = c - dc;
    while (inBounds(rr, cc)) {
      if (b[idx(rr, cc)]) n++;
      rr -= dr; cc -= dc;
    }
    return n;
  }

  function legalMoves(b, from) {
    const color = b[from];
    if (!color) return [];
    const r = Math.floor(from / SIZE);
    const c = from % SIZE;
    const moves = [];
    for (const [dr, dc] of DIRS) {
      const n = countOnLine(b, r, c, dr, dc);
      if (n < 1) continue;
      let blocked = false;
      for (let step = 1; step < n; step++) {
        const rr = r + dr * step;
        const cc = c + dc * step;
        if (!inBounds(rr, cc)) { blocked = true; break; }
        const v = b[idx(rr, cc)];
        if (v && v !== color) { blocked = true; break; }
      }
      if (blocked) continue;
      const tr = r + dr * n;
      const tc = c + dc * n;
      if (!inBounds(tr, tc)) continue;
      const dest = b[idx(tr, tc)];
      if (dest === color) continue;
      moves.push(idx(tr, tc));
    }
    return moves;
  }

  function applyMove(b, from, to) {
    const next = b.slice();
    next[to] = next[from];
    next[from] = EMPTY;
    return next;
  }

  function connected(b, color) {
    const pcs = piecesOf(b, color);
    if (pcs.length <= 1) return true;
    const seen = new Set([pcs[0]]);
    const q = [pcs[0]];
    while (q.length) {
      const cur = q.pop();
      const r = Math.floor(cur / SIZE);
      const c = cur % SIZE;
      for (const [dr, dc] of DIRS) {
        const rr = r + dr, cc = c + dc;
        if (!inBounds(rr, cc)) continue;
        const i = idx(rr, cc);
        if (b[i] !== color || seen.has(i)) continue;
        seen.add(i);
        q.push(i);
      }
    }
    return seen.size === pcs.length;
  }

  function componentCount(b, color) {
    const pcs = piecesOf(b, color);
    if (!pcs.length) return 0;
    const seen = new Set();
    let comps = 0;
    for (const start of pcs) {
      if (seen.has(start)) continue;
      comps++;
      const q = [start];
      seen.add(start);
      while (q.length) {
        const cur = q.pop();
        const r = Math.floor(cur / SIZE);
        const c = cur % SIZE;
        for (const [dr, dc] of DIRS) {
          const rr = r + dr, cc = c + dc;
          if (!inBounds(rr, cc)) continue;
          const i = idx(rr, cc);
          if (b[i] !== color || seen.has(i)) continue;
          seen.add(i);
          q.push(i);
        }
      }
    }
    return comps;
  }

  function mobility(b, color) {
    let m = 0;
    for (const p of piecesOf(b, color)) m += legalMoves(b, p).length;
    return m;
  }

  function evaluate(b, color) {
    const enemy = color === BLACK ? WHITE : BLACK;
    if (connected(b, color)) return 10000;
    if (connected(b, enemy)) return -10000;
    const myC = componentCount(b, color);
    const enC = componentCount(b, enemy);
    const myN = piecesOf(b, color).length;
    const enN = piecesOf(b, enemy).length;
    return (enC - myC) * 40 + (myN - enN) * 3 + (mobility(b, color) - mobility(b, enemy)) * 0.5;
  }

  function allMoves(b, color) {
    const list = [];
    for (const from of piecesOf(b, color)) {
      for (const to of legalMoves(b, from)) list.push({ from, to });
    }
    return list;
  }

  function aiMove() {
    const moves = allMoves(board, WHITE);
    if (!moves.length) {
      statusEl.textContent = "White has no moves. Your turn.";
      turn = BLACK;
      return;
    }
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const next = applyMove(board, m.from, m.to);
      let score = evaluate(next, WHITE);
      if (connected(next, WHITE)) score = 20000;
      if (connected(next, BLACK) && !connected(next, WHITE)) score = -15000;
      score += Math.random() * 2;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    board = applyMove(board, best.from, best.to);
    afterMove(WHITE);
  }

  function afterMove(mover) {
    const enemy = mover === BLACK ? WHITE : BLACK;
    const meWin = connected(board, mover);
    const themWin = connected(board, enemy);
    if (meWin) {
      over = true;
      statusEl.textContent = mover === human ? "You win — your pieces are united!" : "Computer wins — White is united.";
      render();
      return;
    }
    if (themWin) {
      over = true;
      statusEl.textContent = enemy === human ? "You win — White united you by capture!" : "Computer wins.";
      render();
      return;
    }
    turn = enemy;
    selected = null;
    render();
    if (!over && turn === WHITE) {
      statusEl.textContent = "Computer thinking…";
      setTimeout(aiMove, 280);
    } else if (!over) {
      statusEl.textContent = "Your turn (Black).";
    }
  }

  function render() {
    boardEl.innerHTML = "";
    const dests = selected != null ? new Set(legalMoves(board, selected)) : new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const i = idx(r, c);
        const cell = document.createElement("div");
        cell.className = `cell ${(r + c) % 2 ? "dark" : "light"}`;
        cell.dataset.i = i;
        if (selected === i) cell.classList.add("selected");
        if (dests.has(i)) cell.classList.add("dest");
        const v = board[i];
        if (v) {
          const img = document.createElement("img");
          img.className = "piece";
          img.alt = v === BLACK ? "Black" : "White";
          img.src = v === BLACK ? blackImg : whiteImg;
          cell.appendChild(img);
        }
        cell.addEventListener("click", () => onClick(i));
        boardEl.appendChild(cell);
      }
    }
  }

  function onClick(i) {
    if (over || turn !== human) return;
    if (selected != null) {
      const dests = legalMoves(board, selected);
      if (dests.includes(i)) {
        board = applyMove(board, selected, i);
        afterMove(BLACK);
        return;
      }
    }
    if (board[i] === BLACK) {
      selected = i;
      render();
    } else {
      selected = null;
      render();
    }
  }

  function newGame() {
    board = freshBoard();
    turn = BLACK;
    selected = null;
    over = false;
    statusEl.textContent = "Your turn (Black).";
    render();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
