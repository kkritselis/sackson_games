(function () {
  const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7"];
  const RANK_V = { A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7 };
  const TRICK_VAL = { NT: 10, Nullo: 10, Spades: 8, Hearts: 8, Diamonds: 6, Clubs: 6 };

  let state;

  function makeDeck() {
    const d = [];
    for (const s of Cards.SUITS) for (const r of RANKS) {
      const c = Cards.makeCard(s, r);
      c.rankV = RANK_V[r];
      d.push(c);
    }
    return Cards.shuffle(d);
  }

  function sortHand(h) {
    const so = { Spades: 0, Hearts: 1, Diamonds: 2, Clubs: 3 };
    h.sort((a, b) => so[a.suit] - so[b.suit] || b.rankV - a.rankV);
  }

  function newRubber() {
    state = {
      belowYou: 0, belowAi: 0, aboveYou: 0, aboveAi: 0,
      gamesYou: 0, gamesAi: 0,
      vulnerableYou: false, vulnerableAi: false,
      dealer: "ai"
    };
    newDeal();
  }

  function dealPair() {
    state.you.push(state.deck.pop(), state.deck.pop());
    state.ai.push(state.deck.pop(), state.deck.pop());
    sortHand(state.you);
    sortHand(state.ai);
  }

  function newDeal() {
    state.deck = makeDeck();
    state.you = [];
    state.ai = [];
    state.dealer = state.dealer === "you" ? "ai" : "you";
    for (let i = 0; i < 5; i++) dealPair(); // 10 cards
    state.bid = 0;
    state.bidder = null;
    state.round = 1;
    state.spoke = { you: false, ai: false };
    state.phase = "bid";
    state.contract = null;
    state.declarer = null;
    state.layoffYou = [];
    state.layoffAi = [];
    state.pickLay = [];
    state.tricksYou = 0;
    state.tricksAi = 0;
    state.trick = [];
    state.trickNum = 0;
    state.toPlay = null;
    state.awaiting = state.dealer;
    state.message = "Bid round 1 (10 cards). " + (state.awaiting === "you" ? "Your call." : "AI…");
    render();
    if (state.awaiting === "ai") setTimeout(aiBid, 400);
  }

  function estimate(hand) {
    let s = 0;
    hand.forEach((c) => { s += c.rankV - 8; });
    Cards.SUITS.forEach((suit) => {
      const n = hand.filter((c) => c.suit === suit).length;
      if (n >= 5) s += 10;
      else if (n >= 4) s += 5;
    });
    return s;
  }

  function placeBid(who, amount) {
    if (state.phase !== "bid" || state.awaiting !== who) return;
    if (amount == null) {
      state.spoke[who] = true;
      state.message = (who === "you" ? "You" : "AI") + " pass.";
    } else {
      const open = state.bid === 0;
      if (open && amount < 6) return;
      if (!open && (amount <= state.bid || amount > state.bid + 5) && amount < 24) return;
      state.bid = amount;
      state.bidder = who;
      state.spoke[who] = true;
      state.message = (who === "you" ? "You" : "AI") + " bid " + amount + ".";
    }

    if (state.round < 3) {
      const other = who === "you" ? "ai" : "you";
      if (!state.spoke[other]) {
        state.awaiting = other;
        render();
        if (other === "ai") setTimeout(aiBid, 350);
        return;
      }
      // both spoke this round
      dealPair();
      state.round++;
      state.spoke = { you: false, ai: false };
      state.awaiting = state.dealer;
      state.message += " Round " + state.round + " (" + state.you.length + " cards).";
      render();
      if (state.awaiting === "ai") setTimeout(aiBid, 400);
      return;
    }

    // Final round: continue until a pass after a bid
    if (amount == null) {
      if (!state.bidder) {
        state.message = "All pass — redeal.";
        setTimeout(newDeal, 700);
        return;
      }
      state.declarer = state.bidder;
      while (state.you.length < 16 && state.deck.length) dealPair();
      state.phase = "name";
      state.message = (state.declarer === "you" ? "You" : "AI") + " declare at " + state.bid + ".";
      render();
      if (state.declarer === "ai") setTimeout(aiName, 400);
      return;
    }
    state.awaiting = who === "you" ? "ai" : "you";
    state.spoke = { you: false, ai: false };
    render();
    if (state.awaiting === "ai") setTimeout(aiBid, 350);
  }

  function aiBid() {
    if (state.phase !== "bid" || state.awaiting !== "ai") return;
    const strength = estimate(state.ai);
    const target = Math.min(28, Math.max(6, 6 + Math.floor(strength / 4)));
    if (state.bid === 0) {
      placeBid("ai", strength >= 4 ? 6 : null);
    } else if (state.bid < target) {
      placeBid("ai", Math.min(target, state.bid + Math.min(5, target - state.bid)));
    } else placeBid("ai", null);
  }

  function aiName() {
    let best = "Clubs", n = 0;
    Cards.SUITS.forEach((s) => {
      const c = state.ai.filter((x) => x.suit === s).length;
      if (c > n) { n = c; best = s; }
    });
    if (n < 4) best = estimate(state.ai) < 12 ? "Nullo" : "NT";
    setContract(best);
  }

  function setContract(c) {
    state.contract = c;
    state.phase = "layoff";
    state.pickLay = [];
    // AI layoff
    const hand = state.ai.slice().sort((a, b) => {
      if (c === "Nullo") return b.rankV - a.rankV;
      const at = a.suit === c ? 1 : 0;
      const bt = b.suit === c ? 1 : 0;
      if (at !== bt) return at - bt;
      return a.rankV - b.rankV;
    });
    state.layoffAi = hand.slice(0, 3);
    state.ai = state.ai.filter((x) => !state.layoffAi.some((y) => y.id === x.id));
    state.message = "Contract " + c + ". Select 3 lay-off cards.";
    render();
  }

  function confirmLayoff() {
    if (state.pickLay.length !== 3) return;
    state.layoffYou = state.pickLay.slice();
    state.you = state.you.filter((c) => !state.layoffYou.some((x) => x.id === c.id));
    state.phase = "play";
    state.trickNum = 0;
    state.trick = [];
    state.toPlay = state.declarer === "you" ? "ai" : "you";
    state.message = "Play. Defender leads.";
    render();
    if (state.toPlay === "ai") setTimeout(aiPlay, 400);
  }

  function trumpSuit() {
    return (state.contract === "NT" || state.contract === "Nullo") ? null : state.contract;
  }

  function winnerOf(cards) {
    const lead = cards[0].card.suit;
    const trump = trumpSuit();
    let best = cards[0];
    cards.forEach((p) => {
      const c = p.card, b = best.card;
      if (trump && c.suit === trump) {
        if (b.suit !== trump || c.rankV > b.rankV) best = p;
      } else if (c.suit === lead && b.suit !== trump && c.rankV > b.rankV) best = p;
    });
    return best.who;
  }

  function playCard(who, card) {
    if (state.toPlay !== who) return;
    const hand = who === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    if (state.trick.length) {
      const lead = state.trick[0].card.suit;
      if (hand.some((c) => c.suit === lead) && card.suit !== lead) return;
    }
    hand.splice(i, 1);
    state.trick.push({ who, card });
    const need = state.trickNum < 7 ? 4 : 2;
    if (state.trick.length >= need) {
      const w = winnerOf(state.trick);
      if (w === "you") state.tricksYou++; else state.tricksAi++;
      state.trick = [];
      state.trickNum++;
      state.message = (w === "you" ? "You" : "AI") + " win. " + state.tricksYou + "–" + state.tricksAi;
      if (state.trickNum === 7) {
        state.you = state.layoffYou;
        state.ai = state.layoffAi;
        state.layoffYou = [];
        state.layoffAi = [];
        state.message += " Lay-off.";
      }
      if (state.trickNum >= 10) {
        scoreHand();
        return;
      }
      state.toPlay = w;
      render();
      if (state.toPlay === "ai") setTimeout(aiPlay, 400);
      return;
    }
    state.toPlay = who === "you" ? "ai" : "you";
    render();
    if (state.toPlay === "ai") setTimeout(aiPlay, 300);
  }

  function aiPlay() {
    if (state.toPlay !== "ai" || state.phase !== "play") return;
    const hand = state.ai;
    let card;
    if (!state.trick.length) {
      card = hand.slice().sort((a, b) => b.rankV - a.rankV)[0];
    } else {
      const lead = state.trick[0].card.suit;
      const follow = hand.filter((c) => c.suit === lead);
      const pool = follow.length ? follow : hand;
      card = state.contract === "Nullo"
        ? pool.sort((a, b) => a.rankV - b.rankV)[0]
        : pool.sort((a, b) => b.rankV - a.rankV)[0];
    }
    playCard("ai", card);
  }

  function scoreHand() {
    const decl = state.declarer;
    const tricks = decl === "you" ? state.tricksYou : state.tricksAi;
    let earned = 0;
    if (state.contract === "Nullo") {
      earned = Math.max(0, (10 - tricks) - 5) * 10;
    } else {
      earned = Math.max(0, tricks - 5) * TRICK_VAL[state.contract];
    }
    const made = state.contract === "Nullo" ? (10 - tricks) > 5 && earned >= state.bid
      : tricks > 5 && earned >= state.bid;
    if (made) {
      if (decl === "you") { state.belowYou += state.bid; state.aboveYou += earned - state.bid; }
      else { state.belowAi += state.bid; state.aboveAi += earned - state.bid; }
      state.message = (decl === "you" ? "You" : "AI") + " make " + earned + ".";
      if ((decl === "you" ? state.belowYou : state.belowAi) >= 20) {
        if (decl === "you") { state.gamesYou++; state.vulnerableYou = true; }
        else { state.gamesAi++; state.vulnerableAi = true; }
        state.belowYou = 0;
        state.belowAi = 0;
        state.message += " Game!";
        if (state.gamesYou >= 2 || state.gamesAi >= 2) {
          const bonus = (state.gamesYou === 2 && state.gamesAi === 0) || (state.gamesAi === 2 && state.gamesYou === 0) ? 150 : 100;
          if (state.gamesYou >= 2) state.aboveYou += bonus; else state.aboveAi += bonus;
          state.phase = "done";
          state.message = "Rubber over. You " + state.aboveYou + " – AI " + state.aboveAi;
          render();
          return;
        }
      }
    } else {
      const setPts = Math.max(1, state.bid - earned);
      const mult = (decl === "you" ? state.vulnerableYou : state.vulnerableAi) ? 5 : 3;
      const pen = setPts * mult;
      if (decl === "you") state.aboveAi += pen; else state.aboveYou += pen;
      state.message = (decl === "you" ? "You" : "AI") + " set (−" + pen + ").";
    }
    state.phase = "between";
    render();
    setTimeout(newDeal, 1800);
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message;
    $("score").innerHTML =
      "<span>Below " + state.belowYou + "–" + state.belowAi + "</span>" +
      "<span>Above " + state.aboveYou + "–" + state.aboveAi + "</span>" +
      "<span>Games " + state.gamesYou + "–" + state.gamesAi + "</span>" +
      "<span>Bid " + state.bid + (state.contract ? " " + state.contract : "") + "</span>";

    $("bid-panel").hidden = state.phase !== "bid";
    $("trump-panel").hidden = !(state.phase === "name" && state.declarer === "you");
    $("layoff-panel").hidden = state.phase !== "layoff";

    const btns = $("bid-btns");
    btns.innerHTML = "";
    if (state.phase === "bid" && state.awaiting === "you") {
      const pass = document.createElement("button");
      pass.textContent = "Pass";
      pass.onclick = () => placeBid("you", null);
      btns.appendChild(pass);
      if (state.bid === 0) {
        [6, 8, 10, 12].forEach((n) => {
          const b = document.createElement("button");
          b.className = "primary";
          b.textContent = "Open " + n;
          b.onclick = () => placeBid("you", n);
          btns.appendChild(b);
        });
      } else {
        for (let d = 1; d <= 5; d++) {
          const b = document.createElement("button");
          b.className = "primary";
          b.textContent = "+" + d + " (" + (state.bid + d) + ")";
          b.onclick = () => placeBid("you", state.bid + d);
          btns.appendChild(b);
        }
      }
    }

    if (state.phase === "name" && state.declarer === "you") {
      const tb = $("trump-btns");
      tb.innerHTML = "";
      ["Spades", "Hearts", "Diamonds", "Clubs", "NT", "Nullo"].forEach((c) => {
        const b = document.createElement("button");
        b.className = "primary";
        b.textContent = c;
        b.onclick = () => setContract(c);
        tb.appendChild(b);
      });
    }

    $("btn-layoff").disabled = state.pickLay.length !== 3;
    $("btn-layoff").onclick = confirmLayoff;

    $("trick").innerHTML = "";
    state.trick.forEach((p) => $("trick").appendChild(Cards.imgEl(p.card, { small: true })));
    $("trick-info").textContent = "Trick " + Math.min(10, state.trickNum + 1) +
      " · You " + state.tricksYou + " AI " + state.tricksAi;

    const hand = $("hand");
    hand.innerHTML = "";
    state.you.forEach((c) => {
      const sel = state.phase === "layoff" && state.pickLay.some((x) => x.id === c.id);
      const img = Cards.imgEl(c, { selected: sel });
      img.onclick = () => {
        if (state.phase === "layoff") {
          const i = state.pickLay.findIndex((x) => x.id === c.id);
          if (i >= 0) state.pickLay.splice(i, 1);
          else if (state.pickLay.length < 3) state.pickLay.push(c);
          render();
        } else if (state.phase === "play" && state.toPlay === "you") {
          playCard("you", c);
        }
      };
      hand.appendChild(img);
    });
  }

  document.getElementById("btn-new").onclick = newRubber;
  newRubber();
})();
