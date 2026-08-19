(() => {
  const N = 22;
  const ORIGIN = 10;

  function makeDeck() {
    const one = [];
    for (let a = 1; a <= 5; a++) {
      for (let b = a; b <= 5; b++) one.push({ a, b });
    }
    return one.concat(one.map((d) => ({ a: d.a, b: d.b })));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const state = {
    cells: [],
    tiles: [], // {id, a, b, r, c, orient, owner}
    nextId: 1,
    you: [],
    ai: [],
    scores: { you: 0, ai: 0 },
    turn: "you",
    selected: null,
    over: false,
    passes: 0
  };

  const el = {
    board: document.getElementById("board"),
    hand: document.getElementById("hand"),
    status: document.getElementById("status"),
    scoreYou: document.getElementById("score-you"),
    scoreAi: document.getElementById("score-ai"),
    turnLabel: document.getElementById("turn-label"),
    btnPass: document.getElementById("btn-pass"),
    btnNew: document.getElementById("btn-new"),
    orient: document.getElementById("orient")
  };

  function emptyGrid() {
    return Array.from({ length: N }, () => Array.from({ length: N }, () => null));
  }

  function halves(tile) {
    const { r, c, orient, a, b } = tile;
    if (orient === "h") return [{ r, c, v: a }, { r, c: c + 1, v: b }];
    if (orient === "h-flip") return [{ r, c, v: b }, { r, c: c + 1, v: a }];
    if (orient === "v") return [{ r, c, v: a }, { r: r + 1, c, v: b }];
    return [{ r, c, v: b }, { r: r + 1, c, v: a }];
  }

  function isHoriz(orient) {
    return orient === "h" || orient === "h-flip";
  }

  function cloneCells(cells) {
    return cells.map((row) => row.map((x) => (x ? { ...x } : null)));
  }

  function applyTile(cells, tile) {
    const next = cloneCells(cells);
    for (const h of halves(tile)) {
      if (h.r < 0 || h.c < 0 || h.r >= N || h.c >= N) return null;
      if (next[h.r][h.c]) return null;
      next[h.r][h.c] = { v: h.v, tileId: tile.id };
    }
    return next;
  }

  /** Pattern from a number sequence. */
  function analyzePattern(seq) {
    if (seq.length === 0) return { set: false };
    const first = {};
    for (let i = 0; i < seq.length; i++) {
      const n = seq[i];
      if (first[n] !== undefined) {
        const period = i - first[n];
        const pattern = seq.slice(first[n], i);
        return { set: true, pattern, period, lockAt: i, origin: first[n] };
      }
      first[n] = i;
    }
    const uniq = new Set(seq);
    if (uniq.size === 5 && seq.length >= 5) {
      // first index where all five appear
      const seen = new Set();
      let end = 0;
      for (; end < seq.length; end++) {
        seen.add(seq[end]);
        if (seen.size === 5) break;
      }
      const pattern = seq.slice(0, end + 1);
      return { set: true, pattern, period: pattern.length, lockAt: end, origin: 0 };
    }
    return { set: false };
  }

  function sequenceValid(seq) {
    const info = analyzePattern(seq);
    if (!info.set) return true;
    const { pattern, period, origin } = info;
    for (let i = 0; i < seq.length; i++) {
      const expected = pattern[((i - origin) % period + period) % period];
      // Before lock, pattern may not fully apply if lock came from all-five mid-sequence
      // Enforce consistency with repeating pattern across entire group once set.
      if (seq[i] !== expected) {
        // Allow prefix before origin only if origin>0 (duplicate case)
        if (i < origin) continue;
        return false;
      }
    }
    // Also verify the duplicate that locked is consistent
    return true;
  }

  function runsInDirection(cells, horizontal) {
    const runs = [];
    for (let i = 0; i < N; i++) {
      let j = 0;
      while (j < N) {
        const cell = horizontal ? cells[i][j] : cells[j][i];
        if (!cell) {
          j++;
          continue;
        }
        const start = j;
        const vals = [];
        const coords = [];
        while (j < N) {
          const c = horizontal ? cells[i][j] : cells[j][i];
          if (!c) break;
          vals.push(c.v);
          coords.push(horizontal ? { r: i, c: j } : { r: j, c: i });
          j++;
        }
        if (vals.length >= 1) runs.push({ vals, coords, horizontal, line: i, start });
      }
    }
    return runs;
  }

  function allRuns(cells) {
    return runsInDirection(cells, true).concat(runsInDirection(cells, false));
  }

  function boardPatternsOk(cells) {
    return allRuns(cells).every((run) => sequenceValid(run.vals));
  }

  function longSideStackOk(cells, tiles, candidate) {
    // Count consecutive same-orientation tiles sharing long sides through candidate
    const horiz = isHoriz(candidate.orient);
    const hs = halves(candidate);
    // Find tiles that would share long side with candidate
    // Horizontal tiles stack by row; vertical by column
    if (horiz) {
      const row = candidate.r;
      const colStart = Math.min(hs[0].c, hs[1].c);
      // stack is tiles with same cols covering colStart..colStart+1 and adjacent rows
      let count = 1;
      // up
      for (let r = row - 1; r >= 0; r--) {
        const t = tiles.find(
          (x) => isHoriz(x.orient) && x.r === r && Math.min(...halves(x).map((h) => h.c)) === colStart
        );
        if (!t) break;
        count++;
      }
      for (let r = row + 1; r < N; r++) {
        const t = tiles.find(
          (x) => isHoriz(x.orient) && x.r === r && Math.min(...halves(x).map((h) => h.c)) === colStart
        );
        if (!t) break;
        count++;
      }
      return count <= 3;
    }
    const col = candidate.c;
    const rowStart = Math.min(hs[0].r, hs[1].r);
    let count = 1;
    for (let c = col - 1; c >= 0; c--) {
      const t = tiles.find(
        (x) => !isHoriz(x.orient) && x.c === c && Math.min(...halves(x).map((h) => h.r)) === rowStart
      );
      if (!t) break;
      count++;
    }
    for (let c = col + 1; c < N; c++) {
      const t = tiles.find(
        (x) => !isHoriz(x.orient) && x.c === c && Math.min(...halves(x).map((h) => h.r)) === rowStart
      );
      if (!t) break;
      count++;
    }
    return count <= 3;
  }

  function coordKey(r, c) {
    return `${r},${c}`;
  }

  function evaluatePlacement(cells, tiles, tile) {
    const next = applyTile(cells, tile);
    if (!next) return null;
    if (!longSideStackOk(cells, tiles, tile)) return null;
    if (!boardPatternsOk(next)) return null;

    const newCoords = new Set(halves(tile).map((h) => coordKey(h.r, h.c)));
    const beforeRuns = allRuns(cells).filter((r) => r.vals.length >= 1);
    const afterRuns = allRuns(next);

    const extendedLengths = [];
    for (const after of afterRuns) {
      const touchesNew = after.coords.some((p) => newCoords.has(coordKey(p.r, p.c)));
      if (!touchesNew) continue;
      // Was there a prior group on this line that overlaps old cells of this run?
      const oldCoords = after.coords.filter((p) => !newCoords.has(coordKey(p.r, p.c)));
      if (oldCoords.length === 0) continue; // brand new group from this tile alone — doesn't count as extending existing
      // Find matching before-run
      const before = beforeRuns.find((b) =>
        b.horizontal === after.horizontal &&
        b.line === after.line &&
        b.coords.some((p) => oldCoords.some((o) => o.r === p.r && o.c === p.c))
      );
      if (!before || before.vals.length < 1) continue;
      if (after.vals.length <= before.vals.length) continue;
      extendedLengths.push(after.vals.length);
    }

    if (extendedLengths.length < 2) return null;

    let score = extendedLengths.reduce((p, n) => p * n, 1);
    if (tile.a === tile.b) score *= 2;
    return { score, lengths: extendedLengths };
  }

  function listLegal(hand, cells, tiles) {
    const orients = ["h", "v", "h-flip", "v-flip"];
    const occupied = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (cells[r][c]) occupied.push({ r, c });
      }
    }
    const candidates = new Set();
    for (const { r, c } of occupied) {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [2, 0], [0, -2], [-2, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < N && nc < N) candidates.add(coordKey(nr, nc));
      }
    }
    if (occupied.length === 0) candidates.add(coordKey(ORIGIN, ORIGIN));

    const moves = [];
    hand.forEach((dom, handIdx) => {
      for (const orient of orients) {
        for (const key of candidates) {
          const [r, c] = key.split(",").map(Number);
          const tile = { id: -1, a: dom.a, b: dom.b, r, c, orient };
          const ev = evaluatePlacement(cells, tiles, tile);
          if (ev) moves.push({ handIdx, dom, orient, r, c, score: ev.score });
        }
      }
    });
    return moves;
  }

  function renderBoard(ghost) {
    el.board.style.gridTemplateColumns = `repeat(${N}, 36px)`;
    el.board.innerHTML = "";
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        const data = state.cells[r][c];
        if (data) {
          cell.classList.add("filled");
          cell.textContent = data.v;
        } else if (ghost && ghost.some((g) => g.r === r && g.c === c)) {
          const g = ghost.find((x) => x.r === r && x.c === c);
          cell.classList.add("ghost");
          cell.textContent = g.v;
        }
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener("click", () => onCellClick(r, c));
        el.board.appendChild(cell);
      }
    }

    // Highlight legal if selection
    if (state.selected != null && state.turn === "you" && !state.over) {
      const dom = state.you[state.selected];
      const orient = el.orient.value;
      const moves = listLegal([dom], state.cells, state.tiles).filter((m) => m.orient === orient);
      const legalKeys = new Set(moves.map((m) => coordKey(m.r, m.c)));
      [...el.board.children].forEach((cell) => {
        const key = coordKey(+cell.dataset.r, +cell.dataset.c);
        if (legalKeys.has(key)) cell.classList.add("legal");
      });
    }
  }

  function renderHand() {
    el.hand.innerHTML = "";
    state.you.forEach((dom, idx) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "domino" + (dom.a === dom.b ? " double" : "") + (state.selected === idx ? " selected" : "");
      d.innerHTML = `<span class="half">${dom.a}</span><span class="half">${dom.b}</span>`;
      d.addEventListener("click", () => {
        state.selected = state.selected === idx ? null : idx;
        renderHand();
        renderBoard();
        setStatus(state.selected != null
          ? "Click a highlighted cell for the left/top half of your domino."
          : "Select a domino from your hand.");
      });
      el.hand.appendChild(d);
    });
  }

  function setStatus(msg) {
    el.status.textContent = msg;
  }

  function updateScores() {
    el.scoreYou.textContent = state.scores.you;
    el.scoreAi.textContent = state.scores.ai;
    el.turnLabel.textContent = state.over
      ? "Game over"
      : state.turn === "you"
        ? "Your turn"
        : "Computer thinking…";
  }

  function penalty(hand) {
    return hand.reduce((s, d) => s + (d.a === d.b ? 5 : 25), 0);
  }

  function endGame(reason) {
    state.over = true;
    state.scores.you -= penalty(state.you);
    state.scores.ai -= penalty(state.ai);
    updateScores();
    el.btnPass.disabled = true;
    const winner =
      state.scores.you > state.scores.ai
        ? "You win!"
        : state.scores.ai > state.scores.you
          ? "Computer wins."
          : "Tie.";
    setStatus(`${reason} ${winner} Final — You ${state.scores.you}, AI ${state.scores.ai}.`);
    renderBoard();
    renderHand();
  }

  function placeMove(who, move) {
    const hand = who === "you" ? state.you : state.ai;
    const dom = hand[move.handIdx];
    const tile = {
      id: state.nextId++,
      a: dom.a,
      b: dom.b,
      r: move.r,
      c: move.c,
      orient: move.orient,
      owner: who
    };
    const next = applyTile(state.cells, tile);
    if (!next) return false;
    state.cells = next;
    state.tiles.push(tile);
    hand.splice(move.handIdx, 1);
    state.scores[who] += move.score;
    state.passes = 0;
    return true;
  }

  function afterMove(who) {
    updateScores();
    renderBoard();
    renderHand();
    if (state.you.length === 0 || state.ai.length === 0) {
      // opponent who started after gets one more if they haven't played this "round"
      // For 2p: if you emptied, AI gets one more play if AI still has tiles
      if (who === "you" && state.ai.length > 0) {
        state.turn = "ai";
        setStatus(`You played out (+last score). Computer gets one last play…`);
        setTimeout(aiTurn, 450);
        return;
      }
      if (who === "ai" && state.you.length > 0 && state.turn === "done-last") {
        endGame("A hand was emptied.");
        return;
      }
      if (who === "ai" && state.you.length === 0) {
        endGame("Hands emptied.");
        return;
      }
      if (who === "you" && state.ai.length === 0) {
        endGame("Hands emptied.");
        return;
      }
      if (who === "ai" && state.you.length > 0) {
        // AI emptied — you get one more
        state.turn = "you";
        setStatus("Computer played out. You get one last play.");
        refreshPass();
        return;
      }
    }
    state.turn = who === "you" ? "ai" : "you";
    updateScores();
    if (state.turn === "ai") {
      setTimeout(aiTurn, 500);
    } else {
      refreshPass();
      setStatus("Your turn — select a domino and place it.");
    }
  }

  function refreshPass() {
    if (state.over || state.turn !== "you") {
      el.btnPass.disabled = true;
      return;
    }
    const moves = listLegal(state.you, state.cells, state.tiles);
    el.btnPass.disabled = moves.length > 0;
    if (moves.length === 0) setStatus("No legal play — press Cannot play (pass).");
  }

  function onCellClick(r, c) {
    if (state.over || state.turn !== "you" || state.selected == null) return;
    const dom = state.you[state.selected];
    const orient = el.orient.value;
    const moves = listLegal([dom], state.cells, state.tiles).filter(
      (m) => m.orient === orient && m.r === r && m.c === c
    );
    if (!moves.length) {
      setStatus("That placement is not legal with the current orientation.");
      return;
    }
    const move = moves[0];
    move.handIdx = state.selected;
    placeMove("you", move);
    state.selected = null;
    setStatus(`You scored ${move.score}.`);
    afterMove("you");
  }

  function aiTurn() {
    if (state.over) return;
    state.turn = "ai";
    updateScores();
    const moves = listLegal(state.ai, state.cells, state.tiles);
    if (!moves.length) {
      state.passes++;
      setStatus("Computer cannot play.");
      if (state.passes >= 2) {
        endGame("Neither player can move.");
        return;
      }
      state.turn = "you";
      updateScores();
      refreshPass();
      return;
    }
    moves.sort((a, b) => b.score - a.score || Math.random() - 0.5);
    const move = moves[0];
    placeMove("ai", move);
    setStatus(`Computer scored ${move.score}.`);
    if (state.ai.length === 0 && state.you.length > 0) {
      state.turn = "you";
      updateScores();
      renderBoard();
      renderHand();
      setStatus(`Computer scored ${move.score} and emptied. Your last play.`);
      refreshPass();
      return;
    }
    afterMove("ai");
  }

  function deal() {
    const deck = shuffle(makeDeck());
    state.you = deck.splice(0, 14);
    state.ai = deck.splice(0, 14);
    const s1 = deck.pop();
    const s2 = deck.pop();
    // Starter: two horizontal dominos stacked (long sides together)
    const t1 = { id: state.nextId++, a: s1.a, b: s1.b, r: ORIGIN, c: ORIGIN, orient: "h", owner: "starter" };
    const t2 = { id: state.nextId++, a: s2.a, b: s2.b, r: ORIGIN + 1, c: ORIGIN, orient: "h", owner: "starter" };
    // Misdeal if identical doubles
    if (s1.a === s1.b && s2.a === s2.b && s1.a === s2.a) {
      return deal();
    }
    state.cells = emptyGrid();
    state.tiles = [];
    state.cells = applyTile(state.cells, t1);
    state.cells = applyTile(state.cells, t2);
    state.tiles.push(t1, t2);
  }

  function newGame() {
    state.nextId = 1;
    state.scores = { you: 0, ai: 0 };
    state.turn = "you";
    state.selected = null;
    state.over = false;
    state.passes = 0;
    deal();
    updateScores();
    renderBoard();
    renderHand();
    refreshPass();
    setStatus("Your turn — place a domino that extends two or more groups.");
  }

  el.btnNew.addEventListener("click", newGame);
  el.btnPass.addEventListener("click", () => {
    if (state.over || state.turn !== "you") return;
    state.passes++;
    if (state.passes >= 2) {
      endGame("Neither player can move.");
      return;
    }
    setStatus("You pass.");
    state.turn = "ai";
    setTimeout(aiTurn, 400);
  });
  el.orient.addEventListener("change", () => renderBoard());

  newGame();
})();
