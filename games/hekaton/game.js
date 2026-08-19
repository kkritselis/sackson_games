(() => {
  const TARGET = 5000;
  const DIGITS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "K"];
  const VAL = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, K: 0 };
  const SUITS = ["clubs", "spades", "hearts", "diamonds"];
  const SUIT_FILE = { clubs: "Clubs", spades: "Spades", hearts: "Hearts", diamonds: "Diamonds" };
  const CARD_PATH = "../../assets/Cards/";
  const BACK = CARD_PATH + "cardBack_blue4.png";

  const el = {
    status: document.getElementById("status"),
    scoreYou: document.getElementById("score-you"),
    scoreAi: document.getElementById("score-ai"),
    stockN: document.getElementById("stock-n"),
    table: document.getElementById("table"),
    arrange: document.getElementById("arrange"),
    rows: document.getElementById("rows"),
    preview: document.getElementById("preview"),
    aiHand: document.getElementById("ai-hand"),
    youHand: document.getElementById("you-hand"),
    btnNew: document.getElementById("btn-new"),
    btnAddRow: document.getElementById("btn-add-row"),
    btnScore: document.getElementById("btn-score"),
    btnSkip: document.getElementById("btn-skip"),
  };

  let state = null;
  let arrangeRows = []; // array of arrays of card ids
  let poolPick = null;

  function uid() { return Math.random().toString(36).slice(2, 9); }

  function makeDeck() {
    const d = [];
    // five of each digit — use cycling suits for art
    for (const r of DIGITS) {
      for (let i = 0; i < 5; i++) {
        d.push({ rank: r, suit: SUITS[i % 4], id: uid(), digit: VAL[r] });
      }
    }
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
      img.alt = String(card.digit);
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
      table: [],
      scoreYou: 0,
      scoreAi: 0,
      turn: "you",
      over: false,
      arranging: false,
    };
    arrangeRows = [];
    poolPick = null;
    setStatus("Your turn — play a digit card onto the table.");
    hideArrange();
    render();
  }

  function setStatus(m) { el.status.textContent = m; }

  function hideArrange() {
    state.arranging = false;
    el.arrange.classList.add("hidden");
  }

  function showArrange() {
    state.arranging = true;
    arrangeRows = [[]];
    poolPick = null;
    el.arrange.classList.remove("hidden");
    renderArrange();
  }

  function draw(hand) {
    if (state.stock.length) hand.push(state.stock.pop());
  }

  function playCard(who, card) {
    const hand = who === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    hand.splice(i, 1);
    state.table.push(card);
    draw(hand);

    if (who === "you") {
      if (state.table.length >= 2) {
        setStatus("Arrange a multiple of 100 if you can, or skip.");
        showArrange();
        render();
        return;
      }
      endTurn("you");
    } else {
      const scored = aiTryScore();
      if (!scored) endTurn("ai");
    }
    render();
  }

  function endTurn(who) {
    if (state.over) return;
    if (state.scoreYou >= TARGET || state.scoreAi >= TARGET) {
      state.over = true;
      setStatus(
        (state.scoreYou >= TARGET ? "You" : "Computer") +
          " wins! Final " + state.scoreYou + "–" + state.scoreAi + "."
      );
      render();
      return;
    }

    // Hands empty and stock empty — new deal, table discarded
    if (!state.stock.length && !state.you.length && !state.ai.length) {
      state.table = [];
      const stock = shuffle(makeDeck());
      state.stock = stock;
      state.you = stock.splice(0, 6);
      state.ai = stock.splice(0, 6);
      setStatus("New deal (table cleared without score). Running " + state.scoreYou + "–" + state.scoreAi + ".");
    }

    state.turn = who === "you" ? "ai" : "you";
    if (state.turn === "ai") {
      setStatus("Computer turn…");
      render();
      setTimeout(aiTurn, 500);
    } else {
      setStatus("Your turn — play a card.");
      render();
    }
  }

  /** Check if some partition into numbers summing to multiple of 100 exists (brute for small n). */
  function canMakeMultiple(digits) {
    if (!digits.length) return false;
    const n = digits.length;
    if (n > 8) return false; // too big for brute — still allow UI attempt
    // Try all ways to split into ordered numbers via permutations + partitions
    return findBestArrangement(digits) !== null;
  }

  function findBestArrangement(digits) {
    // Returns {total, rows: number[][]} or null
    const n = digits.length;
    if (n === 0 || n > 7) {
      // fallback heuristic for larger
      return heuristicArrange(digits);
    }
    const idxs = digits.map((_, i) => i);
    let best = null;

    const perms = permutations(idxs);
    for (const perm of perms) {
      // partitions of sequence into contiguous groups (each group = a number)
      const parts = partitions(n);
      for (const part of parts) {
        let ok = true;
        const rows = [];
        let at = 0;
        let sum = 0;
        for (const len of part) {
          if (len === 0) { ok = false; break; }
          const slice = perm.slice(at, at + len).map((i) => digits[i]);
          at += len;
          // number from digits; leading zeros ok for multi-digit? K=0 as leading is fine (012=12) — treat as decimal
          let num = 0;
          for (const d of slice) num = num * 10 + d;
          rows.push(slice);
          sum += num;
        }
        if (!ok) continue;
        if (sum > 0 && sum % 100 === 0) {
          if (!best || sum > best.total) best = { total: sum, rows };
        }
      }
    }
    return best;
  }

  function heuristicArrange(digits) {
    // Try classic pattern: units sum to 10, tens to 9 (etc.) as two-digit addends
    const d = digits.slice();
    // Search two-digit rows
    if (d.length % 2 === 0 && d.length >= 2) {
      // try random shuffles
      for (let t = 0; t < 200; t++) {
        const sh = shuffle(d);
        const rows = [];
        let sum = 0;
        for (let i = 0; i < sh.length; i += 2) {
          const num = sh[i] * 10 + sh[i + 1];
          rows.push([sh[i], sh[i + 1]]);
          sum += num;
        }
        if (sum % 100 === 0 && sum > 0) return { total: sum, rows };
      }
    }
    return null;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    if (arr.length > 6) {
      // sample
      const out = [];
      for (let i = 0; i < 120; i++) out.push(shuffle(arr));
      return out;
    }
    const res = [];
    const used = Array(arr.length).fill(false);
    const cur = [];
    function go() {
      if (cur.length === arr.length) {
        res.push(cur.slice());
        return;
      }
      for (let i = 0; i < arr.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        cur.push(arr[i]);
        go();
        cur.pop();
        used[i] = false;
      }
    }
    go();
    return res;
  }

  function partitions(n) {
    // compositions of n
    const res = [];
    function go(remain, cur) {
      if (remain === 0) {
        res.push(cur.slice());
        return;
      }
      for (let i = 1; i <= remain; i++) {
        cur.push(i);
        go(remain - i, cur);
        cur.pop();
      }
    }
    go(n, []);
    return res;
  }

  function aiTryScore() {
    const digits = state.table.map((c) => c.digit);
    const best = findBestArrangement(digits);
    if (!best) return false;
    // Prefer scoring if total >= 100
    if (best.total < 100 && Math.random() < 0.3) return false;
    state.scoreAi += best.total;
    state.table = [];
    setStatus("Computer scores " + best.total + "!");
    hideArrange();
    if (state.scoreAi >= TARGET) {
      state.over = true;
      setStatus("Computer wins! Final " + state.scoreYou + "–" + state.scoreAi + ".");
      render();
      return true;
    }
    endTurn("ai");
    render();
    return true;
  }

  function aiTurn() {
    if (state.over || state.turn !== "ai") return;
    const hand = state.ai;
    // Prefer card that enables a score
    let chosen = null;
    for (const c of hand) {
      const trial = state.table.concat([c]).map((x) => x.digit);
      if (canMakeMultiple(trial)) {
        chosen = c;
        break;
      }
    }
    if (!chosen) chosen = hand[Math.floor(Math.random() * hand.length)];
    playCard("ai", chosen);
  }

  function renderArrange() {
    el.rows.innerHTML = "";
    const used = new Set(arrangeRows.flat());
    const pool = state.table.filter((c) => !used.has(c.id));

    // pool display above rows via table re-render; update preview
    arrangeRows.forEach((row, ri) => {
      const line = document.createElement("div");
      line.className = "row-line";
      line.dataset.row = String(ri);
      row.forEach((id) => {
        const card = state.table.find((c) => c.id === id);
        const slot = document.createElement("div");
        slot.className = "slot";
        slot.textContent = card ? String(card.digit) : "?";
        slot.addEventListener("click", () => {
          // return to pool
          arrangeRows[ri] = arrangeRows[ri].filter((x) => x !== id);
          renderArrange();
          renderTable();
        });
        line.appendChild(slot);
      });
      const addHint = document.createElement("span");
      addHint.style.fontSize = "0.75rem";
      addHint.style.color = "#5a6a7a";
      addHint.textContent = " ← click table digits to fill";
      line.appendChild(addHint);
      line.addEventListener("click", () => {
        state.activeRow = ri;
      });
      el.rows.appendChild(line);
    });

    // clickable leftover digits on table are handled in renderTable
    updatePreview();
  }

  function updatePreview() {
    let sum = 0;
    const parts = [];
    for (const row of arrangeRows) {
      if (!row.length) continue;
      let num = 0;
      for (const id of row) {
        const c = state.table.find((x) => x.id === id);
        num = num * 10 + c.digit;
      }
      parts.push(num);
      sum += num;
    }
    const used = arrangeRows.flat().length;
    const ok = used === state.table.length && sum > 0 && sum % 100 === 0;
    el.preview.textContent =
      parts.join(" + ") + " = " + sum + (ok ? " ✓ multiple of 100" : " (need all cards, total ÷ 100)");
    el.preview.dataset.ok = ok ? "1" : "0";
    el.preview.dataset.total = String(sum);
  }

  function renderTable() {
    el.table.innerHTML = "";
    const used = new Set(arrangeRows.flat());
    state.table.forEach((card) => {
      const div = document.createElement("div");
      div.className = "digit-card" + (poolPick === card.id ? " picked" : "");
      div.textContent = String(card.digit);
      if (state.arranging && !used.has(card.id)) {
        div.addEventListener("click", () => {
          const ri = state.activeRow != null ? state.activeRow : arrangeRows.length - 1;
          if (!arrangeRows[ri]) arrangeRows[ri] = [];
          arrangeRows[ri].push(card.id);
          renderArrange();
          renderTable();
        });
      } else if (used.has(card.id)) {
        div.style.opacity = "0.35";
      }
      el.table.appendChild(div);
    });
  }

  function render() {
    el.scoreYou.textContent = state.scoreYou;
    el.scoreAi.textContent = state.scoreAi;
    el.stockN.textContent = state.stock.length;

    renderTable();

    el.aiHand.innerHTML = "";
    state.ai.forEach(() => el.aiHand.appendChild(cardImg(null, false)));

    el.youHand.innerHTML = "";
    const canPlay = state.turn === "you" && !state.over && !state.arranging;
    state.you.forEach((card) => {
      const img = cardImg(card, true);
      if (!canPlay) img.classList.add("disabled");
      img.addEventListener("click", () => {
        if (!canPlay) return;
        playCard("you", card);
      });
      el.youHand.appendChild(img);
    });

    if (state.arranging) renderArrange();
  }

  el.btnAddRow.addEventListener("click", () => {
    arrangeRows.push([]);
    state.activeRow = arrangeRows.length - 1;
    renderArrange();
  });

  el.btnScore.addEventListener("click", () => {
    updatePreview();
    if (el.preview.dataset.ok !== "1") {
      setStatus("Arrangement must use every table card and total a multiple of 100.");
      return;
    }
    const total = Number(el.preview.dataset.total);
    state.scoreYou += total;
    state.table = [];
    hideArrange();
    setStatus("You score " + total + "!");
    if (state.scoreYou >= TARGET) {
      state.over = true;
      setStatus("You win! Final " + state.scoreYou + "–" + state.scoreAi + ".");
      render();
      return;
    }
    endTurn("you");
    render();
  });

  el.btnSkip.addEventListener("click", () => {
    hideArrange();
    endTurn("you");
    render();
  });

  el.btnNew.addEventListener("click", newGame);
  newGame();
})();
