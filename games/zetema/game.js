(() => {
  const DUP = "hearts";
  const SUITS = ["clubs", "spades", "hearts", "diamonds"];
  const SUIT_FILE = { clubs: "Clubs", spades: "Spades", hearts: "Hearts", diamonds: "Diamonds" };
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SEQ_VAL = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13 };
  const CARD_PATH = "../../assets/Cards/";
  const BACK = CARD_PATH + "cardBack_green2.png";
  const GAME = 300;

  const TRICK_SCORE = { K: 50, Q: 50, J: 20, A: 15, "5": 15 };
  const ASM_SCORE = { K: 100, Q: 100, J: 90, A: 80, "5": 80 };

  const el = {
    status: document.getElementById("status"),
    scoreYou: document.getElementById("score-you"),
    scoreAi: document.getElementById("score-ai"),
    stockN: document.getElementById("stock-n"),
    aiN: document.getElementById("ai-n"),
    piles: document.getElementById("piles"),
    actions: document.getElementById("actions"),
    aiHand: document.getElementById("ai-hand"),
    youHand: document.getElementById("you-hand"),
    btnNew: document.getElementById("btn-new"),
  };

  let state = null;
  let selected = [];

  function uid() { return Math.random().toString(36).slice(2, 9); }

  function makeDeck() {
    const d = [];
    for (const s of SUITS) {
      for (const r of RANKS) d.push({ suit: s, rank: r, id: uid() });
    }
    for (const r of RANKS) d.push({ suit: DUP, rank: r, id: uid() });
    return d;
  }

  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  function cardImg(card, face) {
    const img = document.createElement("img");
    if (face && card) {
      img.src = CARD_PATH + "card" + SUIT_FILE[card.suit] + card.rank + ".png";
      img.alt = card.rank + card.suit[0];
    } else {
      img.src = BACK;
      img.alt = "back";
    }
    return img;
  }

  function newGame() {
    const stock = shuffle(makeDeck());
    state = {
      stock,
      you: stock.splice(0, 6),
      ai: stock.splice(0, 6),
      piles: {}, // rank -> cards[]
      tableRoyals: [], // K/Q on table available for marriage
      scoreYou: 0,
      scoreAi: 0,
      turn: "you",
      over: false,
      marriagesDone: { clubs: 0, spades: 0, hearts: 0, diamonds: 0 },
      kingQueenTricksBlocked: false,
    };
    selected = [];
    setStatus("Your turn — play a card, or declare a combination.");
    render();
  }

  function setStatus(m) { el.status.textContent = m; }

  function trickPts(rank) {
    return TRICK_SCORE[rank] || 5;
  }

  function asmPts(rank) {
    return ASM_SCORE[rank] || 60;
  }

  function drawTo(hand, n) {
    while (hand.length < n && state.stock.length) hand.push(state.stock.pop());
  }

  function addScore(who, pts, why) {
    if (who === "you") state.scoreYou += pts;
    else state.scoreAi += pts;
    if (state.scoreYou >= GAME || state.scoreAi >= GAME) {
      state.over = true;
      setStatus(
        (state.scoreYou >= GAME ? "You" : "Computer") +
          " reaches " + GAME + "! Final " + state.scoreYou + "–" + state.scoreAi + "."
      );
    }
  }

  function playCardToTable(card, who) {
    const hand = who === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return false;
    hand.splice(i, 1);

    if (card.rank === "K" || card.rank === "Q") {
      state.tableRoyals.push(card);
    }

    if (!state.piles[card.rank]) state.piles[card.rank] = [];
    state.piles[card.rank].push(card);

    let scoredTrick = false;
    if (state.piles[card.rank].length >= 5) {
      if ((card.rank === "K" || card.rank === "Q") && state.kingQueenTricksBlocked) {
        // still clear? Rules: once marriage declared, K/Q trick impossible — don't score, but cards stay?
        // Simplify: remove without scoring if blocked
        state.piles[card.rank] = [];
      } else {
        const pts = trickPts(card.rank);
        addScore(who, pts, "trick");
        setStatus((who === "you" ? "You" : "AI") + " completes a " + card.rank + " trick (+" + pts + ").");
        state.piles[card.rank] = [];
        // remove matching royals from tableRoyals
        state.tableRoyals = state.tableRoyals.filter((c) => c.rank !== card.rank);
        scoredTrick = true;
      }
    }

    drawTo(hand, 6);

    // Two-player special: after deck exhausted, completing trick requires another play
    if (!state.stock.length && scoredTrick && hand.length && who === state.turn) {
      state.mustPlayAgain = who;
    } else {
      state.mustPlayAgain = null;
    }
    return true;
  }

  function isFlush(hand) {
    if (hand.length < 6) return false;
    const suits = hand.map((c) => c.suit);
    const s0 = suits[0];
    if (s0 === DUP) return false;
    return suits.every((s) => s === s0);
  }

  function isSequence(hand) {
    if (hand.length < 6) return false;
    const vals = hand.map((c) => SEQ_VAL[c.rank]).sort((a, b) => a - b);
    // high A sequence: A,K,Q,J,10,9
    const highA = [1, 9, 10, 11, 12, 13];
    const lowA = [1, 2, 3, 4, 5, 6];
    const check = (target) => {
      const t = target.slice().sort((a, b) => a - b);
      return t.every((v, i) => v === vals[i]);
    };
    if (check(highA) || check(lowA)) return true;
    // normal consecutive
    for (let i = 1; i < vals.length; i++) if (vals[i] !== vals[i - 1] + 1) return false;
    return true;
  }

  function declareFlushSeq(who) {
    const hand = who === "you" ? state.you : state.ai;
    let pts = 0;
    const flush = isFlush(hand);
    const seq = isSequence(hand);
    if (!flush && !seq) return false;
    if (flush && seq) pts = 50;
    else if (flush) pts = 30;
    else pts = 20; // Sackson's improved sequence value
    addScore(who, pts);
    setStatus((who === "you" ? "You" : "AI") + " declares " + (flush && seq ? "flush+sequence" : flush ? "flush" : "sequence") + " (+" + pts + "). Now play one card.");
    state.pendingPlay = who;
    return true;
  }

  function marriageScore(marriages) {
    // marriages: array of {suit}
    const n = marriages.length;
    const suits = marriages.map((m) => m.suit);
    const heartCount = suits.filter((s) => s === DUP).length;
    const imperial = heartCount >= 2 || (heartCount === 1 && state.marriagesDone[DUP] >= 1);
    // Use simplified table
    if (n === 1) return imperial ? 20 : 10;
    if (n === 2) {
      if (heartCount === 2) return 50;
      if (imperial) return 40;
      return 30;
    }
    if (n === 3) {
      if (heartCount >= 2) return 80;
      if (imperial) return 70;
      return 60;
    }
    if (n === 4) {
      if (heartCount >= 2) return 120;
      if (imperial) return 110;
      return 100;
    }
    if (n >= 5) return 150;
    return 10;
  }

  function tryMarriages(who, fromHandIds) {
    const hand = who === "you" ? state.you : state.ai;
    const chosen = hand.filter((c) => fromHandIds.includes(c.id));
    // Build marriages from hand K/Q plus table
    const ks = chosen.filter((c) => c.rank === "K");
    const qs = chosen.filter((c) => c.rank === "Q");
    const marriages = [];
    const usedTable = [];
    const usedHand = new Set();

    for (const k of ks) {
      let q = qs.find((x) => x.suit === k.suit && !usedHand.has(x.id));
      if (q) {
        marriages.push({ suit: k.suit });
        usedHand.add(k.id);
        usedHand.add(q.id);
        continue;
      }
      const tq = state.tableRoyals.find((c) => c.rank === "Q" && c.suit === k.suit && !usedTable.includes(c.id));
      if (tq) {
        marriages.push({ suit: k.suit });
        usedHand.add(k.id);
        usedTable.push(tq.id);
      }
    }
    for (const q of qs) {
      if (usedHand.has(q.id)) continue;
      const tk = state.tableRoyals.find((c) => c.rank === "K" && c.suit === q.suit && !usedTable.includes(c.id));
      if (tk) {
        marriages.push({ suit: q.suit });
        usedHand.add(q.id);
        usedTable.push(tk.id);
      }
    }

    if (!marriages.length) return false;

    const pts = marriageScore(marriages);
    addScore(who, pts);
    state.kingQueenTricksBlocked = true;

    // Remove used cards
    for (const id of usedHand) {
      const i = hand.findIndex((c) => c.id === id);
      if (i >= 0) hand.splice(i, 1);
    }
    state.tableRoyals = state.tableRoyals.filter((c) => !usedTable.includes(c.id));
    // Also remove from piles
    for (const rank of ["K", "Q"]) {
      if (state.piles[rank]) {
        state.piles[rank] = state.piles[rank].filter((c) => !usedTable.includes(c.id));
      }
    }
    for (const m of marriages) state.marriagesDone[m.suit] = (state.marriagesDone[m.suit] || 0) + 1;

    drawTo(hand, 6);
    setStatus((who === "you" ? "You" : "AI") + " scores marriage(s) for " + pts + ".");
    return true;
  }

  function tryAssembly(who) {
    const hand = who === "you" ? state.you : state.ai;
    const byRank = {};
    for (const c of hand) {
      byRank[c.rank] = byRank[c.rank] || [];
      byRank[c.rank].push(c);
    }
    for (const [rank, cards] of Object.entries(byRank)) {
      if (cards.length >= 5) {
        const pts = asmPts(rank);
        addScore(who, pts);
        const take = cards.slice(0, 5);
        for (const t of take) {
          const i = hand.findIndex((c) => c.id === t.id);
          if (i >= 0) hand.splice(i, 1);
        }
        drawTo(hand, 6);
        setStatus((who === "you" ? "You" : "AI") + " assembly of " + rank + "s (+" + pts + ").");
        return true;
      }
    }
    return false;
  }

  function endTurn(who) {
    if (state.over) {
      render();
      return;
    }
    if (state.mustPlayAgain === who) {
      state.mustPlayAgain = null;
      setStatus("Trick made with empty stock — play another card.");
      render();
      return;
    }
    // Skip if opponent has no cards
    const other = who === "you" ? "ai" : "you";
    const otherHand = other === "you" ? state.you : state.ai;
    if (!otherHand.length && !state.stock.length) {
      // continue until both empty
      if (!(who === "you" ? state.you : state.ai).length) {
        setStatus("Hand complete. Scores " + state.scoreYou + "–" + state.scoreAi + ".");
        if (state.scoreYou < GAME && state.scoreAi < GAME) {
          // redeal keeping scores
          const stock = shuffle(makeDeck());
          state.stock = stock;
          state.you = stock.splice(0, 6);
          state.ai = stock.splice(0, 6);
          state.piles = {};
          state.tableRoyals = [];
          state.marriagesDone = { clubs: 0, spades: 0, hearts: 0, diamonds: 0 };
          state.kingQueenTricksBlocked = false;
          state.turn = "you";
          setStatus("New hand. Your turn. Running score " + state.scoreYou + "–" + state.scoreAi + ".");
          render();
          return;
        }
      }
    }

    state.turn = other;
    selected = [];
    state.pendingPlay = null;
    if (state.turn === "ai") {
      if (!state.ai.length && !state.stock.length) {
        state.turn = "you";
        render();
        return;
      }
      setStatus("Computer turn…");
      render();
      setTimeout(aiTurn, 500);
    } else {
      if (!state.you.length && !state.stock.length) {
        endTurn("you");
        return;
      }
      setStatus("Your turn.");
      render();
    }
  }

  function aiTurn() {
    if (state.over || state.turn !== "ai") return;
    if (tryAssembly("ai")) {
      endTurn("ai");
      render();
      return;
    }
    // marriages if K+Q in hand
    const hand = state.ai;
    const ids = [];
    for (const s of SUITS) {
      const k = hand.find((c) => c.rank === "K" && c.suit === s);
      const q = hand.find((c) => c.rank === "Q" && c.suit === s);
      if (k && q) {
        ids.push(k.id, q.id);
        break;
      }
      if (k && state.tableRoyals.some((c) => c.rank === "Q" && c.suit === s)) ids.push(k.id);
      if (q && state.tableRoyals.some((c) => c.rank === "K" && c.suit === s)) ids.push(q.id);
    }
    if (ids.length && tryMarriages("ai", ids)) {
      endTurn("ai");
      render();
      return;
    }
    if ((isFlush(hand) || isSequence(hand)) && Math.random() < 0.7) {
      declareFlushSeq("ai");
      // must play a card
      const card = pickAiPlay();
      playCardToTable(card, "ai");
      endTurn("ai");
      render();
      return;
    }
    const card = pickAiPlay();
    playCardToTable(card, "ai");
    endTurn("ai");
    render();
  }

  function pickAiPlay() {
    const hand = state.ai.slice();
    // Prefer completing tricks
    hand.sort((a, b) => {
      const pa = (state.piles[a.rank] || []).length;
      const pb = (state.piles[b.rank] || []).length;
      return pb - pa;
    });
    return hand[0];
  }

  function renderActions() {
    el.actions.innerHTML = "";
    if (state.over || state.turn !== "you") return;

    const b = (label, fn, ghost) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (ghost) btn.className = "ghost";
      btn.addEventListener("click", fn);
      el.actions.appendChild(btn);
    };

    if (state.pendingPlay === "you") {
      setStatus("Play one card to finish your declaration.");
      return;
    }

    b("Play selected card", () => {
      if (selected.length !== 1) {
        setStatus("Select exactly one card to play.");
        return;
      }
      const card = state.you.find((c) => c.id === selected[0]);
      if (!card) return;
      playCardToTable(card, "you");
      selected = [];
      endTurn("you");
      render();
    });

    b("Declare flush / sequence", () => {
      if (!declareFlushSeq("you")) {
        setStatus("No flush or sequence in hand.");
        return;
      }
      render();
    }, true);

    b("Declare marriage(s) from selection", () => {
      if (!tryMarriages("you", selected)) {
        setStatus("Select K/Q cards that form marriage(s).");
        return;
      }
      selected = [];
      endTurn("you");
      render();
    }, true);

    b("Declare assembly", () => {
      if (!tryAssembly("you")) {
        setStatus("Need five of a rank.");
        return;
      }
      endTurn("you");
      render();
    }, true);
  }

  function render() {
    el.scoreYou.textContent = state.scoreYou;
    el.scoreAi.textContent = state.scoreAi;
    el.stockN.textContent = state.stock.length;
    el.aiN.textContent = state.ai.length;

    el.piles.innerHTML = "";
    const ranks = Object.keys(state.piles).filter((r) => state.piles[r].length);
    ranks.sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));
    for (const r of ranks) {
      const pile = state.piles[r];
      const div = document.createElement("div");
      div.className = "pile";
      const top = pile[pile.length - 1];
      div.appendChild(cardImg(top, true));
      const count = document.createElement("div");
      count.className = "count";
      count.textContent = r + " × " + pile.length;
      div.appendChild(count);
      el.piles.appendChild(div);
    }
    if (!ranks.length) {
      el.piles.innerHTML = '<span style="color:#6a7a92;font-size:0.9rem">No cards on the table yet.</span>';
    }

    el.aiHand.innerHTML = "";
    state.ai.forEach(() => el.aiHand.appendChild(cardImg(null, false)));

    el.youHand.innerHTML = "";
    const canSelect = state.turn === "you" && !state.over;
    state.you.forEach((card) => {
      const img = cardImg(card, true);
      if (!canSelect) img.classList.add("disabled");
      if (selected.includes(card.id)) img.classList.add("selected");
      img.addEventListener("click", () => {
        if (!canSelect) return;
        if (state.pendingPlay === "you") {
          playCardToTable(card, "you");
          state.pendingPlay = null;
          endTurn("you");
          render();
          return;
        }
        if (selected.includes(card.id)) selected = selected.filter((id) => id !== card.id);
        else selected.push(card.id);
        render();
      });
      el.youHand.appendChild(img);
    });

    renderActions();
  }

  el.btnNew.addEventListener("click", newGame);
  newGame();
})();
