(function () {
  // Two-player Osmosis: 24-card deck (A–7 of three suits)
  const SUITS3 = ["Spades", "Hearts", "Diamonds"];
  const RANKS8 = ["A", "K", "Q", "J", "10", "9", "8", "7"];
  const RANK_HI = { A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7 };

  let state;

  function makeDeck() {
    const d = [];
    for (const s of SUITS3) for (const r of RANKS8) d.push(Cards.makeCard(s, r));
    return Cards.shuffle(d);
  }

  function hi(c) { return RANK_HI[c.rank]; }

  function lowBlocked(suit) {
    return state.unused.some((c) => c.suit === suit && c.rank === "7");
  }

  function lowSequenceTop(cards, suit) {
    // Cards available that form 7,8,9... consecutive from 7
    const ofSuit = cards.filter((c) => c.suit === suit).sort((a, b) => hi(a) - hi(b));
    const has7 = ofSuit.some((c) => c.rank === "7");
    if (!has7 || lowBlocked(suit)) return null;
    const vals = new Set(ofSuit.map((c) => c.rank));
    // Also check unused cards that break sequence
    const unusedBreak = state.unused.filter((c) => c.suit === suit).map((c) => c.rank);
    let top = "7";
    const order = ["7", "8", "9", "10", "J", "Q", "K", "A"];
    for (let i = 1; i < order.length; i++) {
      if (unusedBreak.includes(order[i])) break;
      if (vals.has(order[i])) top = order[i];
      else break;
    }
    return ofSuit.find((c) => c.rank === top);
  }

  function canTradeHigh(answerPool, offer) {
    return answerPool.filter((c) => c.suit === offer.suit && hi(c) > hi(offer));
  }

  function canTradeLow(answerPool, offer) {
    if (lowBlocked(offer.suit)) return null;
    return lowSequenceTop(answerPool, offer.suit);
  }

  function newGame() {
    const deck = makeDeck();
    const unused = deck.splice(0, 6);
    state = {
      unused,
      you: { hand: deck.splice(0, 9), table: [], pickups: 0 },
      ai: { hand: deck, table: [], pickups: 0 },
      turn: "you", // who offers
      phase: "offer", // offer | answer | done
      offer: null,
      message: "Your turn — offer a card from your hand.",
      scoreYou: 0,
      scoreAi: 0
    };
    render();
  }

  function allAnswerCards(who) {
    return who.hand.concat(who.table);
  }

  function removeFrom(who, card) {
    const ih = who.hand.findIndex((c) => c.id === card.id);
    if (ih >= 0) { who.hand.splice(ih, 1); return "hand"; }
    const it = who.table.findIndex((c) => c.id === card.id);
    if (it >= 0) { who.table.splice(it, 1); return "table"; }
    return null;
  }

  function afterHandEmpty(who, key) {
    if (who.hand.length > 0) return false;
    who.hand = who.table.slice();
    who.table = [];
    who.pickups++;
    if (who.hand.length <= 4) {
      state.phase = "done";
      if (key === "you") {
        state.message = "You picked up " + who.hand.length + " cards — you lose.";
        // AI scores 18 - your pickups
        state.scoreAi += Math.max(0, 18 - who.pickups);
      } else {
        state.message = "AI picked up " + who.hand.length + " cards — you win!";
        state.scoreYou += Math.max(0, 18 - who.pickups);
      }
      return true;
    }
    if (who.pickups >= 12) {
      state.phase = "done";
      state.message = "Draw — 12 pickups without a loss.";
      return true;
    }
    return false;
  }

  function completeTrade(offererKey, answererKey, giveToOfferer, giveToAnswerer) {
    const offerer = state[offererKey];
    const answerer = state[answererKey];
    giveToOfferer.forEach((c) => offerer.table.push(c));
    giveToAnswerer.forEach((c) => answerer.table.push(c));
    state.offer = null;
    if (afterHandEmpty(offerer, offererKey) || afterHandEmpty(answerer, answererKey)) {
      render();
      return;
    }
    // Answerer now offers
    state.turn = answererKey;
    state.phase = "offer";
    state.message = answererKey === "you" ? "Your turn — offer a card." : "AI is offering…";
    render();
    if (answererKey === "ai") setTimeout(aiOffer, 500);
  }

  function offerCard(card) {
    if (state.phase !== "offer" || state.turn !== "you") return;
    removeFrom(state.you, card);
    state.offer = { card, from: "you" };
    state.phase = "answer";
    state.message = "AI answers…";
    render();
    setTimeout(() => aiAnswer(card), 400);
  }

  function aiOffer() {
    if (state.phase !== "offer" || state.turn !== "ai" || state.phase === "done") return;
    const hand = state.ai.hand;
    if (!hand.length) return;
    // Prefer middling cards
    const card = hand.slice().sort((a, b) => hi(a) - hi(b))[Math.floor(hand.length / 2)];
    removeFrom(state.ai, card);
    state.offer = { card, from: "ai" };
    state.phase = "answer";
    state.message = "Answer AI's " + card.rank + " of " + card.suit + ".";
    render();
  }

  function aiAnswer(offer) {
    const pool = allAnswerCards(state.ai);
    const highs = canTradeHigh(pool, offer);
    const low = canTradeLow(pool, offer);
    if (highs.length && (Math.random() < 0.55 || !low)) {
      const c = highs.sort((a, b) => hi(a) - hi(b))[0];
      removeFrom(state.ai, c);
      completeTrade("you", "ai", [c], [offer]);
      return;
    }
    if (low) {
      removeFrom(state.ai, low);
      completeTrade("you", "ai", [low], [offer]);
      return;
    }
    // trade off two cards
    const two = pickTwoForOff(state.ai);
    two.forEach((c) => removeFrom(state.ai, c));
    completeTrade("you", "ai", two, [offer]);
  }

  function pickTwoForOff(who) {
    const pool = allAnswerCards(who);
    const sorted = pool.slice().sort((a, b) => hi(a) - hi(b));
    return [sorted[0], sorted[1]];
  }

  function humanAnswer(mode, cards) {
    if (state.phase !== "answer" || !state.offer || state.offer.from !== "ai") return;
    const offer = state.offer.card;
    const pool = allAnswerCards(state.you);
    if (mode === "high") {
      const c = cards[0];
      if (!c || c.suit !== offer.suit || hi(c) <= hi(offer)) return;
      removeFrom(state.you, c);
      completeTrade("ai", "you", [c], [offer]);
    } else if (mode === "low") {
      const low = canTradeLow(pool, offer);
      if (!low) return;
      removeFrom(state.you, low);
      completeTrade("ai", "you", [low], [offer]);
    } else if (mode === "off") {
      if (cards.length !== 2) return;
      // Must not be able to high or low
      if (canTradeHigh(pool, offer).length || canTradeLow(pool, offer)) return;
      cards.forEach((c) => removeFrom(state.you, c));
      completeTrade("ai", "you", cards, [offer]);
    }
  }

  let offPicks = [];

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message + " (You " + state.scoreYou + " – AI " + state.scoreAi + ")";
    $("unused").innerHTML = "";
    state.unused.forEach((c) => $("unused").appendChild(Cards.imgEl(c, { small: true })));
    $("ai-table").innerHTML = "";
    state.ai.table.forEach((c) => $("ai-table").appendChild(Cards.imgEl(c, { small: true })));
    $("ai-hand-count").textContent = state.ai.hand.length;
    $("ai-pickups").textContent = state.ai.pickups;
    $("you-table").innerHTML = "";
    state.you.table.forEach((c) => $("you-table").appendChild(Cards.imgEl(c, { small: true })));
    $("you-pickups").textContent = state.you.pickups;

    const hand = $("you-hand");
    hand.innerHTML = "";
    state.you.hand.forEach((c) => {
      const img = Cards.imgEl(c);
      if (state.phase === "offer" && state.turn === "you") {
        img.onclick = () => offerCard(c);
      }
      hand.appendChild(img);
    });

    const offerPanel = $("offer-panel");
    const answering = state.phase === "answer" && state.offer && state.offer.from === "ai";
    offerPanel.hidden = !answering;
    if (answering) {
      $("offer-card").innerHTML = "";
      $("offer-card").appendChild(Cards.imgEl(state.offer.card));
      const pool = allAnswerCards(state.you);
      const highs = canTradeHigh(pool, state.offer.card);
      const low = canTradeLow(pool, state.offer.card);
      const btns = $("trade-btns");
      btns.innerHTML = "";
      offPicks = [];
      $("pick-extra").innerHTML = "";

      if (highs.length) {
        highs.forEach((c) => {
          const b = document.createElement("button");
          b.className = "primary";
          b.textContent = "Trade high: " + c.rank + c.suit[0];
          b.onclick = () => humanAnswer("high", [c]);
          btns.appendChild(b);
        });
      }
      if (low) {
        const b = document.createElement("button");
        b.className = "primary";
        b.textContent = "Trade low: " + low.rank + low.suit[0];
        b.onclick = () => humanAnswer("low", [low]);
        btns.appendChild(b);
      }
      if (!highs.length && !low) {
        const hint = document.createElement("p");
        hint.className = "muted";
        hint.textContent = "Trade off — select exactly two cards (hand or table).";
        btns.appendChild(hint);
        const show = (arr, label) => {
          arr.forEach((c) => {
            const img = Cards.imgEl(c, { small: true });
            img.classList.add("pickable");
            img.onclick = () => {
              const i = offPicks.findIndex((x) => x.id === c.id);
              if (i >= 0) offPicks.splice(i, 1);
              else if (offPicks.length < 2) offPicks.push(c);
              render();
              // re-mark selected after render — store and apply
            };
            if (offPicks.some((x) => x.id === c.id)) img.classList.add("selected");
            $("pick-extra").appendChild(img);
          });
        };
        show(state.you.hand.concat(state.you.table));
        const go = document.createElement("button");
        go.className = "primary";
        go.textContent = "Trade off (" + offPicks.length + "/2)";
        go.disabled = offPicks.length !== 2;
        go.onclick = () => humanAnswer("off", offPicks.slice());
        btns.appendChild(go);
      }
    }
  }

  document.getElementById("btn-new").onclick = newGame;
  newGame();
})();
