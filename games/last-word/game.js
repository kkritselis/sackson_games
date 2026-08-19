(function () {
  const N = 9;
  const DIRS = [
    { name: "E", dr: 0, dc: 1 },
    { name: "W", dr: 0, dc: -1 },
    { name: "S", dr: 1, dc: 0 },
    { name: "N", dr: -1, dc: 0 },
    { name: "SE", dr: 1, dc: 1 },
    { name: "NW", dr: -1, dc: -1 },
    { name: "NE", dr: -1, dc: 1 },
    { name: "SW", dr: 1, dc: -1 }
  ];
  // Pair opposite dirs into lines through the placed cell
  const LINES = [
    ["E", "W"],
    ["S", "N"],
    ["SE", "NW"],
    ["NE", "SW"]
  ];

  let state;
  let sel = null;

  function $(id) { return document.getElementById(id); }

  function emptyBoard() {
    return Array.from({ length: N }, () => Array(N).fill(null));
  }

  function seedCenter(board) {
    const pool = "ETAOINSHRDLCUMWFGYPBVKJXQZ";
    for (let r = 3; r <= 5; r++) {
      for (let c = 3; c <= 5; c++) {
        board[r][c] = pool[(Math.random() * pool.length) | 0];
      }
    }
  }

  function newGame() {
    const board = emptyBoard();
    seedCenter(board);
    state = {
      board,
      scoreYou: 0,
      scoreAi: 0,
      turn: "you",
      over: false,
      message: "Select a legal empty cell, type a letter, name words (≥2 dirs)."
    };
    sel = null;
    render();
  }

  function inBounds(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  function neighborsLetters(r, c) {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (inBounds(rr, cc) && state.board[rr][cc]) n++;
      }
    }
    return n;
  }

  function legalCells() {
    const out = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!state.board[r][c] && neighborsLetters(r, c) >= 2) out.push({ r, c });
      }
    }
    return out;
  }

  function dirMap() {
    const m = {};
    DIRS.forEach((d) => { m[d.name] = d; });
    return m;
  }

  /** Letters contiguous with (r,c) along a line (both directions), including placed letter. */
  function lineLetters(r, c, letter, pair) {
    const dm = dirMap();
    const chars = [letter];
    pair.forEach((name) => {
      const d = dm[name];
      let rr = r + d.dr, cc = c + d.dc;
      while (inBounds(rr, cc) && state.board[rr][cc]) {
        chars.push(state.board[rr][cc]);
        rr += d.dr;
        cc += d.dc;
      }
    });
    return chars;
  }

  /** Longest word from letters on a line (must include newly placed letter at index 0).
   *  Permissive: any alphabetic string length ≥ 2. Prefers a dictionary anagram when found. */
  function bestWordFromLine(chars) {
    const n = Math.min(chars.length, 8);
    let best = "";
    const limit = 1 << n;
    for (let mask = 1; mask < limit; mask += 2) {
      const picked = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) picked.push(chars[i]);
      if (picked.length < 2) continue;
      const sorted = picked.slice().sort().join("");
      let candidate = picked.join("");
      // Quick dict probe: check a few permutations via sorted match on common lengths
      if (picked.length <= 5) {
        const perms = permuteUnique(picked);
        for (let i = 0; i < perms.length; i++) {
          const w = perms[i].join("");
          if (window.isDictWord(w)) {
            candidate = w;
            break;
          }
        }
      } else if (window.isDictWord(sorted)) {
        candidate = sorted;
      }
      if (!window.isAcceptableWord(candidate)) continue;
      const preferDict = window.isDictWord(candidate);
      const bestDict = best && window.isDictWord(best);
      if (
        candidate.length > best.length ||
        (candidate.length === best.length && preferDict && !bestDict)
      ) {
        best = candidate;
      }
    }
    return best;
  }

  function permuteUnique(arr) {
    const out = [];
    const a = arr.slice().sort();
    const used = Array(a.length).fill(false);
    const cur = [];
    function go() {
      if (cur.length === a.length) {
        out.push(cur.slice());
        return;
      }
      for (let i = 0; i < a.length; i++) {
        if (used[i]) continue;
        if (i > 0 && a[i] === a[i - 1] && !used[i - 1]) continue;
        used[i] = true;
        cur.push(a[i]);
        go();
        cur.pop();
        used[i] = false;
      }
    }
    go();
    return out;
  }

  function scorePlacement(r, c, letter) {
    const words = [];
    LINES.forEach((pair) => {
      const chars = lineLetters(r, c, letter, pair);
      if (chars.length < 2) return;
      const w = bestWordFromLine(chars);
      if (w && w.length >= 2) words.push({ line: pair.join("/"), word: w });
    });
    // Need ≥2 directions
    if (words.length < 2) return null;
    // Only longest per... we already one per line; product of lengths
    let product = 1;
    words.forEach((w) => { product *= w.word.length; });
    return { words, product };
  }

  function edgesTouched() {
    const b = state.board;
    let top = false, bottom = false, left = false, right = false;
    for (let i = 0; i < N; i++) {
      if (b[0][i]) top = true;
      if (b[N - 1][i]) bottom = true;
      if (b[i][0]) left = true;
      if (b[i][N - 1]) right = true;
    }
    return { top, bottom, left, right, all: top && bottom && left && right };
  }

  function playAt(r, c, letter, who) {
    letter = letter.toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return false;
    if (state.board[r][c]) return false;
    if (neighborsLetters(r, c) < 2) return false;
    const scored = scorePlacement(r, c, letter);
    if (!scored) return false;
    state.board[r][c] = letter;
    if (who === "you") state.scoreYou += scored.product;
    else state.scoreAi += scored.product;
    state.message =
      (who === "you" ? "You" : "AI") + " plays " + letter + " → " +
      scored.words.map((w) => w.word).join(", ") + " = " + scored.product + " pts.";
    if (edgesTouched().all) {
      state.over = true;
      state.message +=
        state.scoreYou >= state.scoreAi ? " You win!" : " AI wins.";
    }
    return true;
  }

  function humanPlay() {
    if (state.over || state.turn !== "you" || !sel) return;
    const letter = $("letter").value.trim().toUpperCase();
    if (!playAt(sel.r, sel.c, letter, "you")) {
      state.message = "Need a letter forming words in at least two directions (any ≥2-letter strings OK).";
      render();
      return;
    }
    sel = null;
    $("letter").value = "";
    if (state.over) {
      render();
      return;
    }
    state.turn = "ai";
    render();
    setTimeout(aiPlay, 500);
  }

  function aiPlay() {
    if (state.over || state.turn !== "ai") return;
    const cells = legalCells();
    const letters = "ETAOINSHRDLCUMWFGYPBVKJXQZ";
    let best = null;
    // Sample search
    for (const cell of cells) {
      for (let i = 0; i < letters.length; i++) {
        const L = letters[i];
        const scored = scorePlacement(cell.r, cell.c, L);
        if (!scored) continue;
        // Prefer dict-heavy plays
        const dictBonus = scored.words.filter((w) => window.isDictWord(w.word)).length * 5;
        const val = scored.product + dictBonus;
        if (!best || val > best.val) best = { cell, L, scored, val };
      }
    }
    if (!best) {
      state.message = "AI cannot move — your turn again.";
      state.turn = "you";
      render();
      return;
    }
    playAt(best.cell.r, best.cell.c, best.L, "ai");
    if (!state.over) state.turn = "you";
    render();
  }

  function preview() {
    const box = $("word-forms");
    if (!sel) {
      box.textContent = "Click a highlighted cell.";
      return;
    }
    const letter = ($("letter").value.trim().toUpperCase() || "?");
    if (!/^[A-Z]$/.test(letter)) {
      box.textContent = "Enter a letter A–Z.";
      return;
    }
    const scored = scorePlacement(sel.r, sel.c, letter);
    if (!scored) {
      box.textContent = "Need ≥2 direction words.";
      return;
    }
    box.textContent = scored.words.map((w) => w.word + " (" + w.line + ")").join(" · ") + " → " + scored.product;
  }

  function render() {
    $("status").textContent = state.message + (state.over ? "" : " — " + (state.turn === "you" ? "Your turn" : "AI turn"));
    $("sc-you").textContent = state.scoreYou;
    $("sc-ai").textContent = state.scoreAi;
    const legal = new Set(legalCells().map((p) => p.r + "," + p.c));
    const board = $("board");
    board.innerHTML = "";
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("div");
        const ch = state.board[r][c];
        cell.className = "cell" + (ch ? " has" : "");
        if (ch) {
          cell.dataset.letter = ch;
          cell.textContent = ch;
        }
        if (!ch && legal.has(r + "," + c) && state.turn === "you" && !state.over) {
          cell.classList.add("legal");
          cell.onclick = () => {
            sel = { r, c };
            render();
            preview();
          };
        }
        if (sel && sel.r === r && sel.c === c) cell.classList.add("sel");
        board.appendChild(cell);
      }
    }
    preview();
  }

  $("btn-new").onclick = newGame;
  $("btn-play").onclick = humanPlay;
  $("letter").addEventListener("input", preview);
  newGame();
})();
