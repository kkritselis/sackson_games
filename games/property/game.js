(function () {
  const SIZE = 8;

  let state;
  let selected = [];
  let pendingBuy = null;

  function $(id) { return document.getElementById(id); }

  function numDeck() {
    // A–10 only, both colors
    return Cards.shuffle(
      Cards.deckWithout((c) => Cards.isPicture(c))
    );
  }

  function newGame() {
    state = {
      grid: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
      // cell: { owner: 'you'|'ai', mort: bool }
      cash: { you: 15 + 9 * 5 + 9 * 10, ai: 15 + 9 * 5 + 9 * 10 }, // $150 each (15W+9R+9B)
      units: { you: 14, ai: 14 },
      stock: numDeck(),
      discard: [],
      you: [],
      ai: [],
      turn: "you",
      over: false,
      message: "Select one red and one black card, then Play (or click a wild target)."
    };
    selected = [];
    pendingBuy = null;
    drawHand("you");
    drawHand("ai");
    render();
  }

  function drawUntilBalanced(who) {
    const hand = who === "you" ? state.you : state.ai;
    const need = () => {
      const red = hand.filter((c) => c.color === "red").length;
      const black = hand.filter((c) => c.color === "black").length;
      return (red === 0 || black === 0) || (red > 0 && black > 0 && false);
    };
    // Hand should be: one color singleton-or-more and the other color at least one,
    // specifically: after play, draw until one of one color and one+ of the other.
    // Start of game: draw until different colors on first two, else continue.
    if (!hand.length) {
      while (true) {
        ensureStock();
        hand.push(state.stock.pop());
        if (hand.length >= 2) {
          const colors = new Set(hand.map((c) => c.color));
          if (colors.size === 2) break;
        }
      }
      return;
    }
    // Refill rule
    while (true) {
      const red = hand.filter((c) => c.color === "red").length;
      const black = hand.filter((c) => c.color === "black").length;
      if (red >= 1 && black >= 1) break;
      ensureStock();
      if (!state.stock.length) break;
      hand.push(state.stock.pop());
    }
  }

  function drawHand(who) {
    const hand = who === "you" ? state.you : state.ai;
    hand.length = 0;
    drawUntilBalanced(who);
  }

  function ensureStock() {
    if (state.stock.length) return;
    if (!state.discard.length) return;
    state.stock = Cards.shuffle(state.discard);
    state.discard = [];
  }

  function cardNum(c) {
    if (c.rank === "A") return 1;
    return parseInt(c.rank, 10);
  }

  function isWild(c) {
    return c.rank === "9" || c.rank === "10";
  }

  function groupSize(r, c, owner) {
    const seen = new Set();
    const q = [[r, c]];
    seen.add(r + "," + c);
    let n = 0;
    while (q.length) {
      const [rr, cc] = q.shift();
      const cell = state.grid[rr][cc];
      if (!cell || cell.owner !== owner) continue;
      n++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const r2 = rr + dr, c2 = cc + dc;
        if (r2 < 0 || c2 < 0 || r2 >= SIZE || c2 >= SIZE) return;
        const key = r2 + "," + c2;
        if (seen.has(key)) return;
        seen.add(key);
        q.push([r2, c2]);
      });
    }
    return n;
  }

  function rentAmount(r, c, redCard, blackCard) {
    const owner = state.grid[r][c].owner;
    const g = groupSize(r, c, owner);
    let mult = 1;
    if (isWild(redCard)) mult *= 2;
    if (isWild(blackCard)) mult *= 2;
    return g * mult;
  }

  function possibleTargets(red, black) {
    const rows = isWild(black) ? [...Array(SIZE).keys()] : [cardNum(black) - 1];
    const cols = isWild(red) ? [...Array(SIZE).keys()] : [cardNum(red) - 1];
    // Convention: red card = column (1–8), black = row (1–8) as in book examples
    const out = [];
    rows.forEach((r) => {
      if (r < 0 || r >= SIZE) return;
      cols.forEach((c) => {
        if (c < 0 || c >= SIZE) return;
        out.push({ r, c });
      });
    });
    // Non-wild must be exact
    if (!isWild(black) && (cardNum(black) < 1 || cardNum(black) > 8)) return [];
    if (!isWild(red) && (cardNum(red) < 1 || cardNum(red) > 8)) return [];
    return out;
  }

  function applyPlay(who, red, black, r, c) {
    const hand = who === "you" ? state.you : state.ai;
    const opp = who === "you" ? "ai" : "you";
    // Remove cards
    [red, black].forEach((card) => {
      const i = hand.indexOf(card);
      if (i >= 0) hand.splice(i, 1);
      state.discard.push(card);
    });

    const cell = state.grid[r][c];
    if (!cell) {
      state.grid[r][c] = { owner: who, mort: false };
      state.message = (who === "you" ? "You" : "AI") + " claims " + (r + 1) + "," + (c + 1) + ".";
      finishTurn(who);
      return;
    }
    if (cell.owner === who) {
      if (!cell.mort) {
        cell.mort = true;
        state.message = (who === "you" ? "You" : "AI") + " mortgages own property.";
        finishTurn(who);
      } else {
        state.grid[r][c] = null;
        state.message = (who === "you" ? "You" : "AI") + " loses double-mortgaged square.";
        finishTurn(who);
      }
      return;
    }
    // Pay rent
    const rent = rentAmount(r, c, red, black);
    if (state.cash[who] < rent) {
      state.cash[opp] += state.cash[who];
      state.cash[who] = 0;
      state.over = true;
      state.message =
        (who === "you" ? "You" : "AI") + " bankrupt on $" + rent + " rent. " +
        (state.cash.you >= state.cash.ai ? "You win!" : "AI wins!");
      render();
      return;
    }
    state.cash[who] -= rent;
    state.cash[opp] += rent;
    state.message = (who === "you" ? "You" : "AI") + " pays $" + rent + " rent.";

    const g = groupSize(r, c, opp);
    if (who === "you" && state.units.you >= g) {
      pendingBuy = { r, c, cost: g, red, black };
      $("btn-buy").disabled = false;
      $("btn-skip-buy").disabled = false;
      state.message += " Buy for " + g + " units?";
      render();
      return;
    }
    // AI may buy
    if (who === "ai" && state.units.ai >= g && state.cash.ai > 40) {
      state.units.ai -= g;
      state.units.you += g;
      state.grid[r][c].owner = "ai";
      state.message += " AI buys the square.";
    }
    finishTurn(who);
  }

  function finishTurn(who) {
    pendingBuy = null;
    $("btn-buy").disabled = true;
    $("btn-skip-buy").disabled = true;
    drawUntilBalanced(who);
    if (state.over) {
      render();
      return;
    }
    state.turn = who === "you" ? "ai" : "you";
    selected = [];
    render();
    if (state.turn === "ai") setTimeout(aiTurn, 500);
  }

  function humanPlay(target) {
    if (state.over || state.turn !== "you" || pendingBuy) return;
    if (selected.length !== 2) {
      state.message = "Select exactly one red and one black card.";
      render();
      return;
    }
    const red = selected.find((c) => c.color === "red");
    const black = selected.find((c) => c.color === "black");
    if (!red || !black) {
      state.message = "Need one red and one black.";
      render();
      return;
    }
    const opts = possibleTargets(red, black);
    if (!opts.length) {
      state.message = "Those cards don’t target the board.";
      render();
      return;
    }
    let choice = target;
    if (!choice) {
      if (opts.length === 1) choice = opts[0];
      else {
        state.message = "Wild play — click a highlighted target square.";
        state.targets = opts;
        render();
        return;
      }
    }
    if (!opts.some((o) => o.r === choice.r && o.c === choice.c)) return;
    state.targets = null;
    applyPlay("you", red, black, choice.r, choice.c);
  }

  function buyPending() {
    if (!pendingBuy) return;
    const { r, c, cost } = pendingBuy;
    if (state.units.you < cost) return;
    state.units.you -= cost;
    state.units.ai += cost;
    state.grid[r][c].owner = "you";
    state.message = "You purchased the square for " + cost + " units.";
    finishTurn("you");
  }

  function skipBuy() {
    if (!pendingBuy) return;
    finishTurn("you");
  }

  function aiTurn() {
    if (state.over || state.turn !== "ai") return;
    const reds = state.ai.filter((c) => c.color === "red");
    const blacks = state.ai.filter((c) => c.color === "black");
    if (!reds.length || !blacks.length) {
      drawUntilBalanced("ai");
      state.turn = "you";
      render();
      return;
    }
    // Prefer empty squares, then cheap rent, avoid huge rent
    let best = null;
    for (const red of reds) {
      for (const black of blacks) {
        const opts = possibleTargets(red, black);
        for (const o of opts) {
          const cell = state.grid[o.r][o.c];
          let score = Math.random();
          if (!cell) score += 5;
          else if (cell.owner === "ai") score += cell.mort ? -2 : 0.5;
          else {
            const rent = rentAmount(o.r, o.c, red, black);
            score -= rent / 10;
            if (rent > state.cash.ai) score -= 20;
          }
          if (!best || score > best.score) best = { red, black, o, score };
        }
      }
    }
    if (!best) {
      state.turn = "you";
      state.message = "AI skips (no play).";
      render();
      return;
    }
    applyPlay("ai", best.red, best.black, best.o.r, best.o.c);
  }

  function toggleCard(c) {
    if (state.turn !== "you" || pendingBuy) return;
    const i = selected.indexOf(c);
    if (i >= 0) selected.splice(i, 1);
    else {
      // Replace same color
      selected = selected.filter((x) => x.color !== c.color);
      selected.push(c);
    }
    state.targets = null;
    render();
  }

  function render() {
    $("status").textContent = state.message;
    $("cash-you").textContent = state.cash.you;
    $("cash-ai").textContent = state.cash.ai;
    $("units-you").textContent = state.units.you;
    $("units-ai").textContent = state.units.ai;

    const grid = $("grid");
    grid.innerHTML = "";
    grid.appendChild(document.createElement("div"));
    for (let c = 1; c <= SIZE; c++) {
      const lab = document.createElement("div");
      lab.className = "label";
      lab.textContent = String(c);
      lab.style.color = "#c62828";
      grid.appendChild(lab);
    }
    for (let r = 0; r < SIZE; r++) {
      const lab = document.createElement("div");
      lab.className = "label";
      lab.textContent = String(r + 1);
      grid.appendChild(lab);
      for (let c = 0; c < SIZE; c++) {
        const d = document.createElement("div");
        const cell = state.grid[r][c];
        d.className = "cell";
        if (cell) {
          d.classList.add(cell.owner);
          d.textContent = cell.owner === "you" ? "Y" : "A";
          if (cell.mort) d.classList.add("mort");
        }
        if (state.targets && state.targets.some((t) => t.r === r && t.c === c)) {
          d.classList.add("target");
          d.onclick = () => humanPlay({ r, c });
        }
        grid.appendChild(d);
      }
    }

    const hand = $("hand");
    hand.innerHTML = "";
    state.you.forEach((c) => {
      const img = Cards.imgEl(c, { selected: selected.includes(c) });
      img.onclick = () => toggleCard(c);
      hand.appendChild(img);
    });

    $("purchase").textContent = pendingBuy
      ? "Purchase units needed: " + pendingBuy.cost
      : "Purchase units: K=4, Q=2, J=1 (abstract count).";
  }

  $("btn-new").onclick = newGame;
  $("btn-play").onclick = () => humanPlay(null);
  $("btn-buy").onclick = buyPending;
  $("btn-skip-buy").onclick = skipBuy;
  newGame();
})();
