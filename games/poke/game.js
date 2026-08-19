(function () {
  const HONORS = {
    high: 0, pair: 50, twoPair: 100, trips: 200, straight: 300,
    flush: 400, full: 500, quads: 600, straightFlush: 750, royal: 1000
  };

  let state;

  function cv(c) { return c.rank === "A" ? 14 : c.value; }

  function sortHand(h) {
    h.sort((a, b) => cv(b) - cv(a) || a.suit.localeCompare(b.suit));
  }

  function pokerRank(hand) {
    if (!hand || hand.length < 5) return { key: "high", score: 0, vals: [0, 0, 0, 0, 0] };
    const vals = hand.map(cv).sort((a, b) => b - a);
    const suits = hand.map((c) => c.suit);
    const counts = {};
    vals.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    const groups = Object.entries(counts).map(([v, n]) => ({ v: +v, n }))
      .sort((a, b) => b.n - a.n || b.v - a.v);
    const flush = suits.every((s) => s === suits[0]);
    const uniq = [...new Set(vals)].sort((a, b) => a - b);
    let straight = uniq.length === 5 && uniq[4] - uniq[0] === 4;
    if (uniq.join(",") === "2,3,4,5,14") straight = true;
    if (flush && straight && Math.min(...uniq.filter((x) => x !== 14)) >= 10) {
      return { key: "royal", score: HONORS.royal, vals };
    }
    if (flush && straight) return { key: "straightFlush", score: HONORS.straightFlush, vals };
    if (groups[0].n === 4) return { key: "quads", score: HONORS.quads, vals };
    if (groups[0].n === 3 && groups[1] && groups[1].n === 2) {
      return { key: "full", score: HONORS.full, vals };
    }
    if (flush) return { key: "flush", score: HONORS.flush, vals };
    if (straight) return { key: "straight", score: HONORS.straight, vals };
    if (groups[0].n === 3) return { key: "trips", score: HONORS.trips, vals };
    if (groups[0].n === 2 && groups[1] && groups[1].n === 2) {
      return { key: "twoPair", score: HONORS.twoPair, vals };
    }
    if (groups[0].n === 2) return { key: "pair", score: HONORS.pair, vals };
    return { key: "high", score: 0, vals };
  }

  function better(a, b) {
    if (a.score !== b.score) return a.score > b.score;
    for (let i = 0; i < 5; i++) if ((a.vals[i] || 0) !== (b.vals[i] || 0)) {
      return (a.vals[i] || 0) > (b.vals[i] || 0);
    }
    return false;
  }

  function newRubber() {
    state = {
      belowYou: 0, belowAi: 0, aboveYou: 0, aboveAi: 0,
      gamesYou: 0, gamesAi: 0, dealer: "ai"
    };
    newHand();
  }

  function newHand() {
    state.dealer = state.dealer === "you" ? "ai" : "you";
    const deck = Cards.shuffle(Cards.standardDeck());
    state.deck = deck;
    state.you = [];
    state.ai = [];
    for (let i = 0; i < 5; i++) {
      state.you.push(deck.pop());
      state.ai.push(deck.pop());
    }
    sortHand(state.you);
    sortHand(state.ai);
    state.multYou = 1;
    state.multAi = 1;
    state.drawsYou = 0;
    state.drawsAi = 0;
    state.phase = "draw";
    state.drawTurn = state.dealer === "you" ? "ai" : "you";
    state.selected = [];
    state.tricksYou = 0;
    state.tricksAi = 0;
    state.trickLead = null;
    state.toPlay = null;
    state.finalYou = null;
    state.finalAi = null;
    state.message = "Draw — non-dealer first. Discard 1–3 or stand.";
    render();
    if (state.drawTurn === "ai") setTimeout(aiDrawPhase, 400);
  }

  function maxDraws(who) {
    return who === state.dealer ? 3 : 2;
  }

  function applyDrawPenalty(who) {
    if (who === "you") {
      state.drawsYou++;
      if (who !== state.dealer) {
        state.multYou = state.drawsYou === 1 ? 2 : 4;
      } else {
        // dealer: first free
        if (state.drawsYou === 2) state.multYou = 2;
        if (state.drawsYou >= 3) state.multYou = 4;
      }
    } else {
      state.drawsAi++;
      if (who !== state.dealer) {
        state.multAi = state.drawsAi === 1 ? 2 : 4;
      } else {
        if (state.drawsAi === 2) state.multAi = 2;
        if (state.drawsAi >= 3) state.multAi = 4;
      }
    }
  }

  function drawCards(who, indices) {
    const hand = who === "you" ? state.you : state.ai;
    indices.sort((a, b) => b - a).forEach((i) => {
      hand.splice(i, 1);
      hand.push(state.deck.pop());
    });
    sortHand(hand);
    applyDrawPenalty(who);
  }

  function advanceDrawTurn() {
    if (state.drawTurn !== state.dealer) {
      state.drawTurn = state.dealer;
      state.message = state.dealer === "you"
        ? "Dealer draw — first free."
        : "AI dealer draws…";
      render();
      if (state.dealer === "ai") setTimeout(aiDrawPhase, 400);
      return;
    }
    beginPlay();
  }

  function aiDrawPhase() {
    if (state.phase !== "draw" || state.drawTurn !== "ai") return;
    const hand = state.ai;
    const rank = pokerRank(hand);
    const max = maxDraws("ai");
    const freeLeft = state.dealer === "ai" && state.drawsAi === 0;
    const shouldStand = rank.score >= 200 || state.drawsAi >= max ||
      (state.drawsAi > 0 && !freeLeft && rank.score >= 50 && Math.random() < 0.55);

    if (shouldStand) {
      advanceDrawTurn();
      return;
    }
    const counts = {};
    hand.forEach((c) => { counts[cv(c)] = (counts[cv(c)] || 0) + 1; });
    const idxs = [];
    hand.forEach((c, i) => {
      if (counts[cv(c)] === 1 && idxs.length < 3) idxs.push(i);
    });
    if (!idxs.length) {
      advanceDrawTurn();
      return;
    }
    drawCards("ai", idxs);
    state.message = "AI draws " + idxs.length + " (AI mult ×" + state.multAi + ").";
    render();
    setTimeout(aiDrawPhase, 450);
  }

  function humanDraw() {
    if (state.phase !== "draw" || state.drawTurn !== "you") return;
    if (!state.selected.length || state.selected.length > 3) return;
    if (state.drawsYou >= maxDraws("you")) return;
    const idxs = state.selected.map((id) => state.you.findIndex((c) => c.id === id)).filter((i) => i >= 0);
    drawCards("you", idxs);
    state.selected = [];
    state.message = "Drew. Your mult ×" + state.multYou + ". Draw again or stand.";
    render();
  }

  function humanStand() {
    if (state.phase !== "draw" || state.drawTurn !== "you") return;
    advanceDrawTurn();
  }

  function beginPlay() {
    state.finalYou = pokerRank(state.you);
    state.finalAi = pokerRank(state.ai);
    state.phase = "play";
    state.selected = [];
    state.trickLead = null;
    state.toPlay = state.dealer === "you" ? "ai" : "you";
    state.message = "Play — You " + state.finalYou.key + " / AI " + state.finalAi.key + ".";
    render();
    if (state.toPlay === "ai") setTimeout(aiPlay, 400);
  }

  function removeCards(hand, cards) {
    cards.forEach((c) => {
      const i = hand.findIndex((x) => x.id === c.id);
      if (i >= 0) hand.splice(i, 1);
    });
  }

  function lead(who, cards) {
    removeCards(who === "you" ? state.you : state.ai, cards);
    state.trickLead = { who, cards };
    state.toPlay = who === "you" ? "ai" : "you";
    state.selected = [];
    state.message = (who === "you" ? "You" : "AI") + " lead " + cards.map((c) => c.rank).join(",");
    render();
    if (state.toPlay === "ai") setTimeout(aiPlay, 400);
  }

  function resolveAnswer(who, cards) {
    const lead = state.trickLead;
    const n = lead.cards.length;
    const beat = cards.length === n &&
      cards.every((c) => cv(c) === cv(cards[0])) &&
      cv(cards[0]) > cv(lead.cards[0]);
    removeCards(who === "you" ? state.you : state.ai, cards);
    const winner = beat ? who : lead.who;
    if (winner === "you") state.tricksYou += n;
    else state.tricksAi += n;
    state.trickLead = null;
    state.selected = [];
    state.message = (winner === "you" ? "You" : "AI") + " take " + n +
      ". Tricks " + state.tricksYou + "–" + state.tricksAi;
    if (!state.you.length && !state.ai.length) {
      endHand();
      return;
    }
    state.toPlay = winner;
    render();
    if (state.toPlay === "ai") setTimeout(aiPlay, 400);
  }

  function pickAnswer(hand, leadCards) {
    const n = leadCards.length;
    const need = cv(leadCards[0]);
    const counts = {};
    hand.forEach((c) => { (counts[cv(c)] = counts[cv(c)] || []).push(c); });
    let beat = null;
    Object.keys(counts).forEach((v) => {
      if (+v > need && counts[v].length >= n) {
        if (!beat || +v < cv(beat[0])) beat = counts[v].slice(0, n);
      }
    });
    if (beat) return beat;
    return hand.slice().sort((a, b) => cv(a) - cv(b)).slice(0, n);
  }

  function aiPlay() {
    if (state.phase !== "play" || state.toPlay !== "ai") return;
    if (!state.trickLead) {
      const counts = {};
      state.ai.forEach((c) => { (counts[cv(c)] = counts[cv(c)] || []).push(c); });
      let best = null;
      Object.values(counts).forEach((arr) => {
        if (arr.length >= 2 && (!best || cv(arr[0]) > cv(best[0]))) best = arr;
      });
      if (best) lead("ai", best.slice(0, Math.min(4, best.length)));
      else lead("ai", [state.ai.slice().sort((a, b) => cv(b) - cv(a))[0]]);
    } else {
      resolveAnswer("ai", pickAnswer(state.ai, state.trickLead.cards));
    }
  }

  function endHand() {
    const youPts = state.tricksYou * state.multAi;
    const aiPts = state.tricksAi * state.multYou;
    state.belowYou += youPts;
    state.belowAi += aiPts;
    if (better(state.finalYou, state.finalAi) && state.finalYou.score) {
      state.aboveYou += state.finalYou.score;
    } else if (better(state.finalAi, state.finalYou) && state.finalAi.score) {
      state.aboveAi += state.finalAi.score;
    }
    if (state.tricksYou === 5) state.aboveYou += 250;
    if (state.tricksAi === 5) state.aboveAi += 250;
    state.message = "Hand done. +" + youPts + " / +" + aiPts + " below.";
    if (state.belowYou >= 20 || state.belowAi >= 20) {
      if (state.belowYou >= state.belowAi) {
        state.aboveYou += 100;
        state.gamesYou++;
      } else {
        state.aboveAi += 100;
        state.gamesAi++;
      }
      state.belowYou = 0;
      state.belowAi = 0;
      if (state.gamesYou >= 2 || state.gamesAi >= 2) {
        const rub = (state.gamesYou === 2 && !state.gamesAi) || (state.gamesAi === 2 && !state.gamesYou) ? 750 : 500;
        if (state.gamesYou >= 2) state.aboveYou += rub;
        else state.aboveAi += rub;
        state.phase = "done";
        state.message = "Rubber over. Above You " + state.aboveYou + " – AI " + state.aboveAi;
        render();
        return;
      }
    }
    state.phase = "between";
    render();
    setTimeout(newHand, 1600);
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message;
    $("score").innerHTML =
      "<span>Below " + state.belowYou + "–" + state.belowAi + "</span>" +
      "<span>Above " + state.aboveYou + "–" + state.aboveAi + "</span>" +
      "<span>Games " + state.gamesYou + "–" + state.gamesAi + "</span>" +
      "<span>×You " + state.multYou + " ×AI " + state.multAi + "</span>";

    $("draw-panel").hidden = state.phase !== "draw";
    $("draw-info").textContent = state.drawTurn === "you"
      ? "Select up to 3 to discard (" + (maxDraws("you") - state.drawsYou) + " draws left)."
      : "AI drawing…";
    const db = $("draw-btns");
    db.innerHTML = "";
    if (state.phase === "draw" && state.drawTurn === "you") {
      const d = document.createElement("button");
      d.className = "primary";
      d.textContent = "Draw";
      d.disabled = !state.selected.length || state.selected.length > 3;
      d.onclick = humanDraw;
      db.appendChild(d);
      const s = document.createElement("button");
      s.textContent = "Stand";
      s.onclick = humanStand;
      db.appendChild(s);
    }

    $("trick").innerHTML = "";
    if (state.trickLead) {
      state.trickLead.cards.forEach((c) => $("trick").appendChild(Cards.imgEl(c)));
    }

    const pb = $("play-btns");
    pb.innerHTML = "";
    if (state.phase === "play" && state.toPlay === "you") {
      if (!state.trickLead) {
        const b = document.createElement("button");
        b.className = "primary";
        b.textContent = "Lead selected";
        b.disabled = !state.selected.length;
        b.onclick = () => {
          const cards = state.selected.map((id) => state.you.find((c) => c.id === id)).filter(Boolean);
          if (cards.length > 1 && !cards.every((c) => cv(c) === cv(cards[0]))) {
            state.message = "Multi-lead must match rank.";
            render();
            return;
          }
          lead("you", cards);
        };
        pb.appendChild(b);
      } else {
        const b = document.createElement("button");
        b.className = "primary";
        b.textContent = "Answer";
        b.onclick = () => {
          const n = state.trickLead.cards.length;
          let cards;
          if (state.selected.length === n) {
            cards = state.selected.map((id) => state.you.find((c) => c.id === id)).filter(Boolean);
          } else {
            cards = pickAnswer(state.you, state.trickLead.cards);
          }
          resolveAnswer("you", cards);
        };
        pb.appendChild(b);
      }
    }

    const hand = $("hand");
    hand.innerHTML = "";
    state.you.forEach((c) => {
      const img = Cards.imgEl(c, { selected: state.selected.includes(c.id) });
      img.onclick = () => {
        if (state.phase === "done" || state.phase === "between") return;
        const i = state.selected.indexOf(c.id);
        if (i >= 0) state.selected.splice(i, 1);
        else state.selected.push(c.id);
        render();
      };
      hand.appendChild(img);
    });
  }

  document.getElementById("btn-new").onclick = newRubber;
  newRubber();
})();
