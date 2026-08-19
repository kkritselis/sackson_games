(() => {
  const SUITS = ["Clubs", "Diamonds", "Hearts", "Spades"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const ASSET = "../../assets/Cards/";

  const statusEl = document.getElementById("status");
  const tableEl = document.getElementById("table");
  const handEl = document.getElementById("hand");
  const youPaksEl = document.getElementById("you-paks");
  const aiPaksEl = document.getElementById("ai-paks");

  let stock, table, you, ai, phase, selected, keptThisTurn, madePak, usedSuits, totals;

  function cardId(suit, rank) { return { suit, rank, id: suit + rank + Math.random().toString(36).slice(2, 6) }; }

  function imgPath(c) {
    return `${ASSET}card${c.suit}${c.rank}.png`;
  }

  function baseValue(c) {
    if (c.rank === "A") return 20;
    if ("KQJ".includes(c.rank)) return 10;
    return parseInt(c.rank, 10);
  }

  function handComboValue(cards) {
    // Try best combination value for same-suit cards from hand
    if (!cards.length) return 0;
    const suit = cards[0].suit;
    if (!cards.every((c) => c.suit === suit)) return 0;
    // special low combos
    const ranks = cards.map((c) => c.rank);
    const lows = cards.filter((c) => ["2", "3", "4", "5"].includes(c.rank));
    let best = cards.reduce((s, c) => s + baseValue(c), 0);
    // pair/combo of two low cards
    if (cards.length === 2) {
      const [a, b] = cards.map(baseValue).sort((x, y) => y - x);
      if (a <= 5 && b <= 5) {
        const combo = a * 10 + b;
        if ([55, 54, 53, 52, 44, 43, 42, 33, 32, 22].includes(combo) || [55, 54, 53, 52, 44, 43, 42, 33, 32, 22].includes(b * 10 + a)) {
          best = Math.max(a, b) * 10 + Math.min(a, b);
        }
      }
    }
    // multi-card: allow splitting into combo pairs + singles for stealing value
    // Simplified: sum of best pairing of low cards + base for rest
    const vals = cards.map(baseValue);
    const lowVals = vals.filter((v) => v <= 5).sort((a, b) => b - a);
    const high = vals.filter((v) => v > 5);
    let comboSum = high.reduce((s, v) => s + v, 0);
    const pool = lowVals.slice();
    while (pool.length >= 2) {
      const x = pool.shift();
      const y = pool.shift();
      comboSum += x * 10 + y;
    }
    if (pool.length) comboSum += pool[0];
    return Math.max(best, comboSum);
  }

  function pakFaceValue(cards) {
    // after on table / in pak: basic counting for pak strength when stealing
    return cards.reduce((s, c) => s + baseValue(c), 0);
  }

  function scoreValue(c) {
    if (c.rank === "A") return 20;
    if (["K", "Q", "J", "10", "9", "8"].includes(c.rank)) return 10;
    return 5;
  }

  function deck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(cardId(s, r));
    for (let i = d.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function fullTable() {
    const suits = new Set(table.map((c) => c.suit));
    return SUITS.every((s) => suits.has(s));
  }

  function renderCard(c, onClick, selectedSet) {
    const img = document.createElement("img");
    img.className = "card" + (selectedSet && selectedSet.has(c.id) ? " selected" : "");
    img.src = imgPath(c);
    img.alt = `${c.rank} of ${c.suit}`;
    if (onClick) img.addEventListener("click", () => onClick(c));
    return img;
  }

  function renderPaks(el, paks) {
    el.innerHTML = "";
    paks.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "pak";
      row.innerHTML = `<span class="val">${p.suit} · ${pakFaceValue(p.cards)}</span>`;
      p.cards.forEach((c) => row.appendChild(renderCard(c)));
      el.appendChild(row);
    });
  }

  function render() {
    tableEl.innerHTML = "";
    table.forEach((c) => tableEl.appendChild(renderCard(c)));
    handEl.innerHTML = "";
    you.hand.forEach((c) =>
      handEl.appendChild(
        renderCard(c, (card) => {
          if (phase !== "pak" && phase !== "steal") return;
          if (selected.has(card.id)) selected.delete(card.id);
          else selected.add(card.id);
          render();
        }, selected)
      )
    );
    renderPaks(youPaksEl, you.paks);
    renderPaks(aiPaksEl, ai.paks);
    document.getElementById("you-total").textContent = totals.you;
    document.getElementById("ai-total").textContent = totals.ai;

    const pakUi = document.getElementById("pak-ui");
    const takeIdx = document.getElementById("take-idx");
    takeIdx.innerHTML = "";
    table.forEach((c, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${c.rank} ${c.suit} (${baseValue(c)})`;
      takeIdx.appendChild(opt);
    });
    pakUi.hidden = !(phase === "pak" || phase === "steal");
    document.getElementById("skip-steal").hidden = phase !== "steal";
    document.getElementById("draw").disabled = phase !== "draw" || !stock.length;
  }

  function endHandScoring() {
    const throwOff = (paksA, paksB) => {
      const result = [];
      for (const suit of SUITS) {
        const a = paksA.filter((p) => p.suit === suit);
        const b = paksB.filter((p) => p.suit === suit);
        const min = Math.min(a.length, b.length);
        // throw off lowest value paks
        const sortVal = (p) => p.cards.reduce((s, c) => s + scoreValue(c), 0);
        a.sort((x, y) => sortVal(x) - sortVal(y));
        b.sort((x, y) => sortVal(x) - sortVal(y));
        result.push(...a.slice(min));
      }
      return result;
    };
    const yKeep = throwOff(you.paks, ai.paks);
    const aKeep = throwOff(ai.paks, you.paks);
    const yScore = yKeep.reduce((s, p) => s + p.cards.reduce((t, c) => t + scoreValue(c), 0), 0);
    const aScore = aKeep.reduce((s, p) => s + p.cards.reduce((t, c) => t + scoreValue(c), 0), 0);
    totals.you += yScore;
    totals.ai += aScore;
    statusEl.textContent = `Hand over. You +${yScore}, AI +${aScore}. Totals ${totals.you}–${totals.ai}.`;
    phase = "over";
    if (totals.you >= 500 || totals.ai >= 500) {
      statusEl.textContent +=
        totals.you >= 500 && totals.you > totals.ai
          ? " You win the match!"
          : totals.ai >= 500 && totals.ai > totals.you
            ? " AI wins the match!"
            : " Tie — play another hand.";
    }
    render();
  }

  function tryMakePak(player, handCards, tableIndex) {
    if (tableIndex < 0 || tableIndex >= table.length) return false;
    const target = table[tableIndex];
    if (!handCards.length || !handCards.every((c) => c.suit === target.suit)) return false;
    const hv = handComboValue(handCards);
    if (hv <= baseValue(target)) return false;
    // remove from hand
    for (const c of handCards) {
      const i = player.hand.findIndex((h) => h.id === c.id);
      if (i < 0) return false;
      player.hand.splice(i, 1);
    }
    table.splice(tableIndex, 1);
    const pakCards = handCards.concat([target]);
    player.paks.push({ suit: target.suit, cards: pakCards });
    return true;
  }

  function trySteal(player, victim, handCards, pakIndex) {
    const pak = victim.paks[pakIndex];
    if (!pak) return false;
    if (!handCards.length || !handCards.every((c) => c.suit === pak.suit)) return false;
    if (usedSuits.has(pak.suit)) return false;
    const hv = handComboValue(handCards);
    if (hv <= pakFaceValue(pak.cards)) return false;
    for (const c of handCards) {
      const i = player.hand.findIndex((h) => h.id === c.id);
      if (i < 0) return false;
      player.hand.splice(i, 1);
    }
    victim.paks.splice(pakIndex, 1);
    player.paks.push({ suit: pak.suit, cards: handCards.concat(pak.cards) });
    usedSuits.add(pak.suit);
    return true;
  }

  function aiTurn() {
    if (!stock.length) {
      endHandScoring();
      return;
    }
    const drawn = stock.pop();
    if (fullTable()) {
      ai.hand.push(drawn);
      // must make pak if possible
      let made = false;
      for (let ti = 0; ti < table.length; ti++) {
        const t = table[ti];
        const suited = ai.hand.filter((c) => c.suit === t.suit);
        for (let mask = 1; mask < 1 << Math.min(suited.length, 4); mask++) {
          const pick = suited.filter((_, i) => mask & (1 << i));
          if (handComboValue(pick) > baseValue(t)) {
            if (tryMakePak(ai, pick, ti)) {
              made = true;
              break;
            }
          }
        }
        if (made) break;
      }
      statusEl.textContent = made ? "AI made a Pak from a full table." : "AI could not Pak on full table.";
    } else if (table.some((c) => c.suit === drawn.suit)) {
      ai.hand.push(drawn);
      // opportunistic pak
      for (let ti = 0; ti < table.length; ti++) {
        const t = table[ti];
        const suited = ai.hand.filter((c) => c.suit === t.suit);
        const pick = suited.filter((c) => baseValue(c) <= 10).slice(0, 3);
        if (pick.length && handComboValue(pick) > baseValue(t)) {
          tryMakePak(ai, pick, ti);
          // steal once if possible
          for (let pi = 0; pi < you.paks.length; pi++) {
            const pak = you.paks[pi];
            if (pak.suit === t.suit) continue;
            const hs = ai.hand.filter((c) => c.suit === pak.suit);
            if (hs.length && handComboValue(hs.slice(0, 2)) > pakFaceValue(pak.cards)) {
              trySteal(ai, you, hs.slice(0, 2), pi);
              break;
            }
          }
          break;
        }
      }
      statusEl.textContent = "AI kept a matching draw.";
    } else {
      table.push(drawn);
      statusEl.textContent = "AI fed the table.";
    }
    phase = "draw";
    selected = new Set();
    keptThisTurn = false;
    madePak = false;
    usedSuits = new Set();
    render();
    if (!stock.length) endHandScoring();
  }

  document.getElementById("draw").addEventListener("click", () => {
    if (phase !== "draw" || !stock.length) return;
    const drawn = stock.pop();
    selected = new Set();
    usedSuits = new Set();
    if (fullTable()) {
      you.hand.push(drawn);
      keptThisTurn = true;
      phase = "pak";
      statusEl.textContent = "Full table — you must make a Pak (or pass if impossible).";
      document.getElementById("pak-ui").hidden = false;
      // allow skip if impossible via Done
      document.getElementById("skip-steal").hidden = false;
      document.getElementById("skip-steal").textContent = "Cannot Pak — pass";
      render();
      return;
    }
    if (table.some((c) => c.suit === drawn.suit)) {
      you.hand.push(drawn);
      keptThisTurn = true;
      phase = "pak";
      statusEl.textContent = "Kept draw. Optionally make a Pak, then steal.";
      document.getElementById("skip-steal").hidden = false;
      document.getElementById("skip-steal").textContent = "Skip Pak / steals";
      render();
      return;
    }
    table.push(drawn);
    statusEl.textContent = "Fed the table — turn ends.";
    phase = "ai";
    render();
    setTimeout(aiTurn, 500);
  });

  document.getElementById("make-pak").addEventListener("click", () => {
    if (phase !== "pak" && phase !== "steal") return;
    const cards = you.hand.filter((c) => selected.has(c.id));
    const ti = +document.getElementById("take-idx").value;
    if (phase === "pak") {
      if (!tryMakePak(you, cards, ti)) {
        statusEl.textContent = "Illegal Pak — same suit and greater value required.";
        return;
      }
      madePak = true;
      usedSuits.add(table.length ? you.paks[you.paks.length - 1].suit : cards[0].suit);
      // fix: suit from last pak
      usedSuits = new Set([you.paks[you.paks.length - 1].suit]);
      phase = "steal";
      selected = new Set();
      statusEl.textContent = "Pak made. Steal from AI with other suits, or Done.";
      document.getElementById("skip-steal").hidden = false;
      document.getElementById("skip-steal").textContent = "Done";
      render();
      return;
    }
    // steal: use selected cards against first AI pak of that suit with enough value
    if (!cards.length) return;
    const suit = cards[0].suit;
    const pi = ai.paks.findIndex((p) => p.suit === suit);
    if (pi < 0 || !trySteal(you, ai, cards, pi)) {
      statusEl.textContent = "Cannot steal with that selection.";
      return;
    }
    selected = new Set();
    statusEl.textContent = "Stole a Pak! Steal another suit or Done.";
    render();
  });

  document.getElementById("skip-steal").addEventListener("click", () => {
    if (phase === "pak" && fullTable() && !madePak) {
      // verify impossible — allow pass
      phase = "ai";
      statusEl.textContent = "Passed on full table.";
      render();
      setTimeout(aiTurn, 400);
      return;
    }
    if (phase === "pak" && !madePak) {
      phase = "ai";
      render();
      setTimeout(aiTurn, 400);
      return;
    }
    phase = "ai";
    statusEl.textContent = "AI's turn…";
    render();
    setTimeout(aiTurn, 400);
  });

  function newHand() {
    stock = deck();
    you = { hand: [], paks: [] };
    ai = { hand: [], paks: [] };
    table = [];
    for (let i = 0; i < 5; i++) {
      you.hand.push(stock.pop());
      ai.hand.push(stock.pop());
    }
    for (let i = 0; i < 3; i++) table.push(stock.pop());
    phase = "draw";
    selected = new Set();
    keptThisTurn = false;
    madePak = false;
    usedSuits = new Set();
    statusEl.textContent = "Your turn — draw from stock.";
    render();
  }

  if (!window.__paksTotals) window.__paksTotals = { you: 0, ai: 0 };
  totals = window.__paksTotals;

  document.getElementById("new-game").addEventListener("click", newHand);
  newHand();
})();
