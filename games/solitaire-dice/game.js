(() => {
  const COMBO_POINTS = {
    2: 100, 3: 70, 4: 60, 5: 50, 6: 40, 7: 30, 8: 40, 9: 50, 10: 60, 11: 70, 12: 100,
  };

  const comboMarks = {};
  const rejectMarks = {};
  for (let i = 2; i <= 12; i++) comboMarks[i] = 0;
  for (let i = 1; i <= 6; i++) rejectMarks[i] = 0;

  let dice = [];
  let pick = []; // indices assigned in order: first two = A, next two = B, last = reject
  let over = false;
  let freeRide = false;

  const dieSrc = (n) => `../../assets/Dice/dieWhite_border${n}.png`;

  function usedRejects() {
    return Object.keys(rejectMarks)
      .map(Number)
      .filter((k) => rejectMarks[k] > 0);
  }

  function scoreNow() {
    let score = 0;
    for (let c = 2; c <= 12; c++) {
      const m = comboMarks[c];
      if (m >= 1 && m <= 4) score -= 200;
      else if (m > 5) {
        const over5 = Math.min(5, m - 5);
        score += over5 * COMBO_POINTS[c];
      }
    }
    return score;
  }

  function renderTables() {
    const comboTable = document.getElementById("comboTable");
    comboTable.innerHTML = "<tr><th>Sum</th><th>Pts</th><th>Marks</th></tr>";
    for (let c = 2; c <= 12; c++) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${c}</td><td>${COMBO_POINTS[c]}</td><td>${"|".repeat(comboMarks[c]) || "—"}</td>`;
      comboTable.appendChild(tr);
    }
    const rejectTable = document.getElementById("rejectTable");
    rejectTable.innerHTML = "<tr><th>Face</th><th>Marks</th></tr>";
    for (let r = 1; r <= 6; r++) {
      const tr = document.createElement("tr");
      const locked = usedRejects().length >= 3 && rejectMarks[r] === 0;
      tr.innerHTML = `<td>${r}${locked ? " (closed)" : ""}</td><td>${"|".repeat(rejectMarks[r]) || "—"}</td>`;
      rejectTable.appendChild(tr);
    }
    document.getElementById("score").textContent = scoreNow();
  }

  function renderDice() {
    const row = document.getElementById("diceRow");
    row.innerHTML = "";
    dice.forEach((n, i) => {
      const img = document.createElement("img");
      img.className = "die";
      img.src = dieSrc(n);
      img.alt = `Die ${n}`;
      const slot = pick.indexOf(i);
      if (slot === 0 || slot === 1) img.classList.add("sel-a");
      else if (slot === 2 || slot === 3) img.classList.add("sel-b");
      else if (slot === 4) img.classList.add("sel-r");
      img.addEventListener("click", () => togglePick(i));
      row.appendChild(img);
    });
  }

  function togglePick(i) {
    if (over || !dice.length) return;
    const idx = pick.indexOf(i);
    if (idx >= 0) pick.splice(idx, 1);
    else if (pick.length < 5) pick.push(i);
    document.getElementById("confirm").disabled = pick.length !== 5;
    renderDice();
    updatePickedLabel();
  }

  function updatePickedLabel() {
    const el = document.getElementById("picked");
    if (pick.length < 5) {
      el.textContent = `Selected ${pick.length}/5`;
      return;
    }
    const a = dice[pick[0]] + dice[pick[1]];
    const b = dice[pick[2]] + dice[pick[3]];
    const r = dice[pick[4]];
    el.textContent = `Combos ${a} & ${b}, reject ${r}${freeRide ? " (free ride — reject ignored)" : ""}`;
  }

  function roll() {
    if (over) return;
    dice = Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6));
    pick = [];
    const rejects = usedRejects();
    freeRide = rejects.length === 3 && !dice.some((d) => rejects.includes(d));
    document.getElementById("assign").hidden = false;
    document.getElementById("confirm").disabled = true;
    document.getElementById("rollBtn").disabled = true;
    document.getElementById("status").textContent = freeRide
      ? "Free ride! Split any two combinations; reject is ignored."
      : rejects.length < 3
        ? "Choose two combinations and a reject."
        : `Reject must be one of: ${rejects.join(", ")}`;
    renderDice();
    updatePickedLabel();
  }

  function confirm() {
    if (pick.length !== 5) return;
    const a = dice[pick[0]] + dice[pick[1]];
    const b = dice[pick[2]] + dice[pick[3]];
    const r = dice[pick[4]];
    const rejects = usedRejects();

    if (!freeRide) {
      if (rejects.length >= 3 && !rejects.includes(r)) {
        document.getElementById("status").textContent = `Reject must be ${rejects.join(", ")}.`;
        return;
      }
      if (rejects.length < 3 || rejects.includes(r)) {
        rejectMarks[r] += 1;
      }
    }

    comboMarks[a] += 1;
    comboMarks[b] += 1;

    pick = [];
    dice = [];
    document.getElementById("assign").hidden = true;
    document.getElementById("rollBtn").disabled = false;
    renderDice();
    renderTables();

    const hitEight = Object.values(rejectMarks).some((v) => v >= 8);
    if (hitEight) {
      over = true;
      const s = scoreNow();
      document.getElementById("status").textContent =
        s >= 500 ? `Finished! Score ${s} — you win.` : `Finished! Score ${s}. Try for 500.`;
      document.getElementById("rollBtn").disabled = true;
      document.getElementById("liveNote").textContent = s >= 500 ? "Winner!" : "";
    } else {
      document.getElementById("status").textContent = "Roll again.";
    }
  }

  function newGame() {
    for (let i = 2; i <= 12; i++) comboMarks[i] = 0;
    for (let i = 1; i <= 6; i++) rejectMarks[i] = 0;
    dice = [];
    pick = [];
    over = false;
    freeRide = false;
    document.getElementById("assign").hidden = true;
    document.getElementById("rollBtn").disabled = false;
    document.getElementById("status").textContent = "Roll to begin.";
    document.getElementById("liveNote").textContent = "";
    renderDice();
    renderTables();
  }

  document.getElementById("rollBtn").addEventListener("click", roll);
  document.getElementById("confirm").addEventListener("click", confirm);
  document.getElementById("clearPick").addEventListener("click", () => {
    pick = [];
    document.getElementById("confirm").disabled = true;
    renderDice();
    updatePickedLabel();
  });
  document.getElementById("newGame").addEventListener("click", newGame);
  newGame();
})();
