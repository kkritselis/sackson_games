(function () {
  let state;

  function emptyBases() {
    return { 1: false, 2: false, 3: false };
  }

  function newGame() {
    const deck = Cards.shuffle(Cards.standardDeck());
    state = {
      deck,
      discard: [],
      you: [],
      ai: [],
      inning: 1,
      half: "top", // top = you bat, bottom = AI bats
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: emptyBases(),
      scoreYou: 0,
      scoreAi: 0,
      phase: "pitch", // pitch | bat-reply | field-lead | field-reply | done
      pitchCard: null,
      hitLead: null,
      message: "Top 1 — you bat. AI pitches.",
      waitingHuman: false
    };
    dealHands();
    render();
    setTimeout(aiPitch, 400);
  }

  function dealHands() {
    while (state.you.length < 6) state.you.push(draw());
    while (state.ai.length < 6) state.ai.push(draw());
  }

  function draw() {
    if (!state.deck.length) {
      state.deck = Cards.shuffle(state.discard);
      state.discard = [];
    }
    return state.deck.pop();
  }

  function refill(who) {
    while (who.length < 6) who.push(draw());
  }

  function isPicture(c) {
    return Cards.isPicture(c);
  }

  function advanceRunners(basesGained) {
    let runs = 0;
    for (let b = 3; b >= 1; b--) {
      if (state.bases[b]) {
        const dest = b + basesGained;
        state.bases[b] = false;
        if (dest >= 4) runs++;
        else state.bases[dest] = true;
      }
    }
    // batter
    if (basesGained >= 4) runs++;
    else state.bases[basesGained] = true;
    return runs;
  }

  function addRuns(n) {
    if (state.half === "top") state.scoreYou += n;
    else state.scoreAi += n;
  }

  function recordOut() {
    state.outs++;
    state.balls = 0;
    state.strikes = 0;
    if (state.outs >= 3) endHalf();
    else {
      state.phase = "pitch";
      state.message = "Out! " + state.outs + " out.";
      continuePitch();
    }
  }

  function endHalf() {
    state.outs = 0;
    state.balls = 0;
    state.strikes = 0;
    state.bases = emptyBases();
    if (state.half === "top") {
      state.half = "bottom";
      state.message = "Bottom " + state.inning + " — AI bats. You pitch.";
      state.phase = "pitch";
      render();
      // human pitches
    } else {
      if (state.inning >= 9 && state.scoreYou !== state.scoreAi) {
        state.phase = "done";
        state.message = "Final: You " + state.scoreYou + " – AI " + state.scoreAi + ".";
        render();
        return;
      }
      if (state.inning >= 9 && state.scoreYou === state.scoreAi) {
        state.inning++;
        state.half = "top";
        state.message = "Extra inning " + state.inning + " — you bat.";
      } else {
        state.inning++;
        state.half = "top";
        state.message = "Top " + state.inning + " — you bat.";
      }
      state.phase = "pitch";
      render();
      setTimeout(aiPitch, 500);
    }
  }

  function batting() {
    return state.half === "top" ? "you" : "ai";
  }
  function fielding() {
    return state.half === "top" ? "ai" : "you";
  }

  function continuePitch() {
    render();
    if (state.phase === "done") return;
    if (fielding() === "ai") setTimeout(aiPitch, 450);
  }

  function aiPitch() {
    if (state.phase !== "pitch" || fielding() !== "ai") return;
    const hand = state.ai;
    // Prefer mid number cards
    const nums = hand.filter((c) => !isPicture(c)).sort((a, b) => a.value - b.value);
    const card = nums.length ? nums[Math.floor(nums.length / 2)] : hand[0];
    playPitch(card, "ai");
  }

  function playPitch(card, from) {
    const hand = from === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    hand.splice(i, 1);
    state.pitchCard = card;
    state.discard.push(card);
    refill(hand);
    state.phase = "bat-reply";
    state.message = (from === "you" ? "You" : "AI") + " pitch " + card.rank + " of " + card.suit + ".";
    render();
    if (batting() === "ai") setTimeout(aiBatReply, 400);
  }

  function aiBatReply() {
    const pitch = state.pitchCard;
    const hand = state.ai;
    const same = hand.filter((c) => c.suit === pitch.suit);
    let card;
    if (same.length) {
      // Prefer higher number for hit, or picture if 2 strikes
      const nums = same.filter((c) => !isPicture(c));
      if (nums.length) card = nums.sort((a, b) => b.value - a.value)[0];
      else card = same[0];
    } else {
      card = hand.slice().sort((a, b) => a.value - b.value)[0];
    }
    batReply(card, "ai");
  }

  function batReply(card, from) {
    const hand = from === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    hand.splice(i, 1);
    state.discard.push(card);
    refill(hand);
    const pitch = state.pitchCard;

    if (isPicture(pitch)) {
      // intentional ball
      state.balls++;
      state.message = "Ball (picture pitch). Count " + state.balls + "-" + state.strikes;
      checkWalkOrContinue();
      return;
    }

    if (card.suit !== pitch.suit) {
      state.strikes++;
      state.message = "Strike (wrong suit). " + state.balls + "-" + state.strikes;
      if (state.strikes >= 3) recordOut();
      else { state.phase = "pitch"; continuePitch(); }
      return;
    }

    if (isPicture(card)) {
      // foul — strike unless already 2
      if (state.strikes < 2) state.strikes++;
      state.message = "Foul. " + state.balls + "-" + state.strikes;
      state.phase = "pitch";
      continuePitch();
      return;
    }

    if (card.value < pitch.value) {
      state.balls++;
      state.message = "Ball. " + state.balls + "-" + state.strikes;
      checkWalkOrContinue();
      return;
    }

    if (card.value === pitch.value) {
      state.strikes++;
      state.message = "Strike (matched value). " + state.balls + "-" + state.strikes;
      if (state.strikes >= 3) recordOut();
      else { state.phase = "pitch"; continuePitch(); }
      return;
    }

    // Contact!
    state.message = "Contact! Place the hit…";
    state.phase = "field-lead";
    state.pitchCard = null;
    render();
    if (batting() === "ai") setTimeout(aiFieldLead, 400);
  }

  function checkWalkOrContinue() {
    if (state.balls >= 4) {
      // walk
      let runs = 0;
      if (state.bases[1] && state.bases[2] && state.bases[3]) runs++;
      if (state.bases[1] && state.bases[2]) state.bases[3] = true;
      if (state.bases[1]) state.bases[2] = true;
      state.bases[1] = true;
      if (runs) addRuns(runs);
      state.balls = 0;
      state.strikes = 0;
      state.message = "Walk!" + (runs ? " Run scores!" : "");
      state.phase = "pitch";
      continuePitch();
    } else {
      state.phase = "pitch";
      continuePitch();
    }
  }

  function aiFieldLead() {
    const hand = state.ai;
    const nums = hand.filter((c) => !isPicture(c));
    const card = nums.length ? nums.sort((a, b) => b.value - a.value)[0] : hand[0];
    fieldLead(card, "ai");
  }

  function fieldLead(card, from) {
    const hand = from === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    hand.splice(i, 1);
    state.hitLead = card;
    state.discard.push(card);
    refill(hand);

    if (isPicture(card)) {
      // Sacrifice simplified: always advance runners 1, batter out (unless fielder has no picture)
      state.phase = "field-reply";
      state.message = "Sacrifice attempt…";
      render();
      if (fielding() === "ai") setTimeout(() => aiFieldReply(true), 350);
      return;
    }
    state.phase = "field-reply";
    state.message = "Fielder responds…";
    render();
    if (fielding() === "ai") setTimeout(() => aiFieldReply(false), 350);
  }

  function aiFieldReply(sac) {
    const hand = state.ai;
    const lead = state.hitLead;
    if (sac) {
      const pics = hand.filter(isPicture);
      const card = pics.length ? pics[0] : hand[0];
      resolveField(card, "ai");
      return;
    }
    // Match suit/color closely
    let best = hand[0], bestScore = 999;
    hand.forEach((c) => {
      if (isPicture(c)) return;
      const diff = Math.abs(c.value - lead.value);
      const mult = c.suit === lead.suit ? 1 : c.color === lead.color ? 2 : 3;
      const sc = diff * mult;
      if (sc < bestScore) { bestScore = sc; best = c; }
    });
    resolveField(best, "ai");
  }

  function resolveField(card, from) {
    const hand = from === "you" ? state.you : state.ai;
    const i = hand.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    hand.splice(i, 1);
    state.discard.push(card);
    refill(hand);
    const lead = state.hitLead;

    if (isPicture(lead)) {
      // sacrifice resolution
      if (isPicture(card) && card.suit === lead.suit) {
        // double play simplified: batter + lead runner out
        state.message = "Double play!";
        state.bases[1] = false;
        recordOut();
        if (state.outs < 3) recordOut();
        return;
      }
      if (isPicture(card)) {
        state.message = "Sacrifice — batter out, runners advance.";
        advanceRunnersSacrifice();
        recordOut();
        return;
      }
      state.message = "Botched sac — batter safe, runners advance.";
      advanceRunnersSacrifice();
      state.bases[1] = true;
      state.balls = 0;
      state.strikes = 0;
      state.phase = "pitch";
      continuePitch();
      return;
    }

    if (isPicture(card)) {
      // HR over fence
      const runs = advanceRunners(4);
      addRuns(runs);
      state.message = "Home run over the fence! +" + runs;
      state.balls = 0;
      state.strikes = 0;
      state.phase = "pitch";
      continuePitch();
      return;
    }

    const diff = Math.abs(lead.value - card.value);
    const mult = lead.suit === card.suit ? 1 : lead.color === card.color ? 2 : 3;
    const res = diff * mult;
    let bases = 0;
    if (res <= 2) {
      state.message = "Caught — out (" + res + ").";
      recordOut();
      return;
    }
    if (res <= 4) bases = 1;
    else if (res <= 6) bases = 2;
    else if (res <= 8) bases = 3;
    else bases = 4;
    const runs = advanceRunners(bases);
    addRuns(runs);
    const names = ["", "Single", "Double", "Triple", "Home run"];
    state.message = names[bases] + "!" + (runs ? " +" + runs + " run(s)." : "");
    state.balls = 0;
    state.strikes = 0;
    state.hitLead = null;
    state.phase = "pitch";
    continuePitch();
  }

  function advanceRunnersSacrifice() {
    if (state.bases[2]) { state.bases[3] = true; state.bases[2] = false; }
    if (state.bases[1]) { state.bases[2] = true; state.bases[1] = false; }
    // man on 3rd does not score on sac
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message;
    $("scoreboard").innerHTML =
      "<span>You " + state.scoreYou + "</span><span>AI " + state.scoreAi + "</span>" +
      "<span>Inn " + state.inning + " " + state.half + "</span>" +
      "<span>B-S-O " + state.balls + "-" + state.strikes + "-" + state.outs + "</span>";
    [1, 2, 3].forEach((b) => {
      $("b" + b).classList.toggle("on", !!state.bases[b]);
    });
    $("role-label").textContent = batting() === "you" ? "You are batting" : "You are pitching / fielding";

    const play = $("play-area");
    play.innerHTML = "";
    if (state.pitchCard) play.appendChild(Cards.imgEl(state.pitchCard));
    if (state.hitLead) play.appendChild(Cards.imgEl(state.hitLead));

    const hand = $("hand");
    hand.innerHTML = "";
    const humanActs =
      (state.phase === "pitch" && fielding() === "you") ||
      (state.phase === "bat-reply" && batting() === "you") ||
      (state.phase === "field-lead" && batting() === "you") ||
      (state.phase === "field-reply" && fielding() === "you");

    state.you.forEach((c) => {
      const img = Cards.imgEl(c, { selected: false });
      if (humanActs && state.phase !== "done") {
        img.onclick = () => onHumanCard(c);
      }
      hand.appendChild(img);
    });

    const actions = $("actions");
    actions.innerHTML = "";
    if (state.phase === "pitch" && fielding() === "you") {
      actions.innerHTML = "<span class=\"muted\">Click a card to pitch. Pictures are intentional balls.</span>";
    } else if (state.phase === "bat-reply" && batting() === "you") {
      actions.innerHTML = "<span class=\"muted\">Click a card to swing (same suit to put it in play).</span>";
    } else if (state.phase === "field-lead" && batting() === "you") {
      actions.innerHTML = "<span class=\"muted\">Lead a number to hit location, or a picture to sacrifice.</span>";
    } else if (state.phase === "field-reply" && fielding() === "you") {
      actions.innerHTML = "<span class=\"muted\">Play a fielder card close in value/suit.</span>";
    }
  }

  function onHumanCard(c) {
    if (state.phase === "pitch" && fielding() === "you") playPitch(c, "you");
    else if (state.phase === "bat-reply" && batting() === "you") batReply(c, "you");
    else if (state.phase === "field-lead" && batting() === "you") fieldLead(c, "you");
    else if (state.phase === "field-reply" && fielding() === "you") resolveField(c, "you");
  }

  document.getElementById("btn-new").onclick = newGame;
  newGame();
})();
