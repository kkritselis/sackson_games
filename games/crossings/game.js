(() => {
  /* Crossings (Abbott) — phalanx movement with simplifications:
     - Click pieces of a straight contiguous group (or one piece), then a legal destination.
     - Group moves only along its line axis (or any dir for a singleton).
     See README Stuck notes for simplifications. */
  const SIZE = 8;
  const W = 1, B = 2, EMPTY = 0;
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  const whiteImg = "../../assets/Pieces%20(White)/pieceWhite_border06.png";
  const blackImg = "../../assets/Pieces%20(Black)/pieceBlack_border06.png";

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const hintEl = document.getElementById("hint");

  let board, crossed, turn, selected, over, pendingCrossing;

  function idx(r, c) { return r * SIZE + c; }
  function rc(i) { return [Math.floor(i / SIZE), i % SIZE]; }
  function inB(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

  function setup() {
    const b = Array(SIZE * SIZE).fill(EMPTY);
    for (let c = 0; c < SIZE; c++) {
      b[idx(6, c)] = W;
      b[idx(7, c)] = W;
      b[idx(0, c)] = B;
      b[idx(1, c)] = B;
    }
    return b;
  }

  function dirBetween(a, b) {
    const [r1, c1] = rc(a), [r2, c2] = rc(b);
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    if (dr === 0 && dc === 0) return null;
    if (Math.abs(r2 - r1) !== Math.abs(c2 - c1) && r1 !== r2 && c1 !== c2) return null;
    return [dr, dc];
  }

  function isStraightGroup(cells) {
    if (cells.length <= 1) return true;
    const sorted = cells.slice().sort((a, b) => a - b);
    const d = dirBetween(sorted[0], sorted[1]);
    if (!d) return false;
    for (let i = 1; i < sorted.length; i++) {
      const dd = dirBetween(sorted[i - 1], sorted[i]);
      if (!dd || dd[0] !== d[0] || dd[1] !== d[1]) return false;
      const [r1, c1] = rc(sorted[i - 1]);
      const [r2, c2] = rc(sorted[i]);
      if (Math.abs(r2 - r1) !== Math.abs(d[0]) || Math.abs(c2 - c1) !== Math.abs(d[1])) {
        // must be adjacent steps
        if (Math.abs(r2 - r1) + Math.abs(c2 - c1) === 0) return false;
        if (Math.abs(r2 - r1) !== Math.abs(d[0]) * 1 && d[0] !== 0) return false;
      }
      if (Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) !== 1) return false;
    }
    return true;
  }

  function groupDir(cells) {
    if (cells.length <= 1) return null;
    const sorted = cells.slice().sort((a, b) => a - b);
    return dirBetween(sorted[0], sorted[sorted.length - 1]);
  }

  function enemyAhead(b, cells, dr, dc, steps) {
    // After moving `steps`, does front hit enemy?
    const color = b[cells[0]];
    const enemy = color === W ? B : W;
    let front = cells[0];
    for (const i of cells) {
      const [r, c] = rc(i);
      const [fr, fc] = rc(front);
      if (r * dr + c * dc > fr * dr + fc * dc) front = i;
    }
    const [fr, fc] = rc(front);
    const hits = [];
    for (let s = 1; s <= steps; s++) {
      const rr = fr + dr * s, cc = fc + dc * s;
      if (!inB(rr, cc)) return { ok: false };
      const i = idx(rr, cc);
      if (crossed.has(i)) return { ok: false };
      const v = b[i];
      if (v === color) return { ok: false };
      if (v === enemy) {
        hits.push(i);
        break;
      }
      // empty ok
    }
    // Check path clear of own and that destination squares for each piece are empty or capture square
    return { ok: true, capture: hits[0] };
  }

  function tryMove(b, cells, dr, dc, steps) {
    const color = b[cells[0]];
    const enemy = color === W ? B : W;
    const n = cells.length;
    if (steps < 1 || steps > n) return null;
    if (crossed.has(cells[0])) return null;

    // Map each piece to new position
    const moves = cells.map((i) => {
      const [r, c] = rc(i);
      return { from: i, to: idx(r + dr * steps, c + dc * steps) };
    });
    for (const m of moves) {
      const [r, c] = rc(m.to);
      if (!inB(r, c)) return null;
      if (crossed.has(m.to) && !cells.includes(m.to)) return null;
    }

    // Path: for each step along the way until landing, check collisions
    let capture = null;
    for (let s = 1; s <= steps; s++) {
      for (const i of cells) {
        const [r, c] = rc(i);
        const ti = idx(r + dr * s, c + dc * s);
        if (!inB(r + dr * s, c + dc * s)) return null;
        if (cells.includes(ti)) continue;
        const v = b[ti];
        if (v === color) return null;
        if (v === enemy) {
          if (s !== steps) return null; // can't jump enemy
          // count enemy group size along this line in move direction
          let eg = 0;
          let er = r + dr * s, ec = c + dc * s;
          while (inB(er, ec) && b[idx(er, ec)] === enemy && !crossed.has(idx(er, ec))) {
            eg++;
            er += dr; ec += dc;
          }
          if (eg >= n) return null;
          if (capture == null) capture = idx(r + dr * s, c + dc * s);
          else if (capture !== idx(r + dr * s, c + dc * s)) return null;
        }
      }
    }

    // Destinations must be empty or the single capture square
    const destSet = new Set(moves.map((m) => m.to));
    for (const m of moves) {
      const v = b[m.to];
      if (v === EMPTY || cells.includes(m.to)) continue;
      if (v === enemy && m.to === capture) continue;
      return null;
    }

    const next = b.slice();
    for (const i of cells) next[i] = EMPTY;
    if (capture != null) next[capture] = EMPTY;
    for (const m of moves) {
      if (m.to === capture) continue; // capturer lands on capture square
      next[m.to] = color;
    }
    // Piece that lands on capture
    if (capture != null) {
      const lander = moves.find((m) => m.to === capture);
      if (lander) next[capture] = color;
    }
    return next;
  }

  function singletonMoves(b, from) {
    const color = b[from];
    const list = [];
    for (const [dr, dc] of DIRS) {
      const next = tryMove(b, [from], dr, dc, 1);
      if (next) list.push({ cells: [from], dr, dc, steps: 1, next });
    }
    return list;
  }

  function groupMoves(b, cells) {
    if (!isStraightGroup(cells)) return [];
    if (cells.some((i) => crossed.has(i))) return [];
    if (cells.length === 1) return singletonMoves(b, cells[0]);
    const gd = groupDir(cells);
    if (!gd) return [];
    const list = [];
    for (const [dr, dc] of [gd, [-gd[0], -gd[1]]]) {
      for (let steps = 1; steps <= cells.length; steps++) {
        const next = tryMove(b, cells, dr, dc, steps);
        if (next) list.push({ cells, dr, dc, steps, next });
      }
    }
    return list;
  }

  function allMoves(b, color) {
    const pcs = [];
    for (let i = 0; i < b.length; i++) if (b[i] === color && !crossed.has(i)) pcs.push(i);
    const moves = [];
    // singletons
    for (const p of pcs) moves.push(...singletonMoves(b, p));
    // pairs and longer along lines — sample contiguous runs
    for (const [dr, dc] of DIRS) {
      for (const start of pcs) {
        const run = [start];
        let r = Math.floor(start / SIZE) + dr;
        let c = (start % SIZE) + dc;
        while (inB(r, c) && b[idx(r, c)] === color && !crossed.has(idx(r, c))) {
          run.push(idx(r, c));
          if (run.length >= 2) moves.push(...groupMoves(b, run.slice()));
          r += dr; c += dc;
        }
      }
    }
    // dedupe by next board signature + from set
    const seen = new Set();
    return moves.filter((m) => {
      const key = m.cells.slice().sort().join(",") + "|" + m.next.join("");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function crossingRow(color) {
    return color === W ? 0 : 7;
  }

  function pieceOnFarRow(b, color) {
    const row = crossingRow(color);
    for (let c = 0; c < SIZE; c++) {
      const i = idx(row, c);
      if (b[i] === color && !crossed.has(i)) return i;
    }
    return null;
  }

  function evaluate(b) {
    let score = 0;
    for (let i = 0; i < b.length; i++) {
      if (b[i] === W) score += 10 + (7 - Math.floor(i / SIZE));
      if (b[i] === B) score -= 10 + Math.floor(i / SIZE);
    }
    return score;
  }

  function aiMove() {
    const moves = allMoves(board, B);
    if (!moves.length) {
      over = true;
      statusEl.textContent = "Black has no moves. You win!";
      render();
      return;
    }
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      let s = -evaluate(m.next) + Math.random();
      const cross = pieceOnFarRow(m.next, B);
      if (cross != null) s += 80;
      if (pendingCrossing === W && cross != null) s += 200;
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    applyPlayerMove(best, B);
  }

  function applyPlayerMove(move, color) {
    board = move.next;
    const crossPiece = pieceOnFarRow(board, color);
    if (pendingCrossing && pendingCrossing !== color) {
      if (crossPiece != null) {
        crossed.add(crossPiece);
        // also mark the pending player's crossed piece
        const other = pieceOnFarRow(board, pendingCrossing);
        // find already-crossed from previous — mark any on far row of pending
        for (let c = 0; c < SIZE; c++) {
          const i = idx(crossingRow(pendingCrossing), c);
          if (board[i] === pendingCrossing) crossed.add(i);
        }
        crossed.add(crossPiece);
        pendingCrossing = null;
        statusEl.textContent = "Crossings cancel. Game continues.";
      } else {
        over = true;
        statusEl.textContent = pendingCrossing === W ? "You win by crossing!" : "Black wins by crossing!";
        render();
        return;
      }
    } else if (crossPiece != null) {
      pendingCrossing = color;
      statusEl.textContent =
        color === W
          ? "Crossing! Black must answer immediately."
          : "Black crossed! You must answer this turn.";
    }

    turn = color === W ? B : W;
    selected = [];
    render();
    if (over) return;
    if (turn === B) {
      statusEl.textContent = (statusEl.textContent.includes("Crossing") ? statusEl.textContent + " " : "") + "AI thinking…";
      setTimeout(aiMove, 300);
    } else if (!statusEl.textContent.includes("Crossing") && !statusEl.textContent.includes("cancel")) {
      statusEl.textContent = "Your turn (White).";
    }
  }

  function render() {
    boardEl.innerHTML = "";
    const color = turn;
    const moves =
      !over && turn === W && selected.length
        ? groupMoves(board, selected)
        : [];
    const destKeys = new Set(
      moves.map((m) => {
        // highlight landing of "front" — any new occupied
        return m.cells.map((c, i) => {
          const [r, col] = rc(c);
          return idx(r + m.dr * m.steps, col + m.dc * m.steps);
        }).join(",");
      })
    );
    const destCells = new Set();
    for (const m of moves) {
      for (const c of m.cells) {
        const [r, col] = rc(c);
        destCells.add(idx(r + m.dr * m.steps, col + m.dc * m.steps));
      }
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const i = idx(r, c);
        const cell = document.createElement("div");
        cell.className = `cell ${(r + c) % 2 ? "dark" : "light"}`;
        if (selected.includes(i)) cell.classList.add("selected");
        if (destCells.has(i)) cell.classList.add("dest");
        if (crossed.has(i)) cell.classList.add("crossed");
        if (board[i]) {
          const img = document.createElement("img");
          img.className = "piece";
          img.src = board[i] === W ? whiteImg : blackImg;
          img.alt = board[i] === W ? "White" : "Black";
          cell.appendChild(img);
        }
        cell.addEventListener("click", () => onClick(i));
        boardEl.appendChild(cell);
      }
    }
    hintEl.textContent = selected.length
      ? `Selected ${selected.length} piece(s). Click a highlighted destination, or click empty to clear.`
      : "Click your pieces to build a phalanx (straight line), then a destination.";
  }

  function onClick(i) {
    if (over || turn !== W) return;
    if (selected.length) {
      const moves = groupMoves(board, selected);
      const hit = moves.find((m) => {
        for (const c of m.cells) {
          const [r, col] = rc(c);
          const dest = idx(r + m.dr * m.steps, col + m.dc * m.steps);
          if (dest === i) return true;
        }
        return false;
      });
      if (hit) {
        applyPlayerMove(hit, W);
        return;
      }
    }
    if (board[i] === W && !crossed.has(i)) {
      if (selected.includes(i)) {
        selected = selected.filter((x) => x !== i);
      } else {
        const next = selected.concat(i);
        if (isStraightGroup(next) && next.every((x) => board[x] === W)) selected = next;
        else if (board[i] === W) selected = [i];
      }
      render();
      return;
    }
    selected = [];
    render();
  }

  function newGame() {
    board = setup();
    crossed = new Set();
    turn = W;
    selected = [];
    over = false;
    pendingCrossing = null;
    statusEl.textContent = "Your turn (White).";
    render();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
