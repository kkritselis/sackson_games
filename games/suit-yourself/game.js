(function () {
  let state;

  function deal() {
    const deck = Cards.shuffle(Cards.standardDeck());
    // 5 columns: 11,11,10,10,10
    const sizes = [11, 11, 10, 10, 10];
    const columns = sizes.map((n) => {
      const col = [];
      for (let i = 0; i < n; i++) col.push(deck.pop());
      return col; // index 0 = bottom, last = top
    });
    state = {
      columns,
      you: [],
      ai: [],
      turn: "you",
      stage: 1, // 1 = increasing count, 2 = take all of suit
      entitled: 1,
      selected: [],
      phase: "pick",
      message: "Take 1 card.",
      seriesYou: 0,
      seriesAi: 0
    };
    render();
  }

  function tops() {
    return state.columns.map((c, i) => (c.length ? { card: c[c.length - 1], col: i } : null)).filter(Boolean);
  }

  function availableBySuit(suit) {
    return tops().filter((t) => t.card.suit === suit);
  }

  function takeTops(indices) {
    const taken = [];
    indices.sort((a, b) => b - a);
    // take by column index uniquely
    const cols = [...new Set(indices)];
    cols.forEach((ci) => {
      if (state.columns[ci].length) taken.push(state.columns[ci].pop());
    });
    return taken;
  }

  function takeSelected() {
    if (state.phase !== "pick" || state.turn !== "you") return;
    const sel = state.selected.slice();
    if (!sel.length) return;

    if (state.stage === 1) {
      const cards = sel.map((i) => state.columns[i][state.columns[i].length - 1]);
      const suit = cards[0].suit;
      if (!cards.every((c) => c.suit === suit)) {
        state.message = "All cards must be the same suit.";
        render();
        return;
      }
      const avail = availableBySuit(suit).length;
      const entitled = state.entitled;
      if (sel.length > entitled) {
        state.message = "You may take at most " + entitled + ".";
        return;
      }
      if (sel.length < Math.min(entitled, avail) && sel.length < entitled) {
        // Allowed to take fewer — triggers stage 2
      }
      // Must take as many as entitled if available in chosen suit — actually rule:
      // "must take as many as entitled if available in the suit he chooses"
      // "may choose a suit in which less cards are available"
      if (sel.length !== Math.min(entitled, avail)) {
        // Taking fewer than available of that suit when entitled more → stage change
        if (sel.length < Math.min(entitled, avail)) {
          // illegal unless we're allowing voluntary under-take to change stage
          // Rule: may take less than entitled → changes stage
          // But: "must take as many as entitled if they are available in the suit he chooses"
          // So if you choose a suit with avail >= entitled, you MUST take entitled.
          if (avail >= entitled && sel.length < entitled) {
            state.message = "Must take " + entitled + " in this suit (or pick a thinner suit).";
            render();
            return;
          }
        }
      }
      const took = takeTops(sel);
      state.you.push(...took);
      const under = took.length < entitled;
      state.entitled++;
      state.selected = [];
      if (under) state.stage = 2;
      endTurn();
    } else {
      // stage 2: select one suit via selecting any tops of that suit — take ALL of that suit
      const suit = state.columns[sel[0]][state.columns[sel[0]].length - 1].suit;
      const all = availableBySuit(suit).map((t) => t.col);
      const took = takeTops(all);
      state.you.push(...took);
      state.selected = [];
      endTurn();
    }
  }

  function endTurn() {
    if (tops().length === 0) {
      finishDeal();
      return;
    }
    state.turn = state.turn === "you" ? "ai" : "you";
    if (state.turn === "you") {
      state.message = state.stage === 1
        ? "Take up to " + state.entitled + " of one suit."
        : "Claim all available tops of one suit.";
      render();
    } else {
      state.message = "AI thinking…";
      render();
      setTimeout(aiPlay, 500);
    }
  }

  function aiPlay() {
    if (state.turn !== "ai") return;
    const suits = Cards.SUITS;
    if (state.stage === 1) {
      let best = null;
      suits.forEach((s) => {
        const avail = availableBySuit(s);
        if (!avail.length) return;
        const n = Math.min(state.entitled, avail.length);
        // Prefer taking full entitled; avoid leaving huge suit for opponent
        const score = n - (avail.length - n) * 0.1;
        if (!best || score > best.score) best = { suit: s, n, cols: avail.slice(0, n).map((t) => t.col), score };
      });
      if (!best) { finishDeal(); return; }
      // Sometimes under-take to switch stage if leaving 4+ of a suit would be bad
      let cols = best.cols;
      let under = false;
      if (best.n === state.entitled && Math.random() < 0.15 && best.n > 1) {
        cols = best.cols.slice(0, best.n - 1);
        under = true;
      }
      const took = takeTops(cols);
      state.ai.push(...took);
      if (under || took.length < state.entitled) state.stage = 2;
      state.entitled++;
    } else {
      let best = null;
      suits.forEach((s) => {
        const avail = availableBySuit(s);
        if (!avail.length) return;
        if (!best || avail.length > best.n) best = { cols: avail.map((t) => t.col), n: avail.length };
      });
      if (!best) { finishDeal(); return; }
      state.ai.push(...takeTops(best.cols));
    }
    if (tops().length === 0) finishDeal();
    else {
      state.turn = "you";
      state.message = state.stage === 1
        ? "Take up to " + state.entitled + " of one suit."
        : "Claim all available tops of one suit.";
      render();
    }
  }

  function finishDeal() {
    const y = state.you.length, a = state.ai.length;
    let bonusY = 0, bonusA = 0;
    if (y > a) bonusY = 10;
    else if (a > y) bonusA = 10;
    else { bonusY = 5; bonusA = 5; }
    state.seriesYou += y + bonusY;
    state.seriesAi += a + bonusA;
    state.phase = "done";
    state.message = "Deal over. You " + y + " (+" + bonusY + " bonus), AI " + a + " (+" + bonusA + "). Series " +
      state.seriesYou + "–" + state.seriesAi + ".";
    render();
  }

  function toggleCol(i) {
    if (state.phase !== "pick" || state.turn !== "you") return;
    if (!state.columns[i].length) return;
    if (state.stage === 2) {
      // Selecting a column picks that suit entirely on confirm — just mark suit
      state.selected = [i];
      render();
      return;
    }
    const idx = state.selected.indexOf(i);
    if (idx >= 0) state.selected.splice(idx, 1);
    else {
      if (state.selected.length >= state.entitled) return;
      // same suit constraint
      if (state.selected.length) {
        const suit = state.columns[state.selected[0]][state.columns[state.selected[0]].length - 1].suit;
        if (state.columns[i][state.columns[i].length - 1].suit !== suit) {
          state.message = "Must match suit " + suit + ".";
          render();
          return;
        }
      }
      state.selected.push(i);
    }
    render();
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message;
    $("scores").innerHTML =
      "<span>You: " + state.you.length + " this deal · series " + state.seriesYou + "</span>" +
      "<span>AI: " + state.ai.length + " · series " + state.seriesAi + "</span>" +
      "<span>Stage " + state.stage + (state.stage === 1 ? " · entitled " + state.entitled : "") + "</span>";

    const cols = $("columns");
    cols.innerHTML = "";
    state.columns.forEach((col, i) => {
      const d = document.createElement("div");
      d.className = "col";
      col.forEach((c, j) => {
        const top = j === col.length - 1;
        const img = Cards.imgEl(c, {
          small: true,
          selected: state.selected.includes(i) && top
        });
        if (top) {
          img.classList.add("available");
          img.onclick = () => toggleCol(i);
        } else {
          img.style.opacity = "0.55";
          img.style.pointerEvents = "none";
        }
        d.appendChild(img);
      });
      cols.appendChild(d);
    });

    const actions = $("actions");
    actions.innerHTML = "";
    if (state.phase === "pick" && state.turn === "you") {
      const take = document.createElement("button");
      take.className = "primary";
      take.textContent = state.stage === 2 ? "Take all of that suit" : "Take selected (" + state.selected.length + ")";
      take.disabled = !state.selected.length;
      take.onclick = takeSelected;
      actions.appendChild(take);
      const clr = document.createElement("button");
      clr.textContent = "Clear";
      clr.onclick = () => { state.selected = []; render(); };
      actions.appendChild(clr);
    }

    $("you-take").innerHTML = "";
    state.you.forEach((c) => $("you-take").appendChild(Cards.imgEl(c, { small: true })));
    $("ai-take").innerHTML = "";
    state.ai.forEach((c) => $("ai-take").appendChild(Cards.imgEl(c, { small: true })));
  }

  document.getElementById("btn-new").onclick = () => {
    const sy = state ? state.seriesYou : 0;
    const sa = state ? state.seriesAi : 0;
    deal();
    state.seriesYou = sy;
    state.seriesAi = sa;
    render();
  };
  deal();
})();
