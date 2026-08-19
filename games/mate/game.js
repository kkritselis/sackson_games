(() => {
  const SUITS = ["clubs", "spades", "hearts", "diamonds"];
  const SUIT_FILE = { clubs: "Clubs", spades: "Spades", hearts: "Hearts", diamonds: "Diamonds" };
  const SUIT_RANK = { clubs: 4, spades: 3, hearts: 2, diamonds: 1 };
  const RANKS = ["A", "10", "K", "Q", "7"];
  const RANK_ORDER = { A: 5, "10": 4, K: 3, Q: 2, "7": 1 };
  const CARD_VALUE = { A: 11, "10": 10, K: 4, Q: 3, "7": 7 };
  const CARD_PATH = "../../assets/Cards/";
  const BACK = CARD_PATH + "cardBack_blue2.png";

  const el = {
    status: document.getElementById("status"),
    scoreYou: document.getElementById("score-you"),
    scoreAi: document.getElementById("score-ai"),
    roundLabel: document.getElementById("round-label"),
    gameLabel: document.getElementById("game-label"),
    moveNum: document.getElementById("move-num"),
    history: document.getElementById("history"),
    aiHand: document.getElementById("ai-hand"),
    youHand: document.getElementById("you-hand"),
    aiPlayed: document.getElementById("ai-played"),
    youPlayed: document.getElementById("you-played"),
    btnNew: document.getElementById("btn-new"),
  };

  let state = null;

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, id: suit + "-" + rank });
      }
    }
    return deck;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function cardImg(card, faceUp) {
    const img = document.createElement("img");
    img.className = "card" + (faceUp ? "" : " back");
    if (faceUp) {
      img.src = CARD_PATH + "card" + SUIT_FILE[card.suit] + card.rank + ".png";
      img.alt = card.rank + " of " + card.suit;
    } else {
      img.src = BACK;
      img.alt = "facedown";
    }
    return img;
  }

  function higherCard(a, b, leadWasRankFollow) {
    if (a.rank === b.rank) {
      return SUIT_RANK[a.suit] >= SUIT_RANK[b.suit] ? a : b;
    }
    if (leadWasRankFollow) {
      return SUIT_RANK[a.suit] >= SUIT_RANK[b.suit] ? a : b;
    }
    return RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? a : b;
  }

  function legalFollows(hand, led) {
    const sameSuit = hand.filter((c) => c.suit === led.suit);
    if (sameSuit.length) return { cards: sameSuit, byRank: false };
    const sameRank = hand.filter((c) => c.rank === led.rank);
    return { cards: sameRank, byRank: true };
  }

  function canFollow(hand, led) {
    return legalFollows(hand, led).cards.length > 0;
  }

  function newMatch() {
    state = {
      scoreYou: 0,
      scoreAi: 0,
      round: 1,
      gameInRound: 1,
      youHand: [],
      aiHand: [],
      savedYou: null,
      savedAi: null,
      move: 1,
      leader: "you",
      phase: "lead",
      ledCard: null,
      leadByRank: false,
      youPlay: null,
      aiPlay: null,
      history: [],
      over: false,
    };
    dealFresh();
    render();
  }

  function dealFresh() {
    const deck = shuffle(makeDeck());
    state.youHand = deck.slice(0, 10);
    state.aiHand = deck.slice(10, 20);
    state.savedYou = state.youHand.map((c) => ({ ...c }));
    state.savedAi = state.aiHand.map((c) => ({ ...c }));
    state.move = 1;
    state.leader = state.gameInRound === 1 ? "you" : "ai";
    // Dealer leads first game; after exchange opponent leads — simplify: human leads game 1 of each round
    if (state.gameInRound === 2) state.leader = "ai";
    state.phase = "lead";
    state.ledCard = null;
    state.youPlay = null;
    state.aiPlay = null;
    state.history = [];
    state.over = false;
    if (state.leader === "ai") {
      setTimeout(aiLead, 500);
    }
  }

  function exchangeHands() {
    state.youHand = state.savedAi.map((c) => ({ ...c }));
    state.aiHand = state.savedYou.map((c) => ({ ...c }));
    state.savedYou = state.youHand.map((c) => ({ ...c }));
    state.savedAi = state.aiHand.map((c) => ({ ...c }));
    state.move = 1;
    state.leader = "ai";
    state.phase = "lead";
    state.ledCard = null;
    state.youPlay = null;
    state.aiPlay = null;
    state.history = [];
    state.over = false;
    setTimeout(aiLead, 600);
  }

  function setStatus(msg) {
    el.status.textContent = msg;
  }

  function render() {
    el.scoreYou.textContent = state.scoreYou;
    el.scoreAi.textContent = state.scoreAi;
    el.roundLabel.textContent = String(state.round);
    el.gameLabel.textContent = String(state.gameInRound);
    el.moveNum.textContent = "Move " + state.move;
    el.history.textContent = state.history.slice(-4).join(" · ");

    el.aiHand.innerHTML = "";
    state.aiHand.forEach(() => el.aiHand.appendChild(cardImg(null, false)));

    el.youHand.innerHTML = "";
    const legal =
      state.phase === "follow" && state.ledCard
        ? legalFollows(state.youHand, state.ledCard).cards
        : state.youHand;
    const legalIds = new Set(legal.map((c) => c.id));

    state.youHand.forEach((card) => {
      const img = cardImg(card, true);
      const ok =
        !state.over &&
        ((state.phase === "lead" && state.leader === "you") ||
          (state.phase === "follow" && state.leader === "ai" && legalIds.has(card.id)));
      if (!ok) img.classList.add("disabled");
      img.addEventListener("click", () => {
        if (!ok) return;
        if (state.phase === "lead") humanLead(card);
        else humanFollow(card);
      });
      el.youHand.appendChild(img);
    });

    el.aiPlayed.innerHTML = "";
    el.youPlayed.innerHTML = "";
    if (state.aiPlay) el.aiPlayed.appendChild(cardImg(state.aiPlay, true));
    if (state.youPlay) el.youPlayed.appendChild(cardImg(state.youPlay, true));
  }

  function removeFromHand(hand, card) {
    const i = hand.findIndex((c) => c.id === card.id);
    if (i >= 0) hand.splice(i, 1);
  }

  function humanLead(card) {
    removeFromHand(state.youHand, card);
    state.youPlay = card;
    state.aiPlay = null;
    state.ledCard = card;
    state.phase = "follow";
    state.leader = "you";
    setStatus("Computer must follow suit or rank…");
    render();
    setTimeout(() => aiFollow(card), 450);
  }

  function humanFollow(card) {
    const info = legalFollows(state.youHand, state.ledCard);
    if (!info.cards.some((c) => c.id === card.id)) return;
    removeFromHand(state.youHand, card);
    state.youPlay = card;
    resolveMove(state.ledCard, card, state.aiPlay, card, info.byRank, "ai");
  }

  function aiLead() {
    if (state.over || state.phase !== "lead" || state.leader !== "ai") return;
    const card = pickAiLead();
    removeFromHand(state.aiHand, card);
    state.aiPlay = card;
    state.youPlay = null;
    state.ledCard = card;
    state.phase = "follow";
    state.leader = "ai";
    if (!canFollow(state.youHand, card)) {
      endMate("ai", card);
      return;
    }
    setStatus("Follow the " + card.rank + " of " + card.suit + ".");
    render();
  }

  function aiFollow(led) {
    if (!canFollow(state.aiHand, led)) {
      endMate("you", led);
      return;
    }
    const info = legalFollows(state.aiHand, led);
    const card = pickAiFollow(info.cards, led, info.byRank);
    removeFromHand(state.aiHand, card);
    state.aiPlay = card;
    resolveMove(led, card, led, card, info.byRank, "you");
  }

  function pickAiLead() {
    // Prefer mid-value leads that keep options; bias toward high suit lows
    const hand = state.aiHand.slice();
    hand.sort((a, b) => {
      const va = CARD_VALUE[a.rank] + SUIT_RANK[a.suit];
      const vb = CARD_VALUE[b.rank] + SUIT_RANK[b.suit];
      return va - vb;
    });
    // Try to mate if possible with a high-value card late
    for (const c of hand.slice().reverse()) {
      if (!canFollow(state.youHand, c)) return c;
    }
    return hand[Math.floor(hand.length / 3)] || hand[0];
  }

  function pickAiFollow(options, led, byRank) {
    // Win cheaply when possible; else dump low
    let bestWin = null;
    let bestLose = options[0];
    for (const c of options) {
      const win = higherCard(led, c, byRank) === c;
      if (win) {
        if (!bestWin || CARD_VALUE[c.rank] < CARD_VALUE[bestWin.rank]) bestWin = c;
      } else if (CARD_VALUE[c.rank] < CARD_VALUE[bestLose.rank]) {
        bestLose = c;
      }
    }
    return bestWin || bestLose;
  }

  function resolveMove(led, followCard, leadCardObj, followObj, byRank, leaderSide) {
    const winnerCard = higherCard(led, followCard, byRank);
    const youLed = leaderSide === "you";
    const winnerIsLeader = winnerCard.id === led.id;
    const nextLeader = winnerIsLeader ? leaderSide : leaderSide === "you" ? "ai" : "you";

    state.history.push(
      "M" + state.move + ": " + led.rank + led.suit[0].toUpperCase() + " / " + followCard.rank + followCard.suit[0].toUpperCase()
    );
    state.leadByRank = byRank;
    render();

    if (state.youHand.length === 0 && state.aiHand.length === 0) {
      setStatus("Draw — all ten moves played. No score.");
      state.over = true;
      setTimeout(nextGame, 1400);
      return;
    }

    state.move += 1;
    state.leader = nextLeader;
    state.phase = "lead";
    state.ledCard = null;
    state.youPlay = null;
    state.aiPlay = null;

    if (nextLeader === "you") {
      setStatus("Your lead for move " + state.move + ".");
      render();
    } else {
      setStatus("Computer leads…");
      render();
      setTimeout(aiLead, 550);
    }
  }

  function endMate(winner, matingCard) {
    const pts = CARD_VALUE[matingCard.rank] * state.move;
    if (winner === "you") {
      state.scoreYou += pts;
      setStatus("Mate! You score " + pts + " (" + matingCard.rank + " × move " + state.move + ").");
    } else {
      state.scoreAi += pts;
      setStatus("Mate! Computer scores " + pts + " (" + matingCard.rank + " × move " + state.move + ").");
    }
    state.over = true;
    render();
    setTimeout(nextGame, 1600);
  }

  function nextGame() {
    if (state.gameInRound === 1) {
      state.gameInRound = 2;
      setStatus("Hands exchanged — computer leads the return game.");
      exchangeHands();
      render();
      return;
    }
    if (state.round === 1) {
      state.round = 2;
      state.gameInRound = 1;
      setStatus("Round 2 — new deal.");
      dealFresh();
      render();
      return;
    }
    const y = state.scoreYou;
    const a = state.scoreAi;
    if (y > a) setStatus("Match over — you win " + y + " to " + a + ".");
    else if (a > y) setStatus("Match over — computer wins " + a + " to " + y + ".");
    else setStatus("Match over — tie " + y + " to " + a + ".");
    state.over = true;
    render();
  }

  el.btnNew.addEventListener("click", newMatch);
  newMatch();
})();
