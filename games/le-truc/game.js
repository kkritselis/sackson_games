(() => {
  const SUITS = ["clubs", "spades", "hearts", "diamonds"];
  const SUIT_FILE = { clubs: "Clubs", spades: "Spades", hearts: "Hearts", diamonds: "Diamonds" };
  // 7 > 8 > A > K > Q > J > 10 > 9
  const ORDER = { "7": 8, "8": 7, A: 6, K: 5, Q: 4, J: 3, "10": 2, "9": 1 };
  const RANKS = ["7", "8", "A", "K", "Q", "J", "10", "9"];
  const CARD_PATH = "../../assets/Cards/";
  const BACK = CARD_PATH + "cardBack_red2.png";

  const el = {
    status: document.getElementById("status"),
    scoreYou: document.getElementById("score-you"),
    scoreAi: document.getElementById("score-ai"),
    stake: document.getElementById("stake"),
    gamesYou: document.getElementById("games-you"),
    gamesAi: document.getElementById("games-ai"),
    aiHand: document.getElementById("ai-hand"),
    youHand: document.getElementById("you-hand"),
    aiTrick: document.getElementById("ai-trick"),
    youTrick: document.getElementById("you-trick"),
    actions: document.getElementById("actions"),
    btnNew: document.getElementById("btn-new"),
  };

  let state = null;

  function deck32() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r, id: s + r + Math.random() });
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

  function strength(hand) {
    return hand.reduce((s, c) => s + ORDER[c.rank], 0);
  }

  function cardImg(card, face) {
    const img = document.createElement("img");
    if (face && card) {
      img.src = CARD_PATH + "card" + SUIT_FILE[card.suit] + card.rank + ".png";
      img.alt = card.rank + " " + card.suit;
    } else {
      img.src = BACK;
      img.alt = "back";
    }
    return img;
  }

  function newRubber() {
    state = {
      scoreYou: 0,
      scoreAi: 0,
      gamesYou: 0,
      gamesAi: 0,
      dealer: "ai",
      stock: [],
      over: false,
    };
    newHand();
  }

  function newHand() {
    if (state.gamesYou >= 2 || state.gamesAi >= 2) {
      setStatus(state.gamesYou >= 2 ? "Rubber over — you win!" : "Rubber over — computer wins!");
      state.phase = "done";
      render();
      return;
    }
    state.stock = shuffle(deck32());
    state.youHand = [];
    state.aiHand = [];
    for (let i = 0; i < 3; i++) {
      state.youHand.push(state.stock.pop());
      state.aiHand.push(state.stock.pop());
    }
    state.stake = 1;
    state.tricksYou = 0;
    state.tricksAi = 0;
    state.spoiled = 0;
    state.trick = 0;
    state.led = null;
    state.youCard = null;
    state.aiCard = null;
    state.firstTrickWinner = null;
    state.redealt = false;
    state.leader = state.dealer === "you" ? "ai" : "you"; // pone leads
    state.phase = state.leader === "you" ? "redeal-offer" : "ai-redeal";
    state.pendingRaise = null;
    clearActions();
    if (state.phase === "redeal-offer") {
      setStatus("Keep your hand or ask for new cards?");
      offerRedeal();
    } else {
      setStatus("Computer considering a redeal…");
      setTimeout(aiRedealDecision, 500);
    }
    render();
  }

  function setStatus(m) { el.status.textContent = m; }
  function clearActions() { el.actions.innerHTML = ""; }

  function btn(label, fn, secondary) {
    const b = document.createElement("button");
    b.textContent = label;
    if (secondary) b.className = "secondary";
    b.addEventListener("click", fn);
    el.actions.appendChild(b);
  }

  function offerRedeal() {
    clearActions();
    btn("Play these", () => {
      clearActions();
      beginPlay();
    });
    btn("Ask for new cards", () => {
      // AI accepts if its hand is weak
      const accept = strength(state.aiHand) < 14 || Math.random() < 0.35;
      if (!accept) {
        setStatus("Computer refuses — play as dealt.");
        clearActions();
        beginPlay();
        return;
      }
      state.youHand = [state.stock.pop(), state.stock.pop(), state.stock.pop()];
      state.aiHand = [state.stock.pop(), state.stock.pop(), state.stock.pop()];
      state.redealt = true;
      setStatus("New cards dealt. Your lead.");
      clearActions();
      beginPlay();
      render();
    }, true);
  }

  function aiRedealDecision() {
    // Pone is AI when dealer is you
    if (strength(state.aiHand) < 12 && Math.random() < 0.7) {
      // Ask human
      setStatus("Computer asks for new cards. Accept?");
      clearActions();
      btn("Accept redeal", () => {
        state.youHand = [state.stock.pop(), state.stock.pop(), state.stock.pop()];
        state.aiHand = [state.stock.pop(), state.stock.pop(), state.stock.pop()];
        state.redealt = true;
        clearActions();
        beginPlay();
        render();
      });
      btn("Refuse", () => {
        clearActions();
        beginPlay();
      }, true);
    } else {
      beginPlay();
    }
  }

  function beginPlay() {
    state.phase = "play";
    state.led = null;
    if (state.leader === "you") {
      setStatus("Lead a card (you may raise first).");
      offerRaiseThenPlay("lead");
    } else {
      setStatus("Computer to lead…");
      setTimeout(aiPlayTurn, 500);
    }
    render();
  }

  function offerRaiseThenPlay(mode) {
    clearActions();
    const needYou = 12 - state.scoreYou;
    const proposals = [];
    if (state.stake < 2) proposals.push({ label: "Two points if I play", next: 2 });
    if (state.stake < 4) proposals.push({ label: "Raise to 4", next: 4 });
    if (state.stake < needYou && needYou > state.stake) {
      proposals.push({ label: "My remainder (" + needYou + ")", next: needYou });
    }
    for (const p of proposals) {
      btn(p.label, () => proposeRaise(p.next, mode));
    }
    btn(mode === "lead" ? "Lead without raising" : "Play without raising", () => {
      clearActions();
      state.awaitingCard = mode;
      setStatus(mode === "lead" ? "Choose a lead." : "Play a card to the trick.");
      render();
    }, true);
    state.awaitingCard = null;
  }

  function proposeRaise(next, mode) {
    // AI accept/refuse
    const aiNeed = 12 - state.scoreAi;
    const handStr = strength(state.aiHand);
    let accept = handStr >= 15 || (handStr >= 11 && Math.random() < 0.45);
    if (next >= aiNeed) accept = handStr >= 16 || Math.random() < 0.25; // bluff call rare
    if (next > state.stake * 3 && handStr < 12) accept = false;

    if (!accept) {
      // Proposer (you) scores current stake
      award("you", state.stake, "Computer folds to your raise. You score " + state.stake + ".");
      return;
    }
    state.stake = next;
    setStatus("Raise accepted — stake is " + state.stake + ".");
    clearActions();
    state.awaitingCard = mode;
    render();
  }

  function award(who, pts, msg) {
    if (who === "you") state.scoreYou += pts;
    else state.scoreAi += pts;
    setStatus(msg);
    clearActions();
    checkGameWin(() => setTimeout(newHand, 1200));
    render();
  }

  function checkGameWin(cb) {
    if (state.scoreYou >= 12 || state.scoreAi >= 12) {
      if (state.scoreYou >= 12) {
        state.gamesYou += 1;
        setStatus("You take the game (" + state.scoreYou + "–" + state.scoreAi + ").");
      } else {
        state.gamesAi += 1;
        setStatus("Computer takes the game (" + state.scoreAi + "–" + state.scoreYou + ").");
      }
      state.scoreYou = 0;
      state.scoreAi = 0;
      state.dealer = state.dealer === "you" ? "ai" : "you";
    }
    cb();
  }

  function onYouCard(card) {
    if (state.phase !== "play" || state.leader !== "you" && !state.led) {
      // following
    }
    if (state.awaitingCard === "lead" || (state.leader === "you" && !state.led && state.awaitingCard !== "follow")) {
      if (state.awaitingCard === null) return; // must dismiss raise UI or choose play
      playLead("you", card);
      return;
    }
    if (state.led && state.leader === "ai" && (state.awaitingCard === "follow" || state.awaitingCard === null)) {
      // allow follow after raise UI dismissed
      if (state.awaitingCard === null && el.actions.children.length) return;
      playFollow("you", card);
    }
  }

  function playLead(who, card) {
    removeCard(who, card);
    state.led = card;
    if (who === "you") {
      state.youCard = card;
      state.aiCard = null;
      // AI may raise before playing
      setStatus("Computer may raise…");
      render();
      setTimeout(() => aiRespondToLead(card), 500);
    } else {
      state.aiCard = card;
      state.youCard = null;
      setStatus("Computer led. You may raise, then follow.");
      state.awaitingCard = null;
      offerRaiseThenPlay("follow");
      render();
    }
  }

  function aiRespondToLead(led) {
    // Maybe raise
    const handStr = strength(state.aiHand);
    if (state.stake < 4 && handStr >= 14 && Math.random() < 0.4) {
      const next = state.stake < 2 ? 2 : 4;
      setStatus('Computer: "Raise to ' + next + '." Accept?');
      clearActions();
      btn("Play (accept)", () => {
        state.stake = next;
        clearActions();
        aiFollowCard(led);
      });
      btn("Fold", () => {
        award("ai", state.stake, "You fold. Computer scores " + state.stake + ".");
      }, true);
      return;
    }
    if (state.stake < 2 && handStr < 10 && Math.random() < 0.2) {
      // bluff raise
      setStatus('Computer bluffs: "Two points if I play." Accept?');
      clearActions();
      btn("Play", () => {
        state.stake = 2;
        clearActions();
        aiFollowCard(led);
      });
      btn("Fold", () => award("ai", 1, "You fold. Computer scores 1."), true);
      return;
    }
    aiFollowCard(led);
  }

  function aiFollowCard(led) {
    const card = pickAiCard(state.aiHand, led);
    removeCard("ai", card);
    state.aiCard = card;
    resolveTrick(led, card, "you");
  }

  function playFollow(who, card) {
    removeCard(who, card);
    if (who === "you") {
      state.youCard = card;
      resolveTrick(state.led, card, "ai");
    }
  }

  function removeCard(who, card) {
    const hand = who === "you" ? state.youHand : state.aiHand;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i >= 0) hand.splice(i, 1);
  }

  function pickAiCard(hand, led) {
    if (!led) {
      // lead highest usually
      return hand.slice().sort((a, b) => ORDER[b.rank] - ORDER[a.rank])[0];
    }
    // try win cheaply, else dump low; prefer spoiling with equal rank if losing badly
    const sorted = hand.slice().sort((a, b) => ORDER[a.rank] - ORDER[b.rank]);
    const winners = sorted.filter((c) => ORDER[c.rank] > ORDER[led.rank]);
    const spoilers = sorted.filter((c) => c.rank === led.rank);
    if (spoilers.length && ORDER[led.rank] >= 6) return spoilers[0];
    if (winners.length) return winners[0];
    return sorted[0];
  }

  function resolveTrick(led, follow, leaderWho) {
    let result; // 'you' | 'ai' | 'spoil'
    if (led.rank === follow.rank) result = "spoil";
    else {
      const leadWins = ORDER[led.rank] > ORDER[follow.rank];
      if (leaderWho === "you") result = leadWins ? "you" : "ai";
      else result = leadWins ? "ai" : "you";
    }

    render();

    setTimeout(() => {
      state.trick += 1;
      if (result === "spoil") {
        state.spoiled += 1;
        setStatus("Trick spoiled (same rank).");
        // leader to spoiled leads next
        state.leader = leaderWho;
      } else {
        if (result === "you") state.tricksYou += 1;
        else state.tricksAi += 1;
        if (state.firstTrickWinner === null) state.firstTrickWinner = result;
        state.leader = result;
        setStatus(result === "you" ? "You take the trick." : "Computer takes the trick.");
      }

      state.led = null;
      state.youCard = null;
      state.aiCard = null;

      // Hand over?
      const done =
        state.tricksYou >= 2 ||
        state.tricksAi >= 2 ||
        state.youHand.length === 0 ||
        (state.spoiled > 0 && state.tricksYou + state.tricksAi >= 1 && state.trick >= 2 &&
          (state.tricksYou >= 1 || state.tricksAi >= 1) && state.youHand.length === 0);

      // After 3 tricks or clear majority
      if (state.trick >= 3 || state.tricksYou >= 2 || state.tricksAi >= 2 || (state.youHand.length === 0 && state.aiHand.length === 0)) {
        finishHand();
        return;
      }

      // If one spoiled and one won — winner of non-spoiled decides early when second decided
      if (state.spoiled >= 1 && (state.tricksYou >= 1 || state.tricksAi >= 1) && state.trick >= 2) {
        // If first was won and second spoiled, first winner wins hand
        if (state.firstTrickWinner && state.spoiled >= 1) {
          // continue to see third unless already decisive
        }
      }

      if (state.leader === "you") {
        setStatus("Your lead. You may raise.");
        offerRaiseThenPlay("lead");
        render();
      } else {
        setStatus("Computer leads…");
        render();
        setTimeout(aiPlayTurn, 550);
      }
    }, 700);
  }

  function finishHand() {
    let winner = null;
    if (state.spoiled === 3) {
      setStatus("All three spoiled — void hand.");
      setTimeout(newHand, 1100);
      render();
      return;
    }
    if (state.tricksYou > state.tricksAi) winner = "you";
    else if (state.tricksAi > state.tricksYou) winner = "ai";
    else if (state.spoiled > 0 && state.firstTrickWinner) winner = state.firstTrickWinner;
    else winner = state.firstTrickWinner || "you";

    award(winner, state.stake, (winner === "you" ? "You" : "Computer") + " wins the hand for " + state.stake + " point(s).");
  }

  function aiPlayTurn() {
    if (state.phase !== "play" || state.leader !== "ai") return;
    // AI raise chance
    const handStr = strength(state.aiHand);
    if (!state.led && state.stake < 4 && handStr >= 13 && Math.random() < 0.35) {
      const next = state.stake === 1 ? 2 : Math.min(4, 12 - state.scoreAi);
      setStatus('Computer proposes stake ' + next + ". Accept?");
      clearActions();
      btn("Accept", () => {
        state.stake = next;
        clearActions();
        const card = pickAiCard(state.aiHand, null);
        playLead("ai", card);
      });
      btn("Fold", () => award("ai", state.stake, "You fold. Computer scores " + state.stake + "."), true);
      return;
    }
    const card = pickAiCard(state.aiHand, state.led);
    if (!state.led) playLead("ai", card);
    else {
      removeCard("ai", card);
      state.aiCard = card;
      resolveTrick(state.led, card, "you");
    }
  }

  function render() {
    el.scoreYou.textContent = state.scoreYou;
    el.scoreAi.textContent = state.scoreAi;
    el.stake.textContent = state.stake;
    el.gamesYou.textContent = state.gamesYou;
    el.gamesAi.textContent = state.gamesAi;

    el.aiHand.innerHTML = "";
    state.aiHand.forEach(() => el.aiHand.appendChild(cardImg(null, false)));

    el.youHand.innerHTML = "";
    const canClick =
      state.phase === "play" &&
      ((state.leader === "you" && !state.led && state.awaitingCard === "lead") ||
        (state.led && state.leader === "ai" && state.awaitingCard === "follow"));

    state.youHand.forEach((card) => {
      const img = cardImg(card, true);
      if (!canClick) img.classList.add("disabled");
      img.addEventListener("click", () => {
        if (!canClick) return;
        if (state.awaitingCard === "lead") playLead("you", card);
        else if (state.awaitingCard === "follow") playFollow("you", card);
      });
      el.youHand.appendChild(img);
    });

    el.aiTrick.innerHTML = "";
    el.youTrick.innerHTML = "";
    if (state.aiCard) el.aiTrick.appendChild(cardImg(state.aiCard, true));
    if (state.youCard) el.youTrick.appendChild(cardImg(state.youCard, true));
  }

  el.btnNew.addEventListener("click", newRubber);
  newRubber();
})();
