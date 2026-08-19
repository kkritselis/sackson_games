(() => {
  // Discrete Cutting Corners on an N×N point grid (N=9 => 8 cells)
  const N = 9;
  const YOU = "you";
  const AI = "ai";
  const COLORS = { you: "#1d4e89", ai: "#c45c26" };
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const statusEl = document.getElementById("status");
  const scoresEl = document.getElementById("scores");
  const btnNew = document.getElementById("btn-new");

  let lines, turnIndex, round, totals, pick, over, humanFirst;

  function pad() { return 28; }
  function gap() { return (cv.width - 2 * pad()) / (N - 1); }
  function toXY(r, c) {
    return [pad() + c * gap(), pad() + r * gap()];
  }
  function nearPoint(x, y) {
    let best = null, bd = 14;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [px, py] = toXY(r, c);
        const d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = { r, c }; }
      }
    return best;
  }

  function onEdge(p) {
    return p.r === 0 || p.r === N - 1 || p.c === 0 || p.c === N - 1;
  }

  function edgeOwner(p) {
    // Adjacent sides: top+left = you, bottom+right = ai
    // Corners shared: prefer first matching rule
    if (p.r === 0 || p.c === 0) {
      if (p.r === N - 1 || p.c === N - 1) {
        // corner between colors — count as both later via edges
      }
      if (p.r === 0 && p.c === N - 1) return "split"; // top-right
      if (p.r === N - 1 && p.c === 0) return "split"; // bottom-left
      if (p.r === 0 || p.c === 0) return YOU;
    }
    if (p.r === N - 1 || p.c === N - 1) return AI;
    return null;
  }

  function isL(a, b, c) {
    // a-b-c with one right angle at b; legs axis-aligned
    const abH = a.r === b.r, abV = a.c === b.c;
    const bcH = b.r === c.r, bcV = b.c === c.c;
    if (!(abH || abV) || !(bcH || bcV)) return false;
    if ((abH && bcH) || (abV && bcV)) return false; // must turn
    if (a.r === c.r && a.c === c.c) return false;
    return true;
  }

  function expandPath(a, b, c) {
    const pts = [];
    const walk = (p, q) => {
      const dr = Math.sign(q.r - p.r);
      const dc = Math.sign(q.c - p.c);
      let r = p.r, c = p.c;
      pts.push({ r, c });
      while (r !== q.r || c !== q.c) {
        r += dr; c += dc;
        pts.push({ r, c });
      }
    };
    walk(a, b);
    pts.pop();
    walk(b, c);
    return pts;
  }

  function segmentsOf(path) {
    const segs = [];
    for (let i = 0; i < path.length - 1; i++) {
      segs.push([path[i], path[i + 1]]);
    }
    return segs;
  }

  function unitSegKey(p, q) {
    const a = p.r < q.r || (p.r === q.r && p.c < q.c) ? p : q;
    const b = a === p ? q : p;
    return a.r + "," + a.c + "-" + b.r + "," + b.c;
  }

  function countCrossings(path) {
    const segs = segmentsOf(path);
    let crosses = 0;
    const seen = new Set();
    for (const line of lines) {
      for (const [p, q] of segmentsOf(line.path)) {
        seen.add(unitSegKey(p, q));
      }
    }
    // Crossing = sharing a vertex that is interior to both paths, or crossing at a grid point where paths meet improperly.
    // Discrete model: a crossing occurs when the new path passes through an interior point already used by an older path,
    // or reuses an older unit segment endpoint that is not on the outer edge start/end only.
    const usedPts = new Map();
    lines.forEach((line, li) => {
      line.path.forEach((p, i) => {
        if (i === 0 || i === line.path.length - 1) return;
        const k = p.r + "," + p.c;
        usedPts.set(k, (usedPts.get(k) || 0) + 1);
      });
      // also mark all points
      line.path.forEach((p) => {
        const k = p.r + "," + p.c;
        if (!usedPts.has(k)) usedPts.set(k, 0);
      });
    });

    const allOld = new Set();
    lines.forEach((line) => line.path.forEach((p) => allOld.add(p.r + "," + p.c)));

    for (let i = 1; i < path.length - 1; i++) {
      const k = path[i].r + "," + path[i].c;
      if (allOld.has(k)) crosses++;
    }
    return crosses;
  }

  function touchesOpponentEdge(path, player) {
    const opp = player === YOU ? AI : YOU;
    const ends = [path[0], path[path.length - 1]];
    return ends.some((p) => {
      const o = edgeOwner(p);
      return o === opp || o === "split";
    });
  }

  function crossesOpponentLine(path, player) {
    const oppPts = new Set();
    lines.filter((l) => l.who !== player).forEach((l) =>
      l.path.forEach((p) => oppPts.add(p.r + "," + p.c))
    );
    return path.some((p, i) => i > 0 && i < path.length - 1 && oppPts.has(p.r + "," + p.c));
  }

  function requiredCrossings() {
    return turnIndex; // 0..5
  }

  function currentPlayer() {
    const first = humanFirst ? YOU : AI;
    return turnIndex % 2 === 0 ? first : first === YOU ? AI : YOU;
  }

  function tryAdd(a, b, c, player) {
    if (!onEdge(a) || !onEdge(c)) return "Ends must be on the square’s edge.";
    if (!isL(a, b, c)) return "Need an axis-aligned L (one right angle).";
    const path = expandPath(a, b, c);
    const need = requiredCrossings();
    const got = countCrossings(path);
    if (got !== need) return `Need exactly ${need} crossing(s); this has ${got}.`;
    if (turnIndex > 0) {
      const ok =
        crossesOpponentLine(path, player) || touchesOpponentEdge(path, player);
      if (!ok) return "Must cross an opponent line or touch an opponent edge.";
    } else {
      if (!touchesOpponentEdge(path, player)) return "First line must touch an opponent-colored edge.";
    }
    lines.push({ path, who: player, a, b, c });
    return null;
  }

  function scoreRegions() {
    // Paint cell borders from lines; flood ownership by counting edge colors around faces — simplified:
    // For each of the (N-1)² cells, count how many of its 4 sides are "owned" by tracing nearby line colors + outer edges.
    const cellScore = { you: 0, ai: 0, tie: 0 };
    const edgeColor = new Map(); // unit edge -> color

    // Outer edges
    for (let i = 0; i < N - 1; i++) {
      edgeColor.set(unitSegKey({ r: 0, c: i }, { r: 0, c: i + 1 }), YOU); // top
      edgeColor.set(unitSegKey({ r: i, c: 0 }, { r: i + 1, c: 0 }), YOU); // left
      edgeColor.set(unitSegKey({ r: N - 1, c: i }, { r: N - 1, c: i + 1 }), AI); // bottom
      edgeColor.set(unitSegKey({ r: i, c: N - 1 }, { r: i + 1, c: N - 1 }), AI); // right
    }
    lines.forEach((line) => {
      for (let i = 0; i < line.path.length - 1; i++) {
        edgeColor.set(unitSegKey(line.path[i], line.path[i + 1]), line.who);
      }
    });

    for (let r = 0; r < N - 1; r++) {
      for (let c = 0; c < N - 1; c++) {
        const sides = [
          unitSegKey({ r, c }, { r, c: c + 1 }),
          unitSegKey({ r: r + 1, c }, { r: r + 1, c: c + 1 }),
          unitSegKey({ r, c }, { r: r + 1, c }),
          unitSegKey({ r, c: c + 1 }, { r: r + 1, c: c + 1 }),
        ];
        let y = 0, a = 0;
        sides.forEach((k) => {
          const col = edgeColor.get(k);
          if (col === YOU) y++;
          if (col === AI) a++;
        });
        // Only count cells that are "cut" (have an internal line nearby) — count all cells for playable score
        if (y > a) cellScore.you++;
        else if (a > y) cellScore.ai++;
        else cellScore.tie++;
      }
    }
    return cellScore;
  }

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    // edges tint
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.you;
    ctx.beginPath();
    ctx.moveTo(...toXY(0, 0));
    ctx.lineTo(...toXY(0, N - 1));
    ctx.moveTo(...toXY(0, 0));
    ctx.lineTo(...toXY(N - 1, 0));
    ctx.stroke();
    ctx.strokeStyle = COLORS.ai;
    ctx.beginPath();
    ctx.moveTo(...toXY(N - 1, 0));
    ctx.lineTo(...toXY(N - 1, N - 1));
    ctx.moveTo(...toXY(0, N - 1));
    ctx.lineTo(...toXY(N - 1, N - 1));
    ctx.stroke();

    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(...toXY(i, 0));
      ctx.lineTo(...toXY(i, N - 1));
      ctx.moveTo(...toXY(0, i));
      ctx.lineTo(...toXY(N - 1, i));
      ctx.stroke();
    }

    lines.forEach((line) => {
      ctx.strokeStyle = COLORS[line.who];
      ctx.lineWidth = 3;
      ctx.beginPath();
      line.path.forEach((p, i) => {
        const [x, y] = toXY(p.r, p.c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    pick.forEach((p) => {
      ctx.fillStyle = "#2a9d8f";
      const [x, y] = toXY(p.r, p.c);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function updateHud() {
    scoresEl.textContent = `Round ${round}/2 — You ${totals.you} · AI ${totals.ai}`;
    if (over) return;
    const p = currentPlayer();
    statusEl.textContent =
      (p === YOU ? "Your turn" : "Computer turn") +
      ` — line ${turnIndex + 1}/6 needs ${requiredCrossings()} crossing(s).`;
  }

  function endRound() {
    const sc = scoreRegions();
    totals.you += sc.you;
    totals.ai += sc.ai;
    statusEl.textContent = `Round over — regions You ${sc.you}, AI ${sc.ai}, ties ${sc.tie}.`;
    if (round >= 2) {
      over = true;
      statusEl.textContent +=
        totals.you === totals.ai
          ? " Match tied."
          : totals.you > totals.ai
            ? " You win the match!"
            : " Computer wins the match.";
      updateHud();
      draw();
      return;
    }
    round++;
    humanFirst = !humanFirst;
    lines = [];
    turnIndex = 0;
    pick = [];
    updateHud();
    draw();
    if (currentPlayer() === AI) setTimeout(aiPlay, 300);
  }

  function afterLine() {
    turnIndex++;
    pick = [];
    updateHud();
    draw();
    if (turnIndex >= 6) {
      endRound();
      return;
    }
    if (currentPlayer() === AI) setTimeout(aiPlay, 300);
  }

  function aiPlay() {
    if (over || currentPlayer() !== AI) return;
    const edges = [];
    for (let i = 0; i < N; i++) {
      edges.push({ r: 0, c: i }, { r: N - 1, c: i }, { r: i, c: 0 }, { r: i, c: N - 1 });
    }
    const uniq = [];
    const seen = new Set();
    edges.forEach((p) => {
      const k = p.r + "," + p.c;
      if (!seen.has(k)) { seen.add(k); uniq.push(p); }
    });
    const corners = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) corners.push({ r, c });
    const tries = [];
    for (let i = 0; i < 400; i++) {
      const a = uniq[Math.floor(Math.random() * uniq.length)];
      const c = uniq[Math.floor(Math.random() * uniq.length)];
      const b = corners[Math.floor(Math.random() * corners.length)];
      tries.push([a, b, c]);
    }
    for (const [a, b, c] of tries) {
      const err = tryAdd(a, b, c, AI);
      if (!err) {
        // tryAdd already pushed — good
        // Wait, tryAdd pushes on success. Good.
        afterLine();
        return;
      }
    }
    // fallback: accept any L
    statusEl.textContent = "AI could not find a perfect line — skipping.";
    turnIndex++;
    if (turnIndex >= 6) endRound();
    else if (currentPlayer() === AI) setTimeout(aiPlay, 200);
    else updateHud();
  }

  // Fix tryAdd — it currently pushes on success but returns null. AI loop calls tryAdd which mutates.
  // But failed tryAdd shouldn't push — looking at code: lines.push only after checks with return null — good.
  // However on failure it returns string without pushing. Good.

  function resetMatch() {
    totals = { you: 0, ai: 0 };
    round = 1;
    humanFirst = true;
    lines = [];
    turnIndex = 0;
    pick = [];
    over = false;
    updateHud();
    draw();
  }

  cv.addEventListener("click", (e) => {
    if (over || currentPlayer() !== YOU) return;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cv.width;
    const y = ((e.clientY - rect.top) / rect.height) * cv.height;
    const p = nearPoint(x, y);
    if (!p) return;
    pick.push(p);
    draw();
    if (pick.length < 3) return;
    const [a, b, c] = pick;
    const err = tryAdd(a, b, c, YOU);
    if (err) {
      statusEl.textContent = err;
      pick = [];
      draw();
      return;
    }
    afterLine();
  });

  btnNew.addEventListener("click", resetMatch);
  resetMatch();
})();
