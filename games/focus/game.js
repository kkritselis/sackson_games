(() => {
  const W = "w";
  const B = "b";
  const SIZE = 8;
  const MAX = 5;

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const resW = document.getElementById("res-w");
  const resB = document.getElementById("res-b");
  const capW = document.getElementById("cap-w");
  const capB = document.getElementById("cap-b");
  const btnReserve = document.getElementById("btn-reserve");
  const btnCancel = document.getElementById("btn-cancel");
  const btnNew = document.getElementById("btn-new");

  let board; // [r][c] = array bottom→top of 'w'|'b' or null if dead
  let reserves;
  let captures;
  let turn;
  let selected;
  let placeReserve;
  let over;

  function isDead(r, c) {
    return (r === 0 || r === 7) && (c === 0 || c === 7);
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE && !isDead(r, c);
  }

  function controller(stack) {
    if (!stack || !stack.length) return null;
    return stack[stack.length - 1];
  }

  function startSetup() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (isDead(r, c)) board[r][c] = null;
        else board[r][c] = [];
      }
    }
    // Classic Focus 2-player start (row 0 = rank 8 visually)
    const layout = [
      [null, null, B, W, B, W, null, null],
      [null, W, B, W, B, W, B, null],
      [B, W, B, W, B, W, B, W],
      [W, B, W, B, W, B, W, B],
      [B, W, B, W, B, W, B, W],
      [W, B, W, B, W, B, W, B],
      [null, B, W, B, W, B, W, null],
      [null, null, W, B, W, B, null, null],
    ];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (layout[r][c]) board[r][c] = [layout[r][c]];
      }
    }
    reserves = { w: 0, b: 0 };
    captures = { w: 0, b: 0 };
    turn = W;
    selected = null;
    placeReserve = false;
    over = false;
  }

  function cloneBoard(src) {
    return src.map((row) =>
      row.map((cell) => (cell === null ? null : cell.slice()))
    );
  }

  function applyLanding(stack, mover) {
    const next = stack.slice();
    let gotRes = 0;
    let gotCap = 0;
    while (next.length > MAX) {
      const bottom = next.shift();
      if (bottom === mover) gotRes++;
      else gotCap++;
    }
    return { stack: next, gotRes, gotCap };
  }

  function legalMoves(state, player) {
    const moves = [];
    const { board: bd, reserves: res } = state;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const stack = bd[r][c];
        if (!stack || !stack.length) continue;
        if (controller(stack) !== player) continue;
        const h = stack.length;
        for (let n = 1; n <= h; n++) {
          for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const tr = r + dr * n;
            const tc = c + dc * n;
            if (!inBounds(tr, tc)) continue;
            moves.push({ type: "move", r, c, n, tr, tc });
          }
        }
      }
    }
    if (res[player] > 0) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (!inBounds(r, c)) continue;
          moves.push({ type: "reserve", r, c });
        }
      }
    }
    return moves;
  }

  function applyMove(state, move, player) {
    const bd = cloneBoard(state.board);
    const res = { ...state.reserves };
    const cap = { ...state.captures };
    if (move.type === "reserve") {
      res[player]--;
      const landing = (bd[move.r][move.c] || []).concat([player]);
      const { stack, gotRes, gotCap } = applyLanding(landing, player);
      bd[move.r][move.c] = stack;
      res[player] += gotRes;
      cap[player] += gotCap;
    } else {
      const from = bd[move.r][move.c];
      const take = from.slice(from.length - move.n);
      const leave = from.slice(0, from.length - move.n);
      bd[move.r][move.c] = leave;
      const landing = (bd[move.tr][move.tc] || []).concat(take);
      const { stack, gotRes, gotCap } = applyLanding(landing, player);
      bd[move.tr][move.tc] = stack;
      res[player] += gotRes;
      cap[player] += gotCap;
    }
    return { board: bd, reserves: res, captures: cap };
  }

  function canAct(state, player) {
    return legalMoves(state, player).length > 0;
  }

  function scoreState(state, player) {
    const enemy = player === W ? B : W;
    let s = state.reserves[player] * 4 - state.reserves[enemy] * 3;
    s += state.captures[player] * 2 - state.captures[enemy];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const stack = state.board[r][c];
        if (!stack || !stack.length) continue;
        const ctrl = controller(stack);
        const mine = stack.filter((x) => x === player).length;
        const theirs = stack.length - mine;
        if (ctrl === player) s += 3 + stack.length + mine;
        else s -= 2 + theirs;
      }
    }
    return s;
  }

  function aiPick() {
    const state = { board, reserves, captures };
    const moves = legalMoves(state, B);
    if (!moves.length) return null;
    let best = null;
    let bestScore = -Infinity;
    const sample = moves.length > 80 ? shuffle(moves).slice(0, 80) : moves;
    for (const m of sample) {
      const next = applyMove(state, m, B);
      let sc = scoreState(next, B);
      const replies = legalMoves(next, W);
      if (replies.length) {
        let worst = Infinity;
        const rs = replies.length > 40 ? shuffle(replies).slice(0, 40) : replies;
        for (const r of rs) {
          const n2 = applyMove(next, r, W);
          worst = Math.min(worst, scoreState(n2, B));
        }
        sc = sc * 0.35 + worst * 0.65;
      }
      if (sc > bestScore) {
        bestScore = sc;
        best = m;
      }
    }
    return best;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + ((r + c) % 2 ? "dark" : "light");
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (isDead(r, c)) {
          cell.classList.add("dead");
        } else {
          const stack = board[r][c];
          if (stack && stack.length) {
            const wrap = document.createElement("div");
            wrap.className = "stack";
            stack.forEach((p) => {
              const d = document.createElement("div");
              d.className = "piece " + p;
              wrap.appendChild(d);
            });
            cell.appendChild(wrap);
          }
          if (selected && selected.r === r && selected.c === c) cell.classList.add("sel");
          if (selected && selected.targets) {
            if (selected.targets.some((t) => t.tr === r && t.tc === c && t.n === selected.nPick)) {
              cell.classList.add("legal");
            }
          }
          if (placeReserve) cell.classList.add("legal");
        }
        boardEl.appendChild(cell);
      }
    }
    resW.textContent = reserves.w;
    resB.textContent = reserves.b;
    capW.textContent = captures.w;
    capB.textContent = captures.b;
    btnReserve.disabled = over || turn !== W || reserves.w <= 0 || placeReserve;
    btnCancel.disabled = over || (!selected && !placeReserve);
    if (over) return;
    statusEl.textContent = turn === W ? (placeReserve ? "Click a square to place a reserve" : "Your turn") : "Computer thinking…";
  }

  function endIfNeeded() {
    const state = { board, reserves, captures };
    if (!canAct(state, turn)) {
      over = true;
      const winner = turn === W ? "Computer" : "You";
      statusEl.textContent = winner + " win — opponent cannot move.";
      return true;
    }
    return false;
  }

  function doMove(move, player) {
    const next = applyMove({ board, reserves, captures }, move, player);
    board = next.board;
    reserves = next.reserves;
    captures = next.captures;
  }

  function afterHuman() {
    selected = null;
    placeReserve = false;
    turn = B;
    render();
    if (endIfNeeded()) {
      render();
      return;
    }
    setTimeout(aiTurn, 280);
  }

  function aiTurn() {
    if (over || turn !== B) return;
    const m = aiPick();
    if (!m) {
      over = true;
      statusEl.textContent = "You win — computer cannot move.";
      render();
      return;
    }
    doMove(m, B);
    turn = W;
    render();
    endIfNeeded();
    render();
  }

  function targetsFrom(r, c) {
    const stack = board[r][c];
    if (!stack || controller(stack) !== W) return [];
    const list = [];
    const h = stack.length;
    for (let n = 1; n <= h; n++) {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const tr = r + dr * n;
        const tc = c + dc * n;
        if (inBounds(tr, tc)) list.push({ n, tr, tc });
      }
    }
    return list;
  }

  boardEl.addEventListener("click", (e) => {
    if (over || turn !== W) return;
    const cell = e.target.closest(".cell");
    if (!cell || cell.classList.contains("dead")) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;

    if (placeReserve) {
      doMove({ type: "reserve", r, c }, W);
      afterHuman();
      return;
    }

    if (selected) {
      const hit = (selected.targets || []).find((t) => t.tr === r && t.tc === c);
      if (hit) {
        // Prefer max n matching destination if multiple; let user pick by height via second click cycle
        const opts = selected.targets.filter((t) => t.tr === r && t.tc === c);
        const n = opts.sort((a, b) => b.n - a.n)[0].n;
        doMove({ type: "move", r: selected.r, c: selected.c, n, tr: r, tc: c }, W);
        afterHuman();
        return;
      }
      if (controller(board[r][c]) === W) {
        selected = { r, c, targets: targetsFrom(r, c) };
        render();
        return;
      }
      selected = null;
      render();
      return;
    }

    if (controller(board[r][c]) === W) {
      selected = { r, c, targets: targetsFrom(r, c) };
      render();
    }
  });

  btnReserve.addEventListener("click", () => {
    if (over || turn !== W || reserves.w <= 0) return;
    selected = null;
    placeReserve = true;
    render();
  });

  btnCancel.addEventListener("click", () => {
    selected = null;
    placeReserve = false;
    render();
  });

  btnNew.addEventListener("click", () => {
    startSetup();
    render();
  });

  startSetup();
  render();
})();
