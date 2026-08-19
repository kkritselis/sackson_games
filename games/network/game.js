(() => {
  const SIZE = 8;
  const NEED = 10;
  const B = "b";
  const W = "w";
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const countsEl = document.getElementById("counts");
  const btnNew = document.getElementById("btn-new");

  let grid; // null | 'b' | 'w'
  let phase; // place | move
  let turn;
  let placed;
  let selected;
  let over;
  let privilegeUsed; // for white (AI / second) during place: groups of 3 or 4 allowed once each conceptually as "privilege"

  function dead(r, c) {
    return (r === 0 || r === 7) && (c === 0 || c === 7);
  }

  function goalOf(r, c) {
    // Black goals: top row cols 1-6 and bottom row cols 1-6
    if (r === 0 && c >= 1 && c <= 6) return B;
    if (r === 7 && c >= 1 && c <= 6) return B;
    // White goals: left/right cols rows 1-6
    if (c === 0 && r >= 1 && r <= 6) return W;
    if (c === 7 && r >= 1 && r <= 6) return W;
    return null;
  }

  function reset() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    phase = "place";
    turn = W; // first player White (AI) — human Black second with privilege
    // Actually: human should play; let human be Black with goals top/bottom, computer White.
    // First player White (computer), human second with privilege.
    placed = { b: 0, w: 0 };
    selected = null;
    over = false;
    privilegeUsed = { size3: false, size4: false };
    // Flip: human goes first as Black for friendlier UX
    turn = B;
    privilegeUsed = null; // human first; AI as second gets privilege
    aiPrivilege = { size3: false, size4: false };
    render();
    statusEl.textContent = "Your turn — place a piece";
  }

  let aiPrivilege = { size3: false, size4: false };

  function neighbors8(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !dead(nr, nc)) out.push([nr, nc]);
      }
    }
    return out;
  }

  function groupSizeIfPlace(player, r, c, ignoreR, ignoreC) {
    // flood fill adjoining same color including (r,c)
    const seen = new Set();
    const key = (x, y) => x + "," + y;
    const stack = [[r, c]];
    seen.add(key(r, c));
    while (stack.length) {
      const [cr, cc] = stack.pop();
      for (const [nr, nc] of neighbors8(cr, cc)) {
        if (seen.has(key(nr, nc))) continue;
        if (ignoreR === nr && ignoreC === nc) continue;
        if (grid[nr][nc] === player || (nr === r && nc === c)) {
          seen.add(key(nr, nc));
          stack.push([nr, nc]);
        }
      }
    }
    return seen.size;
  }

  function maxAllowedGroup(player) {
    if (phase !== "place") return 2;
    if (player === W && aiPrivilege) {
      // second player privilege during placement
      if (!aiPrivilege.size4) return 4;
      if (!aiPrivilege.size3) return 3;
    }
    return 2;
  }

  function canPlace(player, r, c, fromR, fromC) {
    if (dead(r, c)) return false;
    if (grid[r][c]) return false;
    const g = goalOf(r, c);
    if (g && g !== player) return false;
    const sz = groupSizeIfPlace(player, r, c, fromR, fromC);
    return sz <= maxAllowedGroup(player);
  }

  function pieces(player) {
    const list = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === player) list.push([r, c]);
    return list;
  }

  function lineClear(r1, c1, r2, c2, player) {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    if (!dr && !dc) return false;
    // must be straight ortho or diag
    if (dr && dc && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return false;
    let r = r1 + dr, c = c1 + dc;
    while (r !== r2 || c !== c2) {
      if (grid[r][c] && grid[r][c] !== player) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  function connectedPairs(player) {
    const pts = pieces(player);
    const edges = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const [r1, c1] = pts[i];
        const [r2, c2] = pts[j];
        const dr = r2 - r1, dc = c2 - c1;
        if (!dr && !dc) continue;
        if (dr && dc && Math.abs(dr) !== Math.abs(dc)) continue;
        if (Math.abs(dr) + Math.abs(dc) === 0) continue;
        // adjacent or farther with clear line
        if (lineClear(r1, c1, r2, c2, player)) edges.push([i, j]);
      }
    }
    return { pts, edges };
  }

  function hasNetwork(player) {
    const goals = pieces(player).filter(([r, c]) => goalOf(r, c) === player);
    const gA = goals.filter(([r, c]) => (player === B ? r === 0 : c === 0));
    const gB = goals.filter(([r, c]) => (player === B ? r === 7 : c === 7));
    if (!gA.length || !gB.length) return false;
    const { pts, edges } = connectedPairs(player);
    const idx = new Map(pts.map((p, i) => [p[0] + "," + p[1], i]));
    const adj = Array.from({ length: pts.length }, () => []);
    for (const [i, j] of edges) {
      adj[i].push(j);
      adj[j].push(i);
    }

    // Find path from one goal A piece to one goal B piece, length >= 6 nodes, no revisit, only one from each goal area
    for (const a of gA) {
      for (const b of gB) {
        const start = idx.get(a[0] + "," + a[1]);
        const end = idx.get(b[0] + "," + b[1]);
        if (start == null || end == null) continue;
        if (dfsNet(start, end, adj, pts, player, new Set([start]), [start])) return true;
      }
    }
    return false;
  }

  function dfsNet(cur, end, adj, pts, player, seen, path) {
    if (path.length >= 6 && cur === end) {
      // may not pass through own piece without "turning" — approximate: disallow collinear triple in path
      if (validPathGeometry(path, pts)) return true;
    }
    if (cur === end && path.length >= 6) return false;
    for (const n of adj[cur]) {
      if (seen.has(n)) continue;
      // only one piece from each goal area in the path
      const [nr, nc] = pts[n];
      if (goalOf(nr, nc) === player) {
        const startGoal = goalOf(pts[path[0]][0], pts[path[0]][1]);
        const thisGoalSide = player === B ? (nr === 0 ? "top" : nr === 7 ? "bot" : null) : (nc === 0 ? "left" : nc === 7 ? "right" : null);
        const startSide = player === B ? (pts[path[0]][0] === 0 ? "top" : "bot") : (pts[path[0]][1] === 0 ? "left" : "right");
        if (thisGoalSide === startSide && n !== path[0]) continue;
        if (path.length > 1 && thisGoalSide && thisGoalSide !== startSide && n !== end) {
          // intermediate goal piece of opposite side — only allow if it's the end
        }
        if (n !== end && n !== path[0] && goalOf(nr, nc) === player) {
          const side = player === B ? (nr === 0 ? "top" : "bot") : (nc === 0 ? "left" : "right");
          const endSide = player === B ? (pts[end][0] === 0 ? "top" : "bot") : (pts[end][1] === 0 ? "left" : "right");
          if (side === endSide || side === startSide) continue;
        }
      }
      seen.add(n);
      path.push(n);
      if (dfsNet(n, end, adj, pts, player, seen, path)) return true;
      path.pop();
      seen.delete(n);
    }
    return false;
  }

  function validPathGeometry(path, pts) {
    // network may not pass through own piece without turning
    for (let i = 1; i < path.length - 1; i++) {
      const [r0, c0] = pts[path[i - 1]];
      const [r1, c1] = pts[path[i]];
      const [r2, c2] = pts[path[i + 1]];
      const d1r = Math.sign(r1 - r0), d1c = Math.sign(c1 - c0);
      const d2r = Math.sign(r2 - r1), d2c = Math.sign(c2 - c1);
      if (d1r === d2r && d1c === d2c) return false; // going straight through without turn
    }
    return true;
  }

  function notePrivilege(player, r, c) {
    if (player !== W || !aiPrivilege || phase !== "place") return;
    const sz = groupSizeIfPlace(player, r, c, -1, -1);
    if (sz === 4) aiPrivilege.size4 = true;
    else if (sz === 3) aiPrivilege.size3 = true;
  }

  function checkWin(afterPlayer) {
    const other = afterPlayer === B ? W : B;
    const meWin = hasNetwork(afterPlayer);
    const themWin = hasNetwork(other);
    if (meWin && themWin) return false; // illegal — caller should prevent
    if (meWin) {
      over = true;
      statusEl.textContent = afterPlayer === B ? "You complete a network — you win!" : "Computer completes a network.";
      return true;
    }
    return false;
  }

  function wouldDoubleWin(player, moveFn) {
    // apply, test, revert
    moveFn();
    const bad = hasNetwork(player) && hasNetwork(player === B ? W : B);
    // revert handled by caller snapshot
    return bad;
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + ((r + c) % 2 ? "dark" : "light");
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (dead(r, c)) cell.classList.add("dead");
        else {
          const g = goalOf(r, c);
          if (g === B) cell.classList.add("goal-b");
          if (g === W) cell.classList.add("goal-w");
          if (grid[r][c]) {
            const p = document.createElement("div");
            p.className = "piece " + grid[r][c];
            cell.appendChild(p);
          }
          if (selected && selected[0] === r && selected[1] === c) cell.classList.add("sel");
        }
        boardEl.appendChild(cell);
      }
    }
    countsEl.textContent = `You ${placed.b}/10 · AI ${placed.w}/10 · ${phase}`;
  }

  function place(player, r, c) {
    grid[r][c] = player;
    placed[player]++;
    notePrivilege(player, r, c);
  }

  function aiPlace() {
    const opts = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (canPlace(W, r, c)) opts.push([r, c]);
    if (!opts.length) return;
    // Prefer goal squares and center-ish
    opts.sort((a, b) => scorePlace(b) - scorePlace(a));
    const pick = opts[Math.floor(Math.random() * Math.min(4, opts.length))];
    place(W, pick[0], pick[1]);
  }

  function scorePlace([r, c]) {
    let s = 0;
    if (goalOf(r, c) === W) s += 5;
    s += 4 - Math.abs(r - 3.5) - Math.abs(c - 3.5) * 0.3;
    return s + Math.random();
  }

  function aiMove() {
    const mine = pieces(W);
    const candidates = [];
    for (const [r, c] of mine) {
      for (let tr = 0; tr < SIZE; tr++) {
        for (let tc = 0; tc < SIZE; tc++) {
          if (!canPlace(W, tr, tc, r, c)) continue;
          candidates.push([r, c, tr, tc]);
        }
      }
    }
    if (!candidates.length) return;
    let best = null;
    let bestS = -Infinity;
    for (const m of shuffle(candidates).slice(0, 60)) {
      const [r, c, tr, tc] = m;
      grid[r][c] = null;
      grid[tr][tc] = W;
      if (hasNetwork(B) && hasNetwork(W)) {
        grid[tr][tc] = null;
        grid[r][c] = W;
        continue;
      }
      let s = hasNetwork(W) ? 1000 : 0;
      s += pieces(W).filter((p) => goalOf(p[0], p[1]) === W).length * 3;
      s += Math.random();
      grid[tr][tc] = null;
      grid[r][c] = W;
      if (s > bestS) {
        bestS = s;
        best = m;
      }
    }
    if (!best) best = candidates[0];
    const [r, c, tr, tc] = best;
    grid[r][c] = null;
    grid[tr][tc] = W;
  }

  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  function afterHuman() {
    render();
    if (checkWin(B)) return;
    if (phase === "place" && placed.b + placed.w >= NEED * 2) phase = "move";
    turn = W;
    statusEl.textContent = "Computer turn…";
    setTimeout(() => {
      if (over) return;
      if (phase === "place") {
        aiPlace();
        if (placed.b + placed.w >= NEED * 2) phase = "move";
      } else {
        aiMove();
      }
      render();
      if (checkWin(W)) return;
      turn = B;
      statusEl.textContent = phase === "place" ? "Your turn — place a piece" : "Your turn — move a piece";
      render();
    }, 250);
  }

  boardEl.addEventListener("click", (e) => {
    if (over || turn !== B) return;
    const cell = e.target.closest(".cell");
    if (!cell || cell.classList.contains("dead")) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;

    if (phase === "place") {
      if (placed.b >= NEED) return;
      if (!canPlace(B, r, c)) return;
      place(B, r, c);
      afterHuman();
      return;
    }

    // move phase
    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) {
        selected = null;
        render();
        return;
      }
      if (!canPlace(B, r, c, sr, sc)) return;
      grid[sr][sc] = null;
      grid[r][c] = B;
      if (hasNetwork(B) && hasNetwork(W)) {
        grid[r][c] = null;
        grid[sr][sc] = B;
        statusEl.textContent = "Illegal: that would complete both networks.";
        selected = null;
        render();
        return;
      }
      selected = null;
      afterHuman();
      return;
    }

    if (grid[r][c] === B) {
      selected = [r, c];
      render();
    }
  });

  btnNew.addEventListener("click", reset);
  reset();
})();
