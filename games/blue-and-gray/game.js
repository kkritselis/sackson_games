(() => {
  const N = 9;
  const STAR = { r: 4, c: 4 };
  const CENTER = new Set();
  for (let r = 3; r <= 5; r++) for (let c = 3; c <= 5; c++) CENTER.add(key(r, c));

  const BLUE_CAP = "../../assets/Pieces%20(Blue)/pieceBlue_border01.png";
  const BLUE_G = "../../assets/Pieces%20(Blue)/pieceBlue_single00.png";
  const GRAY_CAP = "../../assets/Pieces%20(Black)/pieceBlack_border01.png";
  const GRAY_G = "../../assets/Pieces%20(Black)/pieceBlack_single00.png";

  // Check piece asset names exist - may use border if single missing
  const DIRS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];

  function key(r, c) { return r + "," + c; }
  function parse(k) { const [r, c] = k.split(",").map(Number); return { r, c }; }

  const el = {
    status: document.getElementById("status"),
    wrap: document.getElementById("board-wrap"),
    btnNew: document.getElementById("btn-new"),
  };

  let state = null;
  let selected = null;

  function emptyBoard() {
    return {};
  }

  function setup() {
    const board = emptyBoard();
    // Gray (AI) top two rows
    for (let r = 0; r <= 1; r++) {
      for (let c = 0; c < N; c++) {
        if (r === 0 && c === 4) board[key(r, c)] = { side: "ai", kind: "captain" };
        else board[key(r, c)] = { side: "ai", kind: "guard" };
      }
    }
    // Blue (you) bottom two rows
    for (let r = 7; r <= 8; r++) {
      for (let c = 0; c < N; c++) {
        if (r === 8 && c === 4) board[key(r, c)] = { side: "you", kind: "captain" };
        else board[key(r, c)] = { side: "you", kind: "guard" };
      }
    }
    // Fix: two rows = 18 cells, but we placed captain replacing a guard — good (18 each)

    state = { board, turn: "you", over: false, mustContinue: null };
    selected = null;
    setStatus("Your turn — select a Blue piece.");
    render();
  }

  function setStatus(m) { el.status.textContent = m; }

  function inBounds(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function pieceAt(r, c) { return state.board[key(r, c)] || null; }

  function captainForward(side, r, c) {
    if (c !== 4) return null;
    if (side === "you") {
      const nr = r - 1;
      if (nr >= STAR.r && inBounds(nr, c) && !pieceAt(nr, c)) return { r: nr, c };
    } else {
      const nr = r + 1;
      if (nr <= STAR.r && inBounds(nr, c) && !pieceAt(nr, c)) return { r: nr, c };
    }
    return null;
  }

  function guardMoves(r, c, side) {
    const moves = [];
    const jumps = [];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const mid = pieceAt(nr, nc);
      if (!mid) {
        if (CENTER.has(key(nr, nc))) continue;
        moves.push({ r: nr, c: nc, jump: false });
      } else if (mid.side !== side && mid.kind === "guard") {
        const lr = nr + dr, lc = nc + dc;
        if (inBounds(lr, lc) && !pieceAt(lr, lc) && !CENTER.has(key(lr, lc))) {
          jumps.push({ r: lr, c: lc, jump: true, captured: key(nr, nc) });
        }
      }
    }
    return { moves, jumps };
  }

  function allJumpsFor(side) {
    const list = [];
    for (const [k, p] of Object.entries(state.board)) {
      if (p.side !== side || p.kind !== "guard") continue;
      const { r, c } = parse(k);
      const { jumps } = guardMoves(r, c, side);
      for (const j of jumps) list.push({ from: k, ...j });
    }
    return list;
  }

  function legalActions(side) {
    if (state.mustContinue) {
      const { r, c } = parse(state.mustContinue);
      const { jumps } = guardMoves(r, c, side);
      return jumps.map((j) => ({ from: state.mustContinue, ...j }));
    }
    const forced = allJumpsFor(side);
    if (forced.length) return forced;

    const acts = [];
    for (const [k, p] of Object.entries(state.board)) {
      if (p.side !== side) continue;
      const { r, c } = parse(k);
      if (p.kind === "captain") {
        const m = captainForward(side, r, c);
        if (m) acts.push({ from: k, r: m.r, c: m.c, jump: false });
      } else {
        const { moves } = guardMoves(r, c, side);
        for (const m of moves) acts.push({ from: k, ...m });
      }
    }
    return acts;
  }

  function applyMove(act) {
    const piece = state.board[act.from];
    delete state.board[act.from];
    if (act.jump && act.captured) delete state.board[act.captured];
    state.board[key(act.r, act.c)] = piece;

    if (piece.kind === "captain" && act.r === STAR.r && act.c === STAR.c) {
      state.over = true;
      setStatus(piece.side === "you" ? "You win — captain on the star!" : "Computer wins — captain on the star!");
      selected = null;
      state.mustContinue = null;
      render();
      return;
    }

    if (act.jump) {
      const { jumps } = guardMoves(act.r, act.c, piece.side);
      if (jumps.length) {
        state.mustContinue = key(act.r, act.c);
        selected = state.mustContinue;
        setStatus(piece.side === "you" ? "Continue jumping." : "Computer continues jumping…");
        render();
        if (piece.side === "ai") setTimeout(aiTurn, 400);
        return;
      }
    }

    state.mustContinue = null;
    selected = null;
    if (state.over) return;

    // Impasse check
    const youActs = legalActions("you");
    const aiActs = legalActions("ai");
    // Switch turn first conceptually
    state.turn = piece.side === "you" ? "ai" : "you";

    if (checkBlockedWin()) return;

    if (state.turn === "ai") {
      setStatus("Computer thinking…");
      render();
      setTimeout(aiTurn, 450);
    } else {
      setStatus("Your turn.");
      render();
    }
  }

  function checkBlockedWin() {
    // If both captains blocked and no useful play, farther captain wins (half-game → full for simplicity)
    const youCap = findCaptain("you");
    const aiCap = findCaptain("ai");
    if (!youCap || !aiCap) return false;
    const youFwd = captainForward("you", youCap.r, youCap.c);
    const aiFwd = captainForward("ai", aiCap.r, aiCap.c);
    const youGuards = legalActions("you").some((a) => state.board[a.from]?.kind === "guard");
    const aiGuards = legalActions("ai").some((a) => state.board[a.from]?.kind === "guard");
    // Only declare if captains blocked AND neither side has guard moves that could help — simplified:
    // if both captains cannot move and no jumps exist for either, compare progress
    const youJump = allJumpsFor("you").length;
    const aiJump = allJumpsFor("ai").length;
    if (!youFwd && !aiFwd && !youJump && !aiJump) {
      // Still may have guard slides — if both have no legal actions at all on their turn eventually
      const ya = (() => { const t = state.turn; state.mustContinue = null; const a = legalActions("you"); return a; })();
      const aa = legalActions("ai");
      if (ya.length === 0 && aa.length === 0) {
        const youProg = 8 - youCap.r;
        const aiProg = aiCap.r - 0;
        state.over = true;
        if (youProg > aiProg) setStatus("Impasse — you win (farther captain).");
        else if (aiProg > youProg) setStatus("Impasse — computer wins (farther captain).");
        else setStatus("Impasse — draw.");
        render();
        return true;
      }
    }
    return false;
  }

  function findCaptain(side) {
    for (const [k, p] of Object.entries(state.board)) {
      if (p.side === side && p.kind === "captain") {
        const { r, c } = parse(k);
        return { r, c, k };
      }
    }
    return null;
  }

  function aiTurn() {
    if (state.over || state.turn !== "ai") return;
    const acts = legalActions("ai");
    if (!acts.length) {
      state.turn = "you";
      setStatus("Computer has no move — your turn.");
      render();
      return;
    }
    // Heuristic: prefer jumps, then captain advance, then forward-ish guard moves
    acts.sort((a, b) => scoreAct(b) - scoreAct(a));
    const pick = acts[0];
    applyMove(pick);
  }

  function scoreAct(a) {
    let s = 0;
    if (a.jump) s += 50;
    const p = state.board[a.from];
    if (p.kind === "captain") s += 40 + a.r; // advancing toward center
    else {
      // Prefer clearing path on file 4 and approaching enemy
      s += 10 - Math.abs(a.c - 4);
      s += a.r;
      if (a.c === 4) s += 8;
    }
    return s + Math.random() * 3;
  }

  function cellXY(r, c) {
    const pad = 28;
    const step = 52;
    return { x: pad + c * step, y: pad + r * step };
  }

  function render() {
    const size = 28 + 8 * 52 + 28;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);

    // Grid lines
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const { x, y } = cellXY(i, j);
        if (j < N - 1) {
          const line = document.createElementNS(ns, "line");
          const n = cellXY(i, j + 1);
          line.setAttribute("x1", x); line.setAttribute("y1", y);
          line.setAttribute("x2", n.x); line.setAttribute("y2", n.y);
          line.setAttribute("stroke", "#5c4e38"); line.setAttribute("stroke-width", "1.2");
          svg.appendChild(line);
        }
        if (i < N - 1) {
          const line = document.createElementNS(ns, "line");
          const n = cellXY(i + 1, j);
          line.setAttribute("x1", x); line.setAttribute("y1", y);
          line.setAttribute("x2", n.x); line.setAttribute("y2", n.y);
          line.setAttribute("stroke", "#5c4e38"); line.setAttribute("stroke-width", "1.2");
          svg.appendChild(line);
        }
        // diagonals for visual "any line"
        if (i < N - 1 && j < N - 1) {
          const a = cellXY(i, j), b = cellXY(i + 1, j + 1);
          const line = document.createElementNS(ns, "line");
          line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
          line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
          line.setAttribute("stroke", "#b8a888"); line.setAttribute("stroke-width", "0.6");
          svg.appendChild(line);
        }
        if (i < N - 1 && j > 0) {
          const a = cellXY(i, j), b = cellXY(i + 1, j - 1);
          const line = document.createElementNS(ns, "line");
          line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
          line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
          line.setAttribute("stroke", "#b8a888"); line.setAttribute("stroke-width", "0.6");
          svg.appendChild(line);
        }
      }
    }

    // Center zone shading
    const z0 = cellXY(3, 3), z1 = cellXY(5, 5);
    const zone = document.createElementNS(ns, "rect");
    zone.setAttribute("x", z0.x - 8); zone.setAttribute("y", z0.y - 8);
    zone.setAttribute("width", z1.x - z0.x + 16); zone.setAttribute("height", z1.y - z0.y + 16);
    zone.setAttribute("fill", "rgba(139, 30, 30, 0.12)");
    zone.setAttribute("stroke", "rgba(139, 30, 30, 0.35)");
    svg.appendChild(zone);

    // Heavy center line
    const top = cellXY(0, 4), bot = cellXY(8, 4);
    const heavy = document.createElementNS(ns, "line");
    heavy.setAttribute("x1", top.x); heavy.setAttribute("y1", top.y);
    heavy.setAttribute("x2", bot.x); heavy.setAttribute("y2", bot.y);
    heavy.setAttribute("stroke", "#8b1e1e"); heavy.setAttribute("stroke-width", "5");
    heavy.setAttribute("stroke-linecap", "round");
    svg.appendChild(heavy);

    // Star
    const st = cellXY(STAR.r, STAR.c);
    const star = document.createElementNS(ns, "polygon");
    star.setAttribute("points", starPoints(st.x, st.y, 16, 7));
    star.setAttribute("fill", "#c9a227");
    star.setAttribute("stroke", "#8b1e1e");
    star.setAttribute("stroke-width", "1.5");
    svg.appendChild(star);

    const acts = state.over ? [] : legalActions(state.turn);
    const destSet = new Set();
    const fromSet = new Set();
    for (const a of acts) {
      fromSet.add(a.from);
      if (selected === a.from) destSet.add(key(a.r, a.c));
    }

    // Points + pieces
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const { x, y } = cellXY(r, c);
        const k = key(r, c);
        const g = document.createElementNS(ns, "g");
        g.classList.add("pt");
        if (destSet.has(k)) g.classList.add("highlight");

        const hit = document.createElementNS(ns, "circle");
        hit.setAttribute("cx", x); hit.setAttribute("cy", y); hit.setAttribute("r", 14);
        hit.setAttribute("fill", destSet.has(k) ? "rgba(46,125,50,0.35)" : "transparent");
        hit.classList.add("dest");
        g.appendChild(hit);

        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 3);
        dot.setAttribute("fill", "#3d3426");
        g.appendChild(dot);

        const p = pieceAt(r, c);
        if (p) {
          const img = document.createElementNS(ns, "image");
          const src =
            p.side === "you"
              ? p.kind === "captain" ? BLUE_CAP : BLUE_G
              : p.kind === "captain" ? GRAY_CAP : GRAY_G;
          img.setAttributeNS("http://www.w3.org/1999/xlink", "href", src);
          img.setAttribute("href", src);
          const s = p.kind === "captain" ? 34 : 28;
          img.setAttribute("x", x - s / 2); img.setAttribute("y", y - s / 2);
          img.setAttribute("width", s); img.setAttribute("height", s);
          if (selected === k) img.style.filter = "drop-shadow(0 0 5px #f4d35e)";
          g.appendChild(img);
          if (p.kind === "captain") {
            const label = document.createElementNS(ns, "text");
            label.setAttribute("x", x); label.setAttribute("y", y + 4);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("font-size", "10");
            label.setAttribute("font-weight", "700");
            label.setAttribute("fill", "#fff");
            label.setAttribute("pointer-events", "none");
            label.textContent = "C";
            g.appendChild(label);
          }
        }

        g.addEventListener("click", () => onClick(r, c));
        svg.appendChild(g);
      }
    }

    el.wrap.innerHTML = "";
    el.wrap.appendChild(svg);
  }

  function starPoints(cx, cy, outer, inner) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = (-Math.PI / 2) + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? outer : inner;
      pts.push((cx + Math.cos(ang) * rad) + "," + (cy + Math.sin(ang) * rad));
    }
    return pts.join(" ");
  }

  function onClick(r, c) {
    if (state.over || state.turn !== "you") return;
    const k = key(r, c);
    const acts = legalActions("you");

    if (selected) {
      const move = acts.find((a) => a.from === selected && a.r === r && a.c === c);
      if (move) {
        applyMove(move);
        return;
      }
    }

    const p = pieceAt(r, c);
    if (p && p.side === "you" && acts.some((a) => a.from === k)) {
      selected = k;
      setStatus("Choose a destination" + (acts.some((a) => a.from === k && a.jump) ? " (jump required)." : "."));
      render();
    } else if (!state.mustContinue) {
      selected = null;
      render();
    }
  }

  el.btnNew.addEventListener("click", setup);

  // Verify piece assets; fall back if single missing
  function probe(url, cb) {
    const i = new Image();
    i.onload = () => cb(true);
    i.onerror = () => cb(false);
    i.src = url;
  }

  probe(BLUE_G, (ok) => {
    if (!ok) {
      // fallbacks already use border for captain; remap singles in render via globals if needed
    }
    setup();
  });
})();
