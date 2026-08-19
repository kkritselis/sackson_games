(() => {
  const N = 8;
  const NEED = 16;
  const ORTH = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  const statusEl = document.getElementById("status");
  const ownEl = document.getElementById("own");
  const reconEl = document.getElementById("recon");
  const logEl = document.getElementById("log");
  const countsEl = document.getElementById("own-counts");

  let brush = 1;
  let own = Array(64).fill(0);
  let aiMap = Array(64).fill(0);
  let recon = Array(64).fill(0);
  let phase = "setup"; // setup | play | done
  let probeAnchor = null;
  let humanFirst = true;
  let awaitingFinal = false;
  let log = [];

  function idx(r, c) { return r * N + c; }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  function counts(map) {
    const c = [0, 0, 0, 0, 0];
    for (const v of map) if (v) c[v]++;
    return c;
  }

  function contiguous(map, seg) {
    const cells = [];
    for (let i = 0; i < 64; i++) if (map[i] === seg) cells.push(i);
    if (cells.length !== NEED) return false;
    const seen = new Set([cells[0]]);
    const q = [cells[0]];
    while (q.length) {
      const cur = q.pop();
      const r = Math.floor(cur / N), c = cur % N;
      for (const [dr, dc] of ORTH) {
        const rr = r + dr, cc = c + dc;
        if (!inB(rr, cc)) continue;
        const i = idx(rr, cc);
        if (map[i] !== seg || seen.has(i)) continue;
        seen.add(i);
        q.push(i);
      }
    }
    return seen.size === cells.length;
  }

  function validMap(map) {
    const c = counts(map);
    if (c[1] !== NEED || c[2] !== NEED || c[3] !== NEED || c[4] !== NEED) return false;
    return [1, 2, 3, 4].every((s) => contiguous(map, s));
  }

  function generateAIMap() {
    // Quadrant-ish irregular sectors via flood growth
    for (let attempt = 0; attempt < 80; attempt++) {
      const map = Array(64).fill(0);
      const seeds = [
        idx(1, 1), idx(1, 6), idx(6, 1), idx(6, 6),
      ];
      // shuffle seed assignment
      const segs = [1, 2, 3, 4];
      for (let i = segs.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [segs[i], segs[j]] = [segs[j], segs[i]];
      }
      const frontiers = segs.map((s, k) => {
        map[seeds[k]] = s;
        return [seeds[k]];
      });
      let filled = 4;
      while (filled < 64) {
        const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        let progressed = false;
        for (const fi of order) {
          if (counts(map)[segs[fi]] >= NEED) continue;
          const frontier = frontiers[fi];
          const candidates = [];
          for (const cell of frontier) {
            const r = Math.floor(cell / N), c = cell % N;
            for (const [dr, dc] of ORTH) {
              const rr = r + dr, cc = c + dc;
              if (!inB(rr, cc)) continue;
              const i = idx(rr, cc);
              if (map[i] === 0) candidates.push(i);
            }
          }
          if (!candidates.length) continue;
          const pick = candidates[(Math.random() * candidates.length) | 0];
          map[pick] = segs[fi];
          frontier.push(pick);
          filled++;
          progressed = true;
          if (filled >= 64) break;
        }
        if (!progressed) break;
      }
      // fill leftovers
      for (let i = 0; i < 64; i++) {
        if (map[i]) continue;
        const r = Math.floor(i / N), c = i % N;
        let best = 1, bestN = -1;
        for (const s of [1, 2, 3, 4]) {
          if (counts(map)[s] >= NEED) continue;
          let n = 0;
          for (const [dr, dc] of ORTH) {
            if (inB(r + dr, c + dc) && map[idx(r + dr, c + dc)] === s) n++;
          }
          if (n > bestN) { bestN = n; best = s; }
        }
        map[i] = best;
      }
      // rebalance sizes by stealing
      for (let guard = 0; guard < 200; guard++) {
        const c = counts(map);
        const over = [1, 2, 3, 4].find((s) => c[s] > NEED);
        const under = [1, 2, 3, 4].find((s) => c[s] < NEED);
        if (!over || !under) break;
        let moved = false;
        for (let i = 0; i < 64; i++) {
          if (map[i] !== over) continue;
          const r = Math.floor(i / N), c = i % N;
          const nearUnder = ORTH.some(([dr, dc]) => inB(r + dr, c + dc) && map[idx(r + dr, c + dc)] === under);
          if (!nearUnder) continue;
          map[i] = under;
          moved = true;
          break;
        }
        if (!moved) break;
      }
      if (validMap(map)) return map;
    }
    // fallback: four 4x4 blocks
    const map = Array(64).fill(0);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const s = (r < 4 ? 0 : 2) + (c < 4 ? 1 : 2);
      map[idx(r, c)] = s;
    }
    return map;
  }

  function query(map, r, c) {
    // 2x2 with top-left r,c
    const tally = {};
    for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) {
      const v = map[idx(r + dr, c + dc)];
      tally[v] = (tally[v] || 0) + 1;
    }
    return tally;
  }

  function formatTally(t) {
    return [1, 2, 3, 4]
      .filter((s) => t[s])
      .map((s) => `${t[s]} in ${["", "I", "II", "III", "IV"][s]}`)
      .join(", ");
  }

  function paintOwn() {
    ownEl.innerHTML = "";
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement("div");
      cell.className = "cell" + (own[i] ? ` s${own[i]}` : "");
      cell.textContent = own[i] ? ["", "I", "II", "III", "IV"][own[i]] : "";
      cell.addEventListener("click", () => {
        if (phase !== "setup") return;
        own[i] = brush;
        renderAll();
      });
      ownEl.appendChild(cell);
    }
    const c = counts(own);
    countsEl.textContent = `I:${c[1]} II:${c[2]} III:${c[3]} IV:${c[4]} (need 16 each)`;
  }

  function paintRecon() {
    reconEl.innerHTML = "";
    const anchor = probeAnchor;
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / N), c = i % N;
      const cell = document.createElement("div");
      cell.className = "cell" + (recon[i] ? ` s${recon[i]}` : "");
      if (anchor != null) {
        const ar = Math.floor(anchor / N), ac = anchor % N;
        if (r >= ar && r <= ar + 1 && c >= ac && c <= ac + 1) cell.classList.add("probe");
      }
      cell.textContent = recon[i] ? ["", "I", "II", "III", "IV"][recon[i]] : "";
      cell.addEventListener("click", (e) => {
        if (phase !== "play") return;
        // paint guess OR set probe anchor (top-left of 2x2)
        if (e.shiftKey || e.altKey) {
          recon[i] = brush;
        } else {
          if (r > 6 || c > 6) return;
          probeAnchor = i;
        }
        renderAll();
      });
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (phase !== "play") return;
        recon[i] = brush;
        renderAll();
      });
      reconEl.appendChild(cell);
    }
  }

  function renderAll() {
    paintOwn();
    paintRecon();
    logEl.textContent = log.slice(-8).join("\n");
    document.getElementById("probe").disabled = phase !== "play" || probeAnchor == null;
    document.getElementById("submit").disabled = phase !== "play" || !validMap(recon);
    document.getElementById("lock-map").disabled = phase !== "setup";
  }

  function aiProbeAndMaybeGuess() {
    // Random useful 2x2 probe on player's map
    const r = (Math.random() * 7) | 0;
    const c = (Math.random() * 7) | 0;
    const t = query(own, r, c);
    log.push(`AI probes ${"ABCDEFGH"[r]}${"ABCDEFGH"[r + 1]}-${c + 1}${c + 2}: ${formatTally(t)}`);
    // AI "guess" rarely when enough probes — simplify: after 8 probes try random correct chance
    if (log.filter((l) => l.startsWith("AI")).length >= 10 && Math.random() < 0.25) {
      // AI submits correct map
      phase = "done";
      statusEl.textContent = "AI reconstructed your map and wins.";
      renderAll();
      return true;
    }
    return false;
  }

  document.querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      brush = +btn.dataset.seg;
      document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  document.getElementById("lock-map").addEventListener("click", () => {
    if (!validMap(own)) {
      statusEl.textContent = "Each sector needs 16 orthogonally connected cells.";
      return;
    }
    aiMap = generateAIMap();
    phase = "play";
    humanFirst = Math.random() < 0.5;
    statusEl.textContent = humanFirst
      ? "Your probe. Click a cell as top-left of a 2×2, then Probe. Right-click/Shift-click to paint your guess."
      : "AI probes first…";
    renderAll();
    if (!humanFirst) {
      setTimeout(() => {
        aiProbeAndMaybeGuess();
        statusEl.textContent = "Your turn to probe.";
        renderAll();
      }, 400);
    }
  });

  document.getElementById("probe").addEventListener("click", () => {
    if (phase !== "play" || probeAnchor == null) return;
    const r = Math.floor(probeAnchor / N);
    const c = probeAnchor % N;
    const t = query(aiMap, r, c);
    log.push(`You: ${"ABCDEFGH"[r]}${"ABCDEFGH"[r + 1]}-${c + 1}${c + 2} → ${formatTally(t)}`);
    probeAnchor = null;
    if (awaitingFinal) {
      awaitingFinal = false;
      statusEl.textContent = "Final probes done — submit guesses when ready.";
      renderAll();
      return;
    }
    if (aiProbeAndMaybeGuess()) return;
    statusEl.textContent = "Paint your reconstruction (right-click cells), or probe again.";
    renderAll();
  });

  document.getElementById("submit").addEventListener("click", () => {
    if (phase !== "play" || !validMap(recon)) return;
    const correct = recon.every((v, i) => v === aiMap[i]);
    // If human was first to declare, AI gets one more call — simplified: if humanFirst and not awaiting
    if (humanFirst && !awaitingFinal && correct) {
      awaitingFinal = true;
      statusEl.textContent = "You declared — AI gets one more probe, then results.";
      setTimeout(() => {
        aiProbeAndMaybeGuess();
        phase = "done";
        statusEl.textContent = correct ? "Your reconstruction is correct — you win!" : "Incorrect reconstruction.";
        // reveal
        recon = aiMap.slice();
        renderAll();
      }, 500);
      return;
    }
    phase = "done";
    statusEl.textContent = correct ? "Exact match — you win!" : "Wrong pattern — AI wins.";
    recon = aiMap.slice();
    renderAll();
  });

  function newGame() {
    brush = 1;
    own = Array(64).fill(0);
    recon = Array(64).fill(0);
    aiMap = Array(64).fill(0);
    phase = "setup";
    probeAnchor = null;
    awaitingFinal = false;
    log = [];
    statusEl.textContent = "Paint four continuous 16-cell sectors, then lock.";
    document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.seg === "1"));
    renderAll();
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  newGame();
})();
