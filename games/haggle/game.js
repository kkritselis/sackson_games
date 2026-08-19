(() => {
  const COLORS = ["yellow", "blue", "red", "orange", "white"];
  const BASIC = { yellow: 1, blue: 2, red: 3, orange: 4, white: 5 };
  const BOT_NAMES = ["Mara", "Jules", "Owen", "Priya"];
  const ROUND_SECS = 180;

  const RULES = [
    { id: 1, text: "Orange cards have a basic value of 4 and equal a red plus a yellow." },
    { id: 2, text: "White cards have the highest basic value and equal a red plus a blue." },
    { id: 3, text: "Blue cards are worth twice yellow and half of orange." },
    { id: 4, text: "If a player has more than three white cards, all of their white cards lose value." },
    { id: 5, text: "A player can score only as many orange cards as they have blue cards." },
    { id: 6, text: "If a player has five or more blue cards, 10 points are deducted from every other player's score." },
    { id: 7, text: "A set of three red cards protects you from one set of five blue cards." },
    { id: 8, text: "Most yellow cards earns a bonus of (that count)². Ties are eliminated; bonus goes to next." },
    { id: 9, text: "Seven or more cards of the same color eliminates that player." },
    { id: 10, text: "Each set of five different colors gives a bonus of 10 points." },
    { id: 11, text: "A pyramid alone (4+3+2+1 of four colors) doubles the hand value." },
    { id: 12, text: "Most red cards doubles their value. Ties: nobody gets the bonus." },
    { id: 13, text: "Each set of two yellow cards doubles the value of one white card." },
    { id: 14, text: "Each set of three blue cards quadruples the value of one orange card." },
    { id: 15, text: "No more than thirteen cards in a hand can be scored; excess removed at random." }
  ];

  const state = {
    players: [], // {id,name,isYou,cards,slips,known}
    selected: new Set(),
    tradeTarget: null,
    timer: ROUND_SECS,
    tick: null,
    ended: false
  };

  const el = {
    timer: document.getElementById("timer"),
    knownCount: document.getElementById("known-count"),
    yourCards: document.getElementById("your-cards"),
    yourInfo: document.getElementById("your-info"),
    knownRules: document.getElementById("known-rules"),
    traders: document.getElementById("traders"),
    tradeBox: document.getElementById("trade-box"),
    tradeName: document.getElementById("trade-name"),
    tradeSummary: document.getElementById("trade-summary"),
    tradeResult: document.getElementById("trade-result"),
    results: document.getElementById("results"),
    scoreboard: document.getElementById("scoreboard"),
    rulesReveal: document.getElementById("rules-reveal"),
    btnSubmit: document.getElementById("btn-submit"),
    btnNew: document.getElementById("btn-new"),
    btnPropose: document.getElementById("btn-propose"),
    btnCancel: document.getElementById("btn-cancel-trade"),
    offerCards: document.getElementById("offer-cards"),
    offerInfo: document.getElementById("offer-info"),
    askCards: document.getElementById("ask-cards"),
    askInfo: document.getElementById("ask-info")
  };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function countColors(cards) {
    const c = { yellow: 0, blue: 0, red: 0, orange: 0, white: 0 };
    cards.forEach((x) => { c[x]++; });
    return c;
  }

  function isPyramid(counts) {
    const vals = Object.values(counts).filter((n) => n > 0).sort((a, b) => b - a);
    return vals.length === 4 && vals[0] === 4 && vals[1] === 3 && vals[2] === 2 && vals[3] === 1;
  }

  function scoreAll(playersHands) {
    // playersHands: array of {cards, name}
    const trimmed = playersHands.map((p) => {
      let h = p.cards.slice();
      if (h.length > 13) {
        h = shuffle(h.slice()).slice(0, 13);
      }
      return { ...p, hand: h, counts: countColors(h) };
    });

    // eliminations
    trimmed.forEach((p) => {
      p.eliminated = Object.values(p.counts).some((n) => n >= 7);
    });

    // most yellow bonus (rule 8)
    let yList = trimmed.map((p) => (p.eliminated ? -1 : p.counts.yellow));
    let maxY = Math.max(...yList);
    let yIdx = yList.map((n, i) => (n === maxY && maxY > 0 ? i : -1)).filter((i) => i >= 0);
    if (yIdx.length !== 1) {
      // ties eliminated from bonus — try next
      if (yIdx.length > 1) {
        const blocked = new Set(yIdx);
        yList = yList.map((n, i) => (blocked.has(i) ? -1 : n));
        maxY = Math.max(...yList);
        yIdx = yList.map((n, i) => (n === maxY && maxY > 0 ? i : -1)).filter((i) => i >= 0);
      }
      if (yIdx.length !== 1) {
        maxY = 0;
        yIdx = [];
      }
    }

    // most red (rule 12)
    const rList = trimmed.map((p) => (p.eliminated ? -1 : p.counts.red));
    const maxR = Math.max(...rList);
    let rIdx = rList.map((n, i) => (n === maxR && maxR > 0 ? i : -1)).filter((i) => i >= 0);
    if (rIdx.length !== 1) rIdx = [];

    // blue penalties (rule 6/7)
    const bluePunishers = trimmed.filter((p) => !p.eliminated && p.counts.blue >= 5).length;

    return trimmed.map((p, idx) => {
      if (p.eliminated) return { name: p.name, total: 0, detail: "Eliminated", isYou: p.isYou };

      const c = p.counts;
      let yellowPts = c.yellow * BASIC.yellow;
      let bluePts = c.blue * BASIC.blue;
      let redPts = c.red * BASIC.red;
      if (rIdx.includes(idx)) redPts *= 2;

      // orange: limited by blue (5); some quadrupled by sets of 3 blue (14)
      const orangeScorable = Math.min(c.orange, c.blue);
      const quadSlots = Math.floor(c.blue / 3);
      let orangePts = 0;
      for (let i = 0; i < orangeScorable; i++) {
        orangePts += i < quadSlots ? BASIC.orange * 4 : BASIC.orange;
      }

      // white: void if >3 (4); doubled by yellow pairs (13)
      let whitePts = 0;
      if (c.white <= 3) {
        const doubleSlots = Math.floor(c.yellow / 2);
        for (let i = 0; i < c.white; i++) {
          whitePts += i < doubleSlots ? BASIC.white * 2 : BASIC.white;
        }
      }

      let sub = yellowPts + bluePts + redPts + orangePts + whitePts;

      // five-color sets (10)
      const rainbow = Math.min(c.yellow, c.blue, c.red, c.orange, c.white);
      sub += rainbow * 10;

      // yellow majority bonus (8)
      if (yIdx.includes(idx) && maxY > 0) sub += maxY * maxY;

      // pyramid doubles if ONLY pyramid cards (11)
      const onlyPyramid = isPyramid(c) && p.hand.length === 10;
      if (onlyPyramid) sub *= 2;

      // blue deductions from others
      let protect = Math.floor(c.red / 3);
      let deductions = 0;
      let remainingPunish = bluePunishers;
      // each punisher applies -10 unless protected; protect blocks one set
      while (remainingPunish > 0) {
        if (protect > 0) {
          protect--;
        } else {
          deductions += 10;
        }
        remainingPunish--;
      }
      // Own five blues don't deduct from self — punishers are other players with 5+ blue
      const othersPunish = trimmed.filter((o, j) => j !== idx && !o.eliminated && o.counts.blue >= 5).length;
      protect = Math.floor(c.red / 3);
      deductions = 0;
      for (let i = 0; i < othersPunish; i++) {
        if (protect > 0) protect--;
        else deductions += 10;
      }

      const total = sub - deductions;
      return {
        name: p.name,
        total,
        detail: `Base-ish ${sub} − ${deductions} blue tax`,
        isYou: p.isYou,
        hand: p.hand
      };
    });
  }

  function you() {
    return state.players.find((p) => p.isYou);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function renderCards() {
    const p = you();
    el.yourCards.innerHTML = "";
    p.cards.forEach((color, idx) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = `card ${color}` + (state.selected.has(idx) ? " selected" : "");
      c.textContent = color[0].toUpperCase();
      c.title = color;
      c.addEventListener("click", () => {
        if (state.ended) return;
        if (state.selected.has(idx)) state.selected.delete(idx);
        else state.selected.add(idx);
        renderCards();
      });
      el.yourCards.appendChild(c);
    });
  }

  function renderInfo() {
    const p = you();
    el.yourInfo.innerHTML = "";
    p.slips.forEach((id) => {
      const li = document.createElement("li");
      const rule = RULES.find((r) => r.id === id);
      li.innerHTML = `<strong>#${id}</strong> — ${rule.text}`;
      el.yourInfo.appendChild(li);
    });

    el.knownRules.innerHTML = "";
    [...p.known].sort((a, b) => a - b).forEach((id) => {
      const li = document.createElement("li");
      const rule = RULES.find((r) => r.id === id);
      li.innerHTML = `<strong>#${id}</strong> — ${rule.text}`;
      el.knownRules.appendChild(li);
    });
    el.knownCount.textContent = p.known.size;
  }

  function renderTraders() {
    el.traders.innerHTML = "";
    state.players.filter((p) => !p.isYou).forEach((bot) => {
      const row = document.createElement("div");
      row.className = "trader";
      row.innerHTML = `
        <div>
          <strong>${bot.name}</strong>
          <div class="meta">${bot.cards.length} cards · ${bot.slips.length} slips</div>
        </div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = "Haggle";
      btn.disabled = state.ended;
      btn.addEventListener("click", () => openTrade(bot.id));
      row.appendChild(btn);
      el.traders.appendChild(row);
    });
  }

  function openTrade(botId) {
    if (state.ended) return;
    state.tradeTarget = botId;
    const bot = state.players.find((p) => p.id === botId);
    el.tradeBox.hidden = false;
    el.tradeName.textContent = bot.name;
    el.tradeSummary.textContent = `${bot.name} holds ${bot.cards.length} cards and ${bot.slips.length} info slips.`;
    el.tradeResult.textContent = "";
  }

  function botAccepts(offer) {
    // Simple personality: accept if getting cards or info; reject empty/greedy sometimes
    const value =
      (offer.askCards ? 1 : 0) +
      (offer.askInfo ? 1.2 : 0) -
      (offer.offerCards ? 0.6 : 0) -
      (offer.offerInfo ? 0.5 : 0) +
      Math.random();
    return value > 0.7;
  }

  function proposeTrade() {
    if (state.ended || state.tradeTarget == null) return;
    const me = you();
    const bot = state.players.find((p) => p.id === state.tradeTarget);
    const offer = {
      offerCards: el.offerCards.checked && state.selected.size > 0,
      offerInfo: el.offerInfo.checked && me.slips.length > 0,
      askCards: el.askCards.checked && bot.cards.length > 0,
      askInfo: el.askInfo.checked && bot.slips.length > 0
    };
    if (!offer.offerCards && !offer.offerInfo && !offer.askCards && !offer.askInfo) {
      el.tradeResult.textContent = "Pick something to trade.";
      return;
    }
    if (!botAccepts(offer)) {
      el.tradeResult.textContent = `${bot.name} refuses — try sweeter terms.`;
      // bots sometimes trade among themselves quietly
      botBotTrade();
      return;
    }

    const log = [];
    if (offer.offerCards) {
      const idxs = [...state.selected].sort((a, b) => b - a);
      idxs.forEach((i) => {
        bot.cards.push(me.cards[i]);
        log.push(`gave ${me.cards[i]}`);
        me.cards.splice(i, 1);
      });
      state.selected.clear();
    }
    if (offer.offerInfo && me.slips.length) {
      const slip = me.slips.splice(Math.floor(Math.random() * me.slips.length), 1)[0];
      bot.slips.push(slip);
      bot.known.add(slip);
      log.push(`gave slip #${slip}`);
    }
    if (offer.askCards && bot.cards.length) {
      // Bot gives 1–2 cards they value less (random-ish)
      const n = Math.min(bot.cards.length, 1 + Math.floor(Math.random() * 2));
      for (let i = 0; i < n; i++) {
        const ci = Math.floor(Math.random() * bot.cards.length);
        const col = bot.cards.splice(ci, 1)[0];
        me.cards.push(col);
        log.push(`got ${col}`);
      }
    }
    if (offer.askInfo && bot.slips.length) {
      const slip = bot.slips[Math.floor(Math.random() * bot.slips.length)];
      me.known.add(slip);
      // chance to take possession
      if (Math.random() < 0.45) {
        bot.slips = bot.slips.filter((s) => s !== slip);
        me.slips.push(slip);
        log.push(`took slip #${slip}`);
      } else {
        log.push(`read slip #${slip}`);
      }
    }

    el.tradeResult.textContent = `${bot.name} agrees: ${log.join("; ") || "done"}.`;
    botBotTrade();
    renderAll();
  }

  function botBotTrade() {
    const bots = state.players.filter((p) => !p.isYou);
    if (bots.length < 2) return;
    const a = bots[Math.floor(Math.random() * bots.length)];
    let b = bots[Math.floor(Math.random() * bots.length)];
    if (a === b) return;
    if (a.cards.length && b.cards.length && Math.random() < 0.7) {
      const i = Math.floor(Math.random() * a.cards.length);
      const j = Math.floor(Math.random() * b.cards.length);
      const tmp = a.cards[i];
      a.cards[i] = b.cards[j];
      b.cards[j] = tmp;
    }
    if (a.slips.length && Math.random() < 0.5) {
      const slip = a.slips[Math.floor(Math.random() * a.slips.length)];
      b.known.add(slip);
    }
  }

  function renderAll() {
    renderCards();
    renderInfo();
    renderTraders();
  }

  function submit() {
    if (state.ended) return;
    finishRound();
  }

  function finishRound() {
    state.ended = true;
    clearInterval(state.tick);
    el.btnSubmit.disabled = true;
    el.tradeBox.hidden = true;

    // Bots auto-trim hands using known rules (heuristic)
    state.players.forEach((p) => {
      if (p.isYou) {
        // If player selected cards, treat selection as EXCLUDED from hand
        if (state.selected.size > 0) {
          p.submit = p.cards.filter((_, i) => !state.selected.has(i));
        } else {
          p.submit = p.cards.slice();
        }
      } else {
        p.submit = botChooseHand(p);
      }
    });

    const scored = scoreAll(
      state.players.map((p) => ({ name: p.name, cards: p.submit, isYou: p.isYou }))
    );
    scored.sort((a, b) => b.total - a.total);

    el.results.hidden = false;
    el.scoreboard.innerHTML = scored
      .map(
        (s, i) =>
          `<div class="score-row${s.isYou ? " you" : ""}"><span>#${i + 1} ${s.name}${
            s.isYou ? " (you)" : ""
          }</span><span>${s.total} <small>${s.detail}</small></span></div>`
      )
      .join("");

    el.rulesReveal.innerHTML = RULES.map((r) => `<li><strong>#${r.id}</strong> — ${r.text}</li>`).join("");
  }

  function botChooseHand(p) {
    // Prefer balanced rainbow / avoid 7+, prefer <=13
    let hand = p.cards.slice();
    const counts = countColors(hand);
    for (const col of COLORS) {
      while (counts[col] >= 7) {
        const i = hand.indexOf(col);
        hand.splice(i, 1);
        counts[col]--;
      }
    }
    if (hand.length > 13) {
      // drop extras of colors we have most of
      hand = shuffle(hand).slice(0, 13);
    }
    return hand;
  }

  function deal() {
    const nPlayers = 5;
    // 2 of each color per player
    const deck = [];
    COLORS.forEach((col) => {
      for (let i = 0; i < nPlayers * 2; i++) deck.push(col);
    });
    shuffle(deck);

    // 2 copies of each rule slip
    const slips = [];
    RULES.forEach((r) => {
      slips.push(r.id, r.id);
    });
    shuffle(slips);

    state.players = [];
    for (let i = 0; i < nPlayers; i++) {
      const cards = deck.splice(0, 10);
      const mySlips = [];
      // pick 2 slips without duplicate ids in same envelope
      while (mySlips.length < 2 && slips.length) {
        const s = slips.shift();
        if (mySlips.includes(s)) {
          slips.push(s);
          if (slips.every((x) => mySlips.includes(x))) break;
          continue;
        }
        mySlips.push(s);
      }
      const isYou = i === 0;
      const known = new Set(mySlips);
      state.players.push({
        id: i,
        name: isYou ? "You" : BOT_NAMES[i - 1],
        isYou,
        cards,
        slips: mySlips,
        known
      });
    }
  }

  function newRound() {
    clearInterval(state.tick);
    state.selected.clear();
    state.tradeTarget = null;
    state.ended = false;
    state.timer = ROUND_SECS;
    el.results.hidden = true;
    el.tradeBox.hidden = true;
    el.btnSubmit.disabled = false;
    deal();
    renderAll();
    el.timer.textContent = formatTime(state.timer);
    state.tick = setInterval(() => {
      state.timer--;
      el.timer.textContent = formatTime(Math.max(0, state.timer));
      if (state.timer <= 0) finishRound();
      else if (state.timer % 25 === 0) botBotTrade();
    }, 1000);
  }

  el.btnNew.addEventListener("click", newRound);
  el.btnSubmit.addEventListener("click", submit);
  el.btnPropose.addEventListener("click", proposeTrade);
  el.btnCancel.addEventListener("click", () => {
    el.tradeBox.hidden = true;
    state.tradeTarget = null;
  });

  newRound();
})();
