(function () {
  // Positions A-F top row, G-L bottom. Winning sets: ABC, DEF, GHI, JKL
  const POS = "ABCDEFGHIJKL".split("");
  const COLS = [
    ["A", "G"], ["B", "H"], ["C", "I"], ["D", "J"], ["E", "K"], ["F", "L"]
  ];
  const NEIGHBORS = {
    A: ["B", "G"], B: ["A", "C", "H"], C: ["B", "D", "I"], D: ["C", "E", "J"],
    E: ["D", "F", "K"], F: ["E", "L"],
    G: ["A", "H"], H: ["B", "G", "I"], I: ["C", "H", "J"], J: ["D", "I", "K"],
    K: ["E", "J", "L"], L: ["F", "K"]
  };
  const PATTERNS = [
    [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
    [[1, 3, 5], [2, 4, 6], [7, 9, 11], [8, 10, 12]],
    [[1, 5, 9], [2, 6, 10], [3, 7, 11], [4, 8, 12]]
  ];
  const SET_LOCS = [["A", "B", "C"], ["D", "E", "F"], ["G", "H", "I"], ["J", "K", "L"]];

  // Player decks: value 1-12 with suits for pattern 3 visibility
  const YOU_DECK = [
    ["Hearts", "A", 1], ["Hearts", "5", 5], ["Hearts", "9", 9],
    ["Spades", "2", 2], ["Spades", "6", 6], ["Spades", "10", 10],
    ["Diamonds", "3", 3], ["Diamonds", "7", 7], ["Diamonds", "J", 11],
    ["Clubs", "4", 4], ["Clubs", "8", 8], ["Clubs", "Q", 12]
  ];
  const AI_DECK = [
    ["Diamonds", "A", 1], ["Diamonds", "5", 5], ["Diamonds", "9", 9],
    ["Hearts", "2", 2], ["Hearts", "6", 6], ["Hearts", "10", 10],
    ["Clubs", "3", 3], ["Clubs", "7", 7], ["Clubs", "J", 11],
    ["Spades", "4", 4], ["Spades", "8", 8], ["Spades", "Q", 12]
  ];

  let state;

  function dealLayout(spec) {
    const cards = Cards.shuffle(spec.map(([s, r, n]) => {
      const c = Cards.makeCard(s, r);
      c.n = n;
      return c;
    }));
    const layout = {};
    POS.forEach((p, i) => { layout[p] = cards[i]; });
    return layout;
  }

  function vals(layout) {
    const o = {};
    POS.forEach((p) => { o[p] = layout[p].n; });
    return o;
  }

  function isWin(layout) {
    const v = vals(layout);
    for (const pat of PATTERNS) {
      const remaining = pat.map((t) => t.slice().sort((a, b) => a - b));
      let ok = true;
      for (const loc of SET_LOCS) {
        const triple = loc.map((p) => v[p]).sort((a, b) => a - b);
        const idx = remaining.findIndex((t) => t[0] === triple[0] && t[1] === triple[1] && t[2] === triple[2]);
        if (idx < 0) { ok = false; break; }
        remaining.splice(idx, 1);
      }
      if (ok) return true;
    }
    return false;
  }

  function tops(mover, opp, pos) {
    // card at pos tops if 1 or 2 higher than either opp card in same column
    const col = COLS.find((c) => c.includes(pos));
    if (!col) return false;
    const n = mover[pos].n;
    const oppNums = col.map((p) => opp[p].n);
    return oppNums.some((o) => {
      const d = (n - o + 12) % 12;
      return d === 1 || d === 2;
    });
  }

  function lineMatch(mover, opp, p1, p2) {
    return COLS.some((col) => {
      const [a, b] = col;
      return (
        (mover[p1].n === opp[a].n && mover[p2].n === opp[b].n) ||
        (mover[p1].n === opp[b].n && mover[p2].n === opp[a].n)
      );
    }) && COLS.some((col) => col.includes(p1) === false ? false : true) === false
      ? false
      : COLS.some((col) => {
          const nums = [mover[p1].n, mover[p2].n].sort((a, b) => a - b);
          const oppNums = [opp[col[0]].n, opp[col[1]].n].sort((a, b) => a - b);
          return nums[0] === oppNums[0] && nums[1] === oppNums[1];
        });
  }

  // Clarify line move: switch two cards in YOUR layout that match values of a column pair in opponent
  function isLineMove(mover, opp, p1, p2) {
    if (p1 === p2) return false;
    const pair = [mover[p1].n, mover[p2].n].sort((a, b) => a - b);
    return COLS.some((col) => {
      const oppPair = [opp[col[0]].n, opp[col[1]].n].sort((a, b) => a - b);
      return pair[0] === oppPair[0] && pair[1] === oppPair[1];
    });
  }

  function isNeighbor(p1, p2) {
    return (NEIGHBORS[p1] || []).includes(p2);
  }

  function isTopMove(mover, opp, p1, p2) {
    // One of the cards must be a "top" card and switches with any other
    return tops(mover, opp, p1) || tops(mover, opp, p2);
  }

  function newHand() {
    const you = dealLayout(YOU_DECK);
    const ai = dealLayout(AI_DECK);
    // First player: higher card at L, then K, etc.
    let first = "you";
    for (const p of "LKJIHGFEDCBA".split("")) {
      if (you[p].n !== ai[p].n) {
        first = you[p].n > ai[p].n ? "you" : "ai";
        break;
      }
    }
    state = {
      you, ai,
      youChips: 4, aiChips: 4, pool: 4,
      turn: first,
      movesLeft: 1,
      firstTurn: true,
      moveType: null,
      pick: [],
      lastSwap: null,
      scoreYou: 0, scoreAi: 0,
      hands: 0,
      phase: "play",
      message: (first === "you" ? "You" : "AI") + " play first (1 move)."
    };
    render();
    if (first === "ai") setTimeout(aiTurn, 500);
  }

  function swap(layout, p1, p2) {
    const t = layout[p1];
    layout[p1] = layout[p2];
    layout[p2] = t;
  }

  function applyMove(who, type, p1, p2) {
    const layout = state[who];
    const opp = state[who === "you" ? "ai" : "you"];
    if (type === "line") {
      if (!isLineMove(layout, opp, p1, p2)) return false;
      swap(layout, p1, p2);
      if (state.pool > 0) {
        state.pool--;
        if (who === "you") state.youChips++; else state.aiChips++;
      }
    } else if (type === "top") {
      if (!isTopMove(layout, opp, p1, p2)) return false;
      swap(layout, p1, p2);
    } else if (type === "neighbor") {
      if (!isNeighbor(p1, p2)) return false;
      const chips = who === "you" ? state.youChips : state.aiChips;
      if (chips < 1) return false;
      swap(layout, p1, p2);
      if (who === "you") { state.youChips--; } else { state.aiChips--; }
      state.pool++;
    } else return false;

    // No undo of same swap
    state.lastSwap = p1 + p2;
    if (isWin(layout)) {
      endHand(who, type);
      return true;
    }
    state.movesLeft--;
    if (state.movesLeft <= 0) {
      state.turn = who === "you" ? "ai" : "you";
      state.movesLeft = 2;
      state.firstTurn = false;
      state.message = (state.turn === "you" ? "Your" : "AI") + " turn (2 moves).";
      state.pick = [];
      state.moveType = null;
      render();
      if (state.turn === "ai") setTimeout(aiTurn, 450);
    } else {
      state.message = (who === "you" ? "You" : "AI") + " — " + state.movesLeft + " move left.";
      state.pick = [];
      render();
      if (who === "ai" && state.movesLeft > 0) setTimeout(aiTurn, 400);
    }
    return true;
  }

  function endHand(winner, type) {
    let chips = winner === "you" ? state.youChips : state.aiChips;
    if (type === "line") {
      const take = Math.min(3, state.pool);
      state.pool -= take;
      chips += take;
      if (winner === "you") state.youChips = chips; else state.aiChips = chips;
    } else if (type === "neighbor") {
      const pay = Math.min(3, chips);
      chips -= pay;
      state.pool += pay;
      if (winner === "you") state.youChips = chips; else state.aiChips = chips;
    }
    if (chips <= 0) {
      state.message = "Win with 0 chips — hand is a draw.";
    } else {
      if (winner === "you") state.scoreYou += chips;
      else state.scoreAi += chips;
      state.message = (winner === "you" ? "You" : "AI") + " win the hand for " + chips + " points!";
    }
    state.hands++;
    state.phase = "hand-over";
    render();
    if (state.hands >= 4) {
      state.phase = "done";
      state.message += " Match over. Final " + state.scoreYou + "–" + state.scoreAi + ".";
      render();
    } else {
      setTimeout(newHandKeepScore, 1800);
    }
  }

  function newHandKeepScore() {
    const sy = state.scoreYou, sa = state.scoreAi, h = state.hands;
    newHand();
    state.scoreYou = sy;
    state.scoreAi = sa;
    state.hands = h;
    state.message = "Hand " + (h + 1) + ". " + state.message;
    render();
  }

  function tryHumanSwap() {
    if (state.phase !== "play" || state.turn !== "you" || state.pick.length !== 2 || !state.moveType) return;
    const [p1, p2] = state.pick;
    if (!applyMove("you", state.moveType, p1, p2)) {
      state.message = "Illegal " + state.moveType + " move.";
      state.pick = [];
      render();
    }
  }

  function aiTurn() {
    if (state.phase !== "play" || state.turn !== "ai") return;
    const layout = state.ai;
    const opp = state.you;
    const tries = [];
    for (let i = 0; i < POS.length; i++) {
      for (let j = i + 1; j < POS.length; j++) {
        const a = POS[i], b = POS[j];
        if (isLineMove(layout, opp, a, b)) tries.push(["line", a, b]);
        if (isTopMove(layout, opp, a, b)) tries.push(["top", a, b]);
        if (isNeighbor(a, b) && state.aiChips > 0) tries.push(["neighbor", a, b]);
      }
    }
    // Prefer moves that increase pattern-ish groups
    tries.sort((x, y) => {
      const score = (t) => {
        const copy = {};
        POS.forEach((p) => { copy[p] = Object.assign({}, layout[p]); });
        swap(copy, t[1], t[2]);
        return patternScore(copy) + (t[0] === "line" ? 0.3 : 0) + (t[0] === "neighbor" ? -0.2 : 0);
      };
      return score(y) - score(x);
    });
    if (!tries.length) {
      state.movesLeft = 0;
      state.turn = "you";
      state.movesLeft = 2;
      state.message = "AI passes. Your turn.";
      render();
      return;
    }
    const t = tries[0];
    applyMove("ai", t[0], t[1], t[2]);
  }

  function patternScore(layout) {
    const v = vals(layout);
    let best = 0;
    for (const pat of PATTERNS) {
      let hits = 0;
      for (const loc of SET_LOCS) {
        const triple = loc.map((p) => v[p]).sort((a, b) => a - b);
        if (pat.some((t) => {
          const s = t.slice().sort((a, b) => a - b);
          return s[0] === triple[0] && s[1] === triple[1] && s[2] === triple[2];
        })) hits++;
      }
      best = Math.max(best, hits);
    }
    return best;
  }

  function renderBoard(el, layout, interactive) {
    el.innerHTML = "";
    // two rows of 6: A-F then G-L
    "ABCDEF".split("").concat("GHIJKL".split("")).forEach((p) => {
      // wait that's wrong order for grid - A-F then G-L is correct for row-major
    });
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].forEach((p) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      const label = document.createElement("span");
      label.className = "pos";
      label.textContent = p + ":" + layout[p].n;
      cell.appendChild(label);
      const img = Cards.imgEl(layout[p], {
        small: true,
        selected: interactive && state.pick.includes(p)
      });
      if (interactive && state.phase === "play" && state.turn === "you") {
        img.onclick = () => {
          if (state.pick.includes(p)) state.pick = state.pick.filter((x) => x !== p);
          else if (state.pick.length < 2) state.pick.push(p);
          if (state.pick.length === 2) tryHumanSwap();
          else render();
        };
      }
      cell.appendChild(img);
      el.appendChild(cell);
    });
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message + " Score You " + state.scoreYou + " – AI " + state.scoreAi + " (hand " + Math.min(state.hands + 1, 4) + "/4)";
    $("chips").innerHTML =
      "<span>Your chips: " + state.youChips + "</span>" +
      "<span>Pool: " + state.pool + "</span>" +
      "<span>AI chips: " + state.aiChips + "</span>" +
      "<span>Moves left: " + (state.turn === "you" ? state.movesLeft : "—") + "</span>";
    $("move-hint").textContent = state.moveType
      ? "Move: " + state.moveType + " — click two cards."
      : "Select Line, Top, or Neighbor first.";
    ["line", "top", "neighbor"].forEach((t) => {
      const b = document.getElementById("m-" + t);
      b.classList.toggle("primary", state.moveType === t);
    });
    renderBoard($("ai-board"), state.ai, false);
    renderBoard($("you-board"), state.you, true);
  }

  document.getElementById("m-line").onclick = () => { state.moveType = "line"; state.pick = []; render(); };
  document.getElementById("m-top").onclick = () => { state.moveType = "top"; state.pick = []; render(); };
  document.getElementById("m-neighbor").onclick = () => { state.moveType = "neighbor"; state.pick = []; render(); };
  document.getElementById("m-clear").onclick = () => { state.pick = []; state.moveType = null; render(); };
  document.getElementById("btn-new").onclick = () => {
    state = { scoreYou: 0, scoreAi: 0, hands: 0 };
    newHand();
  };
  newHand();
})();
