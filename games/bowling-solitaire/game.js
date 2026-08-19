(function () {
  const ADJ = {
    A: ["B", "C", "D"], B: ["A", "D", "E"],
    C: ["A", "D", "F", "G"], D: ["A", "B", "C", "E", "G", "H"],
    E: ["B", "D", "H", "I"],
    F: ["C", "G", "J"], G: ["C", "D", "F", "H", "J"],
    H: ["D", "E", "G", "I", "J"], I: ["E", "H", "J"],
    J: ["F", "G", "H", "I"]
  };
  const PINS = "ABCDEFGHIJ".split("");
  const BACK_ROW = ["A", "B", "C", "D"];

  let state;

  function num(card) {
    return card.rank === "A" ? 1 : Math.min(card.value, 10);
  }

  function makeDeck() {
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const d = [];
    for (const s of ["Hearts", "Diamonds"]) {
      for (const r of ranks) d.push(Cards.makeCard(s, r));
    }
    return Cards.shuffle(d);
  }

  function newGame() {
    state = { frames: [], total: 0 };
    startFrame();
  }

  function startFrame() {
    const deck = makeDeck();
    const pins = {};
    PINS.forEach((p) => { pins[p] = deck.pop(); });
    state.pins = pins;
    state.removed = {};
    state.piles = [deck.splice(0, 5), deck.splice(0, 3), deck.splice(0, 2)];
    state.ball = 1;
    state.firstPlayDone = false;
    state.firstKnock = 0;
    state.selectedBall = null;
    state.selectedPins = [];
    state.phase = "play";
    state.message = "Frame " + (state.frames.length + 1) + " — first ball.";
    render();
  }

  function connectedGroup(ids) {
    if (ids.length <= 1) return true;
    const set = new Set(ids);
    const seen = new Set([ids[0]]);
    const q = [ids[0]];
    while (q.length) {
      const cur = q.pop();
      (ADJ[cur] || []).forEach((n) => {
        if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
      });
    }
    return seen.size === ids.length;
  }

  function touchesCleared(ids) {
    if (!state.firstPlayDone) return true;
    return ids.some((id) => (ADJ[id] || []).some((n) => state.removed[n]));
  }

  function legalRemoval(ballCard, pinIds) {
    if (!pinIds.length || pinIds.length > 3) return false;
    if (pinIds.some((id) => state.removed[id] || !state.pins[id])) return false;
    if (!connectedGroup(pinIds)) return false;
    if (!touchesCleared(pinIds)) return false;
    if (!state.firstPlayDone) {
      if (pinIds.some((id) => BACK_ROW.includes(id))) return false;
      if (pinIds.length === 1 && pinIds[0] === "F") return false;
    }
    const bn = num(ballCard) % 10;
    if (pinIds.length === 1) return num(state.pins[pinIds[0]]) === num(ballCard);
    const sum = pinIds.reduce((s, id) => s + num(state.pins[id]), 0);
    return sum % 10 === bn;
  }

  function combinations(arr, k) {
    const out = [];
    (function rec(start, path) {
      if (path.length === k) { out.push(path.slice()); return; }
      for (let i = start; i < arr.length; i++) {
        path.push(arr[i]);
        rec(i + 1, path);
        path.pop();
      }
    })(0, []);
    return out;
  }

  function anyLegalWithTops() {
    const tops = state.piles.map((p, i) => (p.length ? { card: p[p.length - 1] } : null)).filter(Boolean);
    const alive = PINS.filter((p) => !state.removed[p]);
    for (const t of tops) {
      for (let n = 1; n <= 3; n++) {
        for (const c of combinations(alive, n)) {
          if (legalRemoval(t.card, c)) return true;
        }
      }
    }
    return false;
  }

  function strikeBonus(i) {
    const balls = [];
    for (let j = i + 1; j < state.frames.length && balls.length < 2; j++) {
      const f = state.frames[j];
      if (f.mark === "X") balls.push(10);
      else {
        balls.push(f.firstKnock);
        if (balls.length < 2) balls.push(f.mark === "/" ? 10 - f.firstKnock : Math.max(0, f.knocked - f.firstKnock));
      }
    }
    return balls.length < 2 ? null : balls[0] + balls[1];
  }

  function spareBonus(i) {
    if (i + 1 >= state.frames.length) return null;
    const f = state.frames[i + 1];
    return f.mark === "X" ? 10 : f.firstKnock;
  }

  function resolveScores() {
    let run = 0;
    state.frames.forEach((f, i) => {
      if (f.mark === "X") {
        const b = strikeBonus(i);
        f.score = b == null ? null : 10 + b;
      } else if (f.mark === "/") {
        const b = spareBonus(i);
        f.score = b == null ? null : 10 + b;
      } else f.score = f.knocked;
      if (f.score != null) { run += f.score; f.cum = run; }
      else f.cum = null;
    });
    state.total = run;
  }

  function finishFrame(mark) {
    const knocked = PINS.filter((p) => state.removed[p]).length;
    state.frames.push({
      mark,
      knocked: mark === "X" || mark === "/" ? 10 : knocked,
      firstKnock: mark === "X" ? 10 : (state.ball === 2 ? state.firstKnock : knocked),
      score: null
    });
    resolveScores();
    if (state.frames.length >= 10) {
      state.phase = "done";
      state.message = "Game over! Total " + state.total + " (300 is perfect).";
      render();
      return;
    }
    state.phase = "between";
    state.message = (mark === "X" ? "Strike!" : mark === "/" ? "Spare!" : knocked + " pins.") +
      " Running total " + state.total + ".";
    render();
    setTimeout(startFrame, 900);
  }

  function doBowl() {
    if (!state.selectedBall || !state.selectedPins.length) return;
    const { pile, card } = state.selectedBall;
    if (!legalRemoval(card, state.selectedPins)) {
      state.message = "Illegal shot.";
      render();
      return;
    }
    state.piles[pile].pop();
    state.selectedPins.forEach((id) => { state.removed[id] = true; });
    state.firstPlayDone = true;
    state.selectedBall = null;
    state.selectedPins = [];
    const left = PINS.filter((p) => !state.removed[p]).length;
    if (left === 0) {
      finishFrame(state.ball === 1 ? "X" : "/");
      return;
    }
    if (state.ball === 2 && !anyLegalWithTops()) {
      finishFrame("-");
      return;
    }
    state.message = left + " pins standing.";
    render();
  }

  function takeSecondBall() {
    if (state.ball !== 1 || state.phase !== "play") return;
    state.firstKnock = PINS.filter((p) => state.removed[p]).length;
    state.piles.forEach((p) => { if (p.length) p.pop(); });
    state.ball = 2;
    state.selectedBall = null;
    state.selectedPins = [];
    state.message = "Second ball — new tops.";
    if (!anyLegalWithTops()) finishFrame("-");
    else render();
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message;
    $("scorecard").innerHTML = "<div class=\"score-frames\">" +
      state.frames.map((f, i) =>
        "<div class=\"frame\"><div>" + (i + 1) + "</div><div class=\"mark\">" +
        (f.mark === "-" ? f.knocked : f.mark) + "</div><div>" +
        (f.cum != null ? f.cum : "…") + "</div></div>"
      ).join("") +
      "<div class=\"frame\"><div>Tot</div><div class=\"mark\">" + state.total + "</div></div></div>";

    const pins = $("pins");
    pins.innerHTML = "";
    PINS.forEach((p) => {
      const d = document.createElement("div");
      d.className = "pin" + (state.removed[p] ? " gone" : "");
      d.dataset.p = p;
      if (!state.removed[p]) {
        const img = Cards.imgEl(state.pins[p], {
          small: true,
          selected: state.selectedPins.includes(p),
          title: p + "=" + num(state.pins[p])
        });
        img.onclick = () => {
          const i = state.selectedPins.indexOf(p);
          if (i >= 0) state.selectedPins.splice(i, 1);
          else if (state.selectedPins.length < 3) state.selectedPins.push(p);
          render();
        };
        d.appendChild(img);
      } else d.textContent = "·";
      pins.appendChild(d);
    });

    const balls = $("balls");
    balls.innerHTML = "";
    state.piles.forEach((pile, pi) => {
      const d = document.createElement("div");
      d.className = "pile";
      d.innerHTML = "<div class=\"muted\">" + pile.length + " left</div>";
      if (pile.length) {
        const top = pile[pile.length - 1];
        const img = Cards.imgEl(top, {
          selected: state.selectedBall && state.selectedBall.pile === pi
        });
        img.onclick = () => {
          state.selectedBall = { pile: pi, card: top };
          render();
        };
        d.appendChild(img);
      }
      balls.appendChild(d);
    });

    const can = !!(state.selectedBall && state.selectedPins.length &&
      legalRemoval(state.selectedBall.card, state.selectedPins));
    $("btn-bowl").disabled = !can || state.phase !== "play";
    $("btn-second").disabled = state.ball !== 1 || state.phase !== "play";
  }

  document.getElementById("btn-bowl").onclick = doBowl;
  document.getElementById("btn-second").onclick = takeSecondBall;
  document.getElementById("btn-clear").onclick = () => {
    state.selectedPins = [];
    state.selectedBall = null;
    render();
  };
  document.getElementById("btn-new").onclick = newGame;
  newGame();
})();
