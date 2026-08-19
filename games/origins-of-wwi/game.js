(() => {
  /* Simplified Origins of WWI: 3 nations, 8 turns, compact map. See README. */
  const NATIONS = ["Britain", "France", "Germany"];
  const PF_INCOME = { Britain: 14, France: 12, Germany: 16 };
  const BOXES = [
    "Britain", "France", "Germany",
    "Italy", "Belgium", "Africa", "FarEast", "Balkans",
  ];
  // Who may place in which boxes (own * home defense + listed embassies)
  const ACCESS = {
    Britain: ["Britain", "France", "Germany", "Italy", "Belgium", "Africa", "FarEast", "Balkans"],
    France: ["France", "Britain", "Germany", "Italy", "Belgium", "Africa", "Balkans"],
    Germany: ["Germany", "France", "Britain", "Italy", "Belgium", "Africa", "FarEast", "Balkans"],
  };

  const ATTACK = {
    // die 1-6 -> result for odds columns
    lt1: ["AE", "AE", "AE", "EX", "EX", "EX"],
    eq1: ["AE", "AE", "EX", "EX", "EX", "DE"],
    to2: ["AE", "EX", "EX", "EX", "DE", "DE"],
    to3: ["EX", "EX", "EX", "DE", "DE", "DE"],
    to4: ["EX", "EX", "EX", "DE", "DE", "DE"],
  };

  const statusEl = document.getElementById("status");
  const mapEl = document.getElementById("map");
  const logEl = document.getElementById("log");
  const dieEl = document.getElementById("die");

  let state;

  function emptyEmbassies() {
    const e = {};
    for (const box of BOXES) {
      e[box] = { Britain: 0, France: 0, Germany: 0 };
    }
    return e;
  }

  function log(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.pop();
    logEl.textContent = state.log.join("\n");
  }

  function treaty(box, nation) {
    return state.pf[box][nation] >= 10;
  }

  function renderMap() {
    mapEl.innerHTML = "";
    for (const box of BOXES) {
      const div = document.createElement("div");
      div.className = "box";
      div.innerHTML = `<h3>${box}</h3>`;
      for (const n of NATIONS) {
        const v = state.pf[box][n];
        if (!v && n !== box) continue;
        const line = document.createElement("div");
        line.className = "pf-line" + (treaty(box, n) ? " treaty" : "");
        line.textContent = `${n}: ${v}${treaty(box, n) ? " (treaty)" : ""}`;
        div.appendChild(line);
      }
      mapEl.appendChild(div);
    }
    document.getElementById("round").textContent = state.round;
    document.getElementById("pf-left").textContent = state.pfLeft;
  }

  function fillSelects() {
    const target = document.getElementById("target");
    const common = document.getElementById("common");
    target.innerHTML = "";
    common.innerHTML = "";
    for (const box of ACCESS.Britain) {
      const o = document.createElement("option");
      o.value = box;
      o.textContent = box === "Britain" ? "Britain (home defense)" : box;
      target.appendChild(o);
      const o2 = document.createElement("option");
      o2.value = box;
      o2.textContent = box;
      common.appendChild(o2);
    }
  }

  function placePF(nation, box, amount) {
    if (!ACCESS[nation].includes(box)) return false;
    if (amount < 1 || amount > state.pfLeft && nation === "Britain") return false;
    if (box !== nation && amount > 5) return false;
    state.pf[box][nation] += amount;
    return true;
  }

  function oddsColumn(att, def) {
    if (att < def) return "lt1";
    if (att < def * 2) return "eq1";
    if (att < def * 3) return "to2";
    if (att < def * 4) return "to3";
    return "to4";
  }

  function resolveAttack(attacker, defender, box) {
    const a = state.pf[box][attacker];
    const d = state.pf[box][defender];
    if (a < 1 || d < 1) return "No shared PFs.";
    const col = oddsColumn(a, d);
    const die = 1 + ((Math.random() * 6) | 0);
    dieEl.src = `../../assets/Dice/dieWhite${die}.png`;
    const res = ATTACK[col][die - 1];
    if (res === "AE") {
      state.pf[box][attacker] = 0;
    } else if (res === "DE") {
      state.pf[box][defender] = 0;
    } else {
      const loss = Math.min(a, d);
      state.pf[box][attacker] -= loss;
      state.pf[box][defender] -= loss;
    }
    return `${attacker} attacks ${defender} in ${box} (die ${die}, ${col}) → ${res}`;
  }

  function scoreNation(n) {
    let pts = 0;
    const notes = [];
    if (n === "Britain") {
      if (treaty("Italy", "Britain")) { pts += 3; notes.push("Italy +3"); }
      if (treaty("Belgium", "Britain")) { pts += 1; notes.push("Belgium +1"); }
      if (treaty("Balkans", "Britain")) { pts += 2; notes.push("Balkans +2"); }
      if (treaty("FarEast", "Britain") && !treaty("FarEast", "France") && !treaty("FarEast", "Germany")) {
        pts += 4; notes.push("FarEast exclusive +4");
      }
      const others = Math.max(scoreRaw("France"), scoreRaw("Germany"));
      // deferred balance bonus applied later
      notes.push("(balance checked at end)");
    }
    if (n === "France") {
      if (treaty("Britain", "France")) { pts += 2; notes.push("Britain +2"); }
      if (treaty("Italy", "France")) { pts += 1; notes.push("Italy +1"); }
      if (treaty("Africa", "France") && !treaty("Africa", "Britain") && !treaty("Africa", "Germany")) {
        pts += 5; notes.push("Africa exclusive +5");
      }
      if (!NATIONS.filter((x) => x !== "France").some((o) => BOXES.some((b) => b !== o && treaty(b, "Germany")))) {
        // simplified: if Germany has no foreign treaties
        const gerTreaties = BOXES.filter((b) => b !== "Germany" && treaty(b, "Germany")).length;
        if (gerTreaties === 0) { pts += 6; notes.push("Germany isolated +6"); }
      }
    }
    if (n === "Germany") {
      if (treaty("France", "Germany") || treaty("Germany", "France")) { /* skip */ }
      if (treaty("Italy", "Germany")) { pts += 2; notes.push("Italy +2"); }
      if (treaty("Africa", "Germany")) { pts += 3; notes.push("Africa +3"); }
      if (treaty("FarEast", "Germany")) { pts += 2; notes.push("FarEast +2"); }
      const britOut = BOXES.filter((b) => b !== "Britain" && treaty(b, "Britain")).length === 0;
      if (britOut) { pts += 5; notes.push("Britain contained +5"); }
    }
    return { pts, notes };
  }

  function scoreRaw(n) {
    return scoreNation(n).pts;
  }

  function endGame() {
    state.over = true;
    const b = scoreNation("Britain");
    const f = scoreNation("France");
    const g = scoreNation("Germany");
    if (Math.max(f.pts, g.pts) <= 12) {
      b.pts += 10;
      b.notes.push("No rival >12 +10");
    }
    const lines = [
      `Britain ${b.pts} (${b.notes.join(", ") || "—"})`,
      `France ${f.pts} (${f.notes.join(", ") || "—"})`,
      `Germany ${g.pts} (${g.notes.join(", ") || "—"})`,
    ];
    const best = Math.max(b.pts, f.pts, g.pts);
    let winner = "Tie";
    if (b.pts === best && f.pts < best && g.pts < best) winner = "You (Britain) win!";
    else if (f.pts === best && b.pts < best) winner = "France wins.";
    else if (g.pts === best && b.pts < best) winner = "Germany wins.";
    document.getElementById("scores").textContent = lines.join(" · ") + " — " + winner;
    statusEl.textContent = "Game over. " + winner;
    renderMap();
  }

  function aiNation(nation) {
    let left = PF_INCOME[nation];
    const prefs =
      nation === "France"
        ? ["Africa", "Britain", "Italy", "Belgium", "France", "Balkans"]
        : ["Italy", "Africa", "FarEast", "Belgium", "Germany", "Balkans", "France"];
    for (const box of prefs) {
      if (left <= 0) break;
      if (!ACCESS[nation].includes(box)) continue;
      const amt = Math.min(box === nation ? left : 5, left);
      if (amt < 1) continue;
      state.pf[box][nation] += amt;
      left -= amt;
      log(`${nation} places ${amt} in ${box}.`);
    }
    // occasional attack
    if (Math.random() < 0.55) {
      const rival = NATIONS.find((n) => n !== nation && (nation === "France" ? n !== "skip" : true) && n !== nation);
      const rivals = NATIONS.filter((n) => n !== nation);
      const r = rivals[(Math.random() * rivals.length) | 0];
      const commons = BOXES.filter((b) => state.pf[b][nation] > 0 && state.pf[b][r] > 0);
      if (commons.length) {
        const box = commons[(Math.random() * commons.length) | 0];
        log(resolveAttack(nation, r, box));
      }
    }
  }

  function endTurn() {
    if (state.over) return;
    if (state.attacked === false && state.pfLeft > 0) {
      // allow ending with unspent PF — leftover discarded
      if (state.pfLeft) log(`Britain discards ${state.pfLeft} unspent PF.`);
    }
    aiNation("France");
    aiNation("Germany");
    state.round++;
    if (state.round > 8) {
      endGame();
      return;
    }
    state.pfLeft = PF_INCOME.Britain;
    state.attacked = false;
    statusEl.textContent = `Round ${state.round}. Place PF, optionally attack, then end turn.`;
    renderMap();
  }

  document.getElementById("place").addEventListener("click", () => {
    if (state.over) return;
    const box = document.getElementById("target").value;
    let amount = +document.getElementById("amount").value;
    if (box !== "Britain") amount = Math.min(5, amount);
    amount = Math.min(amount, state.pfLeft);
    if (amount < 1) return;
    state.pf[box].Britain += amount;
    state.pfLeft -= amount;
    log(`You place ${amount} in ${box}.`);
    renderMap();
  });

  document.getElementById("attack").addEventListener("click", () => {
    if (state.over || state.attacked) {
      statusEl.textContent = "Already attacked this turn (or game over).";
      return;
    }
    const rival = document.getElementById("rival").value;
    const box = document.getElementById("common").value;
    const msg = resolveAttack("Britain", rival, box);
    log(msg);
    state.attacked = true;
    renderMap();
  });

  document.getElementById("end-turn").addEventListener("click", endTurn);

  function newGame() {
    state = {
      pf: emptyEmbassies(),
      round: 1,
      pfLeft: PF_INCOME.Britain,
      attacked: false,
      over: false,
      log: [],
    };
    fillSelects();
    dieEl.src = "../../assets/Dice/dieWhite1.png";
    statusEl.textContent = "Round 1. You are Britain — place Political Factors.";
    document.getElementById("scores").textContent = "";
    log("Crisis begins.");
    renderMap();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
