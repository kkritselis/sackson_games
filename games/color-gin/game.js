(function () {
  const FACE = { A: 1, J: 10, Q: 10, K: 10 };
  function cv(c) { return FACE[c.rank] != null ? (c.rank === "A" ? 1 : 10) : +c.rank; }
  function rv(c) { return c.rank === "A" ? 1 : c.rank === "J" ? 11 : c.rank === "Q" ? 12 : c.rank === "K" ? 13 : +c.rank; }

  let state;

  function newMatch() {
    state = {
      scores: {
        Spades: { you: 0, ai: 0, closed: false },
        Hearts: { you: 0, ai: 0, closed: false },
        Diamonds: { you: 0, ai: 0, closed: false },
        Clubs: { you: 0, ai: 0, closed: false }
      }
    };
    newHand("you");
  }

  function openSuits() {
    return Cards.SUITS.filter((s) => !state.scores[s].closed);
  }

  function newHand(first) {
    const deck = Cards.shuffle(Cards.standardDeck());
    state.deck = deck;
    state.discard = [deck.pop()];
    state.you = [];
    state.ai = [];
    for (let i = 0; i < 10; i++) {
      state.you.push(deck.pop());
      state.ai.push(deck.pop());
    }
    sortHand(state.you);
    sortHand(state.ai);
    state.phase = "draw"; // draw | discard | ai | done
    state.turn = first || "you";
    state.drawn = null;
    state.message = state.turn === "you" ? "Draw from stock or discard." : "AI turn…";
    render();
    if (state.turn === "ai") setTimeout(aiTurn, 500);
  }

  function sortHand(h) {
    const so = { Spades: 0, Hearts: 1, Diamonds: 2, Clubs: 3 };
    h.sort((a, b) => so[a.suit] - so[b.suit] || rv(a) - rv(b));
  }

  // Find best meld deadwood (simplified exhaustive-ish)
  function analyze(hand) {
    const cards = hand.slice();
    const best = { dead: 999, melds: [], unmatched: cards.slice(), spoiled: new Set(Cards.SUITS) };

    function isSet(g) {
      if (g.length < 3) return false;
      const r = g[0].rank;
      return g.every((c) => c.rank === r) && new Set(g.map((c) => c.suit)).size === g.length;
    }
    function isRun(g) {
      if (g.length < 3) return false;
      if (!g.every((c) => c.suit === g[0].suit)) return false;
      const vs = g.map(rv).sort((a, b) => a - b);
      for (let i = 1; i < vs.length; i++) if (vs[i] !== vs[i - 1] + 1) return false;
      return true;
    }

    function scoreMelds(melds, rest) {
      const dead = rest.reduce((s, c) => s + cv(c), 0);
      const spoiled = new Set();
      // sequences spoil their suit
      melds.forEach((m) => {
        if (isRun(m)) spoiled.add(m[0].suit);
      });
      // sets spoil missing suit if 3-of-kind
      melds.forEach((m) => {
        if (isSet(m) && m.length === 3) {
          Cards.SUITS.forEach((s) => {
            if (!m.some((c) => c.suit === s)) spoiled.add(s);
          });
        }
      });
      // unmatched spoil their suits
      rest.forEach((c) => spoiled.add(c.suit));
      return { dead, melds, unmatched: rest, spoiled };
    }

    // Greedy: find all possible melds recursively limited
    function search(remaining, melds) {
      if (melds.length > 4) return;
      const res = scoreMelds(melds, remaining);
      if (res.dead < best.dead) Object.assign(best, res);

      // try sets by rank
      const byRank = {};
      remaining.forEach((c, i) => {
        (byRank[c.rank] = byRank[c.rank] || []).push({ c, i });
      });
      Object.values(byRank).forEach((arr) => {
        if (arr.length >= 3) {
          for (let n = 3; n <= Math.min(4, arr.length); n++) {
            const pick = arr.slice(0, n).map((x) => x.c);
            const ids = new Set(pick.map((c) => c.id));
            const next = remaining.filter((c) => !ids.has(c.id));
            search(next, melds.concat([pick]));
          }
        }
      });

      // try runs by suit
      Cards.SUITS.forEach((suit) => {
        const ofSuit = remaining.filter((c) => c.suit === suit).sort((a, b) => rv(a) - rv(b));
        for (let i = 0; i < ofSuit.length; i++) {
          for (let j = i + 2; j < ofSuit.length; j++) {
            const slice = ofSuit.slice(i, j + 1);
            if (!isRun(slice)) continue;
            const ids = new Set(slice.map((c) => c.id));
            const next = remaining.filter((c) => !ids.has(c.id));
            search(next, melds.concat([slice]));
          }
        }
      });
    }

    search(cards, []);
    if (best.dead === 999) {
      return scoreMelds([], cards);
    }
    return best;
  }

  function scoringSuits(analysis) {
    return openSuits().filter((s) => !analysis.spoiled.has(s));
  }

  function drawStock() {
    if (state.phase !== "draw" || state.turn !== "you") return;
    if (!state.deck.length) recycle();
    state.you.push(state.deck.pop());
    sortHand(state.you);
    state.phase = "discard";
    state.message = "Discard a card (or knock if deadwood ≤ 10).";
    render();
  }

  function drawDiscard() {
    if (state.phase !== "draw" || state.turn !== "you" || !state.discard.length) return;
    state.you.push(state.discard.pop());
    sortHand(state.you);
    state.phase = "discard";
    state.message = "Discard a card (or knock).";
    render();
  }

  function recycle() {
    if (state.discard.length <= 1) return;
    const top = state.discard.pop();
    state.deck = Cards.shuffle(state.discard);
    state.discard = [top];
  }

  function discard(card) {
    if (state.phase !== "discard" || state.turn !== "you") return;
    const i = state.you.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    state.you.splice(i, 1);
    state.discard.push(card);
    state.phase = "draw";
    state.turn = "ai";
    state.message = "AI turn…";
    render();
    setTimeout(aiTurn, 500);
  }

  function knock(isGin) {
    if (state.turn !== "you" || state.phase !== "discard") return;
    const youA = analyze(state.you);
    if (youA.dead > 10 && !isGin) return;
    if (isGin && youA.dead > 0) return;
    const suits = scoringSuits(youA);
    if (!suits.length) {
      state.message = "Cannot knock — no open scoring suit.";
      render();
      return;
    }
    // AI lays off unmatched against your melds (simplified: just compute AI deadwood)
    const aiA = analyze(state.ai);
    let diff;
    let undercut = false;
    if (isGin) {
      diff = aiA.dead + 20;
    } else if (aiA.dead <= youA.dead) {
      undercut = true;
      diff = (youA.dead - aiA.dead) + 10;
    } else {
      diff = aiA.dead - youA.dead;
    }
    const winner = undercut ? "ai" : "you";
    const pts = diff;
    applyScore(winner, undercut ? scoringSuits(aiA) : suits, pts);
    state.message = (isGin ? "Gin!" : undercut ? "Undercut!" : "Knock!") +
      " " + pts + " in " + (undercut ? scoringSuits(aiA) : suits).join(", ");
    afterHand();
  }

  function applyScore(who, suits, pts) {
    suits.forEach((s) => {
      if (state.scores[s].closed) return;
      state.scores[s][who] += pts;
      if (state.scores[s][who] >= 100) state.scores[s].closed = true;
    });
  }

  function afterHand() {
    state.phase = "between";
    render();
    const open = openSuits();
    if (!open.length) {
      state.phase = "done";
      state.message += " All suits closed — match over.";
      render();
      return;
    }
    setTimeout(() => newHand(state.turn === "you" ? "ai" : "you"), 1600);
  }

  function aiTurn() {
    if (state.turn !== "ai") return;
    // Draw
    const top = state.discard[state.discard.length - 1];
    const trial = state.ai.concat([top]);
    const before = analyze(state.ai).dead;
    const after = analyze(trial).dead;
    if (after < before - 2) {
      state.ai.push(state.discard.pop());
    } else {
      if (!state.deck.length) recycle();
      state.ai.push(state.deck.pop());
    }
    sortHand(state.ai);
    const a = analyze(state.ai);
    const suits = scoringSuits(a);
    if (a.dead === 0 && suits.length) {
      // gin
      const youA = analyze(state.you);
      applyScore("ai", suits, youA.dead + 20);
      state.message = "AI goes gin for " + (youA.dead + 20) + " in " + suits.join(", ");
      afterHand();
      return;
    }
    if (a.dead <= 10 && suits.length && Math.random() < 0.45) {
      const youA = analyze(state.you);
      if (youA.dead <= a.dead) {
        applyScore("you", scoringSuits(youA), (a.dead - youA.dead) + 10);
        state.message = "AI knocked and you undercut!";
      } else {
        applyScore("ai", suits, youA.dead - a.dead);
        state.message = "AI knocks for " + (youA.dead - a.dead) + ".";
      }
      afterHand();
      return;
    }
    // discard highest deadwood-ish
    const unmatched = a.unmatched.length ? a.unmatched : state.ai;
    const disc = unmatched.slice().sort((x, y) => cv(y) - cv(x))[0];
    const i = state.ai.findIndex((c) => c.id === disc.id);
    state.ai.splice(i, 1);
    state.discard.push(disc);
    state.turn = "you";
    state.phase = "draw";
    state.message = "Your draw.";
    render();
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message;
    $("suit-scores").innerHTML = "<div class=\"suit-grid\">" + Cards.SUITS.map((s) => {
      const col = state.scores[s];
      return "<div class=\"suit-col" + (col.closed ? " closed" : "") + "\">" +
        "<div class=\"sname\">" + s + "</div>" +
        "<div>You " + col.you + "</div><div>AI " + col.ai + "</div></div>";
    }).join("") + "</div>";

    const table = $("table-cards");
    table.innerHTML = "";
    if (state.deck.length) {
      const back = document.createElement("img");
      back.className = "card-img";
      back.src = Cards.BACK;
      back.alt = "Stock";
      back.onclick = drawStock;
      table.appendChild(back);
    }
    if (state.discard.length) {
      const top = state.discard[state.discard.length - 1];
      const img = Cards.imgEl(top);
      img.onclick = drawDiscard;
      table.appendChild(img);
    }

    const actions = $("actions");
    actions.innerHTML = "";
    if (state.phase === "discard" && state.turn === "you") {
      const a = analyze(state.you);
      const knockBtn = document.createElement("button");
      knockBtn.className = "primary";
      knockBtn.textContent = "Knock (" + a.dead + ")";
      knockBtn.disabled = a.dead > 10 || !scoringSuits(a).length;
      knockBtn.onclick = () => knock(false);
      actions.appendChild(knockBtn);
      const ginBtn = document.createElement("button");
      ginBtn.textContent = "Gin";
      ginBtn.disabled = a.dead > 0 || !scoringSuits(a).length;
      ginBtn.onclick = () => knock(true);
      actions.appendChild(ginBtn);
    }

    $("ai-count").textContent = state.ai.length;
    $("ai-hand").innerHTML = "";
    state.ai.forEach(() => $("ai-hand").appendChild(Cards.imgEl(state.ai[0], { faceDown: true, small: true })));

    const hand = $("hand");
    hand.innerHTML = "";
    const a = analyze(state.you);
    $("deadwood").textContent = String(a.dead) + " · score suits: " +
      (scoringSuits(a).join(", ") || "none");
    state.you.forEach((c) => {
      const img = Cards.imgEl(c);
      if (state.phase === "discard" && state.turn === "you") {
        img.onclick = () => discard(c);
      }
      hand.appendChild(img);
    });
  }

  document.getElementById("btn-new").onclick = newMatch;
  newMatch();
})();
