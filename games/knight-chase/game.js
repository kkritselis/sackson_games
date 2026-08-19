(() => {
  const N = 8;
  const KDELTAS = [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2],
  ];

  let markers; // set of "r,c"
  let markersLeft;
  let black; // [r,c]
  let white;
  let turn; // 'B' | 'W'
  let human; // 'B' | 'W'
  let phase; // 'move' | 'placeExtra' | 'over'
  let pendingFrom;
  let whiteTries;
  let postMarkerMode;

  const boardEl = document.getElementById("board");

  function key(r, c) {
    return `${r},${c}`;
  }

  function occupied(r, c) {
    if (markers.has(key(r, c))) return true;
    if (black[0] === r && black[1] === c) return true;
    if (white[0] === r && white[1] === c) return true;
    return false;
  }

  function knightTargets(r, c) {
    const out = [];
    for (const [dr, dc] of KDELTAS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if (markers.has(key(nr, nc))) continue;
      // Can land on enemy knight (capture) only for white onto black
      if (black[0] === nr && black[1] === nc) {
        if (turn === "W") out.push([nr, nc, true]);
        continue;
      }
      if (white[0] === nr && white[1] === nc) continue;
      out.push([nr, nc, false]);
    }
    return out;
  }

  function reset() {
    markers = new Set();
    markersLeft = 30;
    // Black bottom-right-ish from black's view: row 7 col 7; White row 0 col 0 opposite corners per book "right end of row nearest"
    // Book: each places knight at right end of nearest row → Black at (7,7), White at (0,0) if White is top.
    black = [7, 7];
    white = [0, 0];
    turn = "B";
    human = document.getElementById("side").value === "white" ? "W" : "B";
    phase = "move";
    pendingFrom = null;
    whiteTries = null;
    postMarkerMode = false;
    document.getElementById("status").textContent =
      turn === human ? "Your move — choose a knight landing square." : "Computer thinking…";
    render();
    if (turn !== human) setTimeout(aiTurn, 400);
  }

  function render(highlights = []) {
    document.getElementById("markers").textContent = markersLeft;
    document.getElementById("tries").textContent = whiteTries == null ? "—" : whiteTries;
    boardEl.innerHTML = "";
    const hl = new Set(highlights.map(([r, c]) => key(r, c)));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sq " + ((r + c) % 2 ? "dark" : "light");
        if (hl.has(key(r, c))) btn.classList.add("hl");
        if (markers.has(key(r, c))) {
          const m = document.createElement("span");
          m.className = "marker";
          btn.appendChild(m);
        }
        if (black[0] === r && black[1] === c) {
          const k = document.createElement("span");
          k.className = "knight";
          k.textContent = "♞";
          btn.appendChild(k);
        }
        if (white[0] === r && white[1] === c) {
          const k = document.createElement("span");
          k.className = "knight";
          k.textContent = "♘";
          btn.appendChild(k);
        }
        btn.addEventListener("click", () => onClick(r, c));
        boardEl.appendChild(btn);
      }
    }
  }

  function openSquaresExcept(protectOnlyEscapeFor) {
    // When placing second marker, cannot cover opponent's only legal landing if they have exactly one
    const opp = protectOnlyEscapeFor;
    const [or, oc] = opp === "B" ? black : white;
    const targets = knightTargets.call({ turn: opp }, or, oc);
    // recompute properly
  }

  function oppOnlyEscape(oppTurn) {
    const [r, c] = oppTurn === "B" ? black : white;
    const savedTurn = turn;
    turn = oppTurn;
    const t = knightTargets(r, c).filter((x) => !x[2]);
    turn = savedTurn;
    return t.length === 1 ? t[0] : null;
  }

  function finishIfNeeded(capture) {
    if (capture) {
      phase = "over";
      document.getElementById("status").textContent = "White captures — White wins!";
      render();
      return true;
    }
    return false;
  }

  function afterMoveComplete() {
    if (markersLeft === 0 && !postMarkerMode) {
      postMarkerMode = true;
      whiteTries = 10;
    }
    turn = turn === "B" ? "W" : "B";
    phase = "move";

    // Check immobilization of the player about to move
    const [r, c] = turn === "B" ? black : white;
    const opts = knightTargets(r, c);
    if (!opts.length) {
      phase = "over";
      document.getElementById("status").textContent = "Knight immobilized — Black wins!";
      render();
      return;
    }

    if (postMarkerMode && turn === "W") {
      // whiteTries counts white moves after markers exhausted
    }

    document.getElementById("status").textContent =
      turn === human ? "Your move." : "Computer thinking…";
    render();
    if (phase !== "over" && turn !== human) setTimeout(aiTurn, 350);
  }

  function placeMarkers(from, extra) {
    markers.add(key(from[0], from[1]));
    markersLeft = Math.max(0, markersLeft - 1);
    if (markersLeft > 0 && extra) {
      markers.add(key(extra[0], extra[1]));
      markersLeft = Math.max(0, markersLeft - 1);
    }
  }

  function doMove(toR, toC, extraR, extraC) {
    const from = turn === "B" ? black.slice() : white.slice();
    const capture = turn === "W" && black[0] === toR && black[1] === toC;
    if (turn === "B") black = [toR, toC];
    else white = [toR, toC];

    if (markersLeft > 0) {
      const only = oppOnlyEscape(turn === "B" ? "W" : "B");
      if (only && only[0] === extraR && only[1] === extraC) {
        // illegal extra — revert
        if (turn === "B") black = from;
        else white = from;
        document.getElementById("status").textContent = "Can't block opponent's only escape.";
        return false;
      }
      placeMarkers(from, [extraR, extraC]);
    }

    if (finishIfNeeded(capture)) return true;

    if (postMarkerMode && turn === "W") {
      whiteTries -= 1;
      if (!capture && whiteTries <= 0) {
        phase = "over";
        document.getElementById("status").textContent = "White failed to capture in 10 moves — Black wins!";
        render();
        return true;
      }
    }

    afterMoveComplete();
    return true;
  }

  let selectedDest = null;

  function onClick(r, c) {
    if (phase === "over" || turn !== human) return;
    const [kr, kc] = turn === "B" ? black : white;

    if (phase === "move") {
      const opts = knightTargets(kr, kc);
      const hit = opts.find((o) => o[0] === r && o[1] === c);
      if (!hit) {
        // show highlights
        render(opts.map((o) => [o[0], o[1]]));
        return;
      }
      if (markersLeft <= 0) {
        doMove(r, c, null, null);
        return;
      }
      selectedDest = [r, c, hit[2]];
      phase = "placeExtra";
      document.getElementById("status").textContent = "Place the free marker on an empty square.";
      render([[r, c]]);
      return;
    }

    if (phase === "placeExtra") {
      if (occupied(r, c) && !(selectedDest[2] && black[0] === r && black[1] === c)) {
        // empty only (vacated square will get forced marker separately)
        if (!(r === (turn === "B" ? black[0] : white[0]) && c === (turn === "B" ? black[1] : white[1]))) {
          // allow empty
        }
      }
      const from = turn === "B" ? black : white;
      // Cannot place on destination or current knight squares except empty
      if (markers.has(key(r, c))) return;
      if (r === selectedDest[0] && c === selectedDest[1]) return;
      if (r === white[0] && c === white[1]) return;
      if (r === black[0] && c === black[1]) return;
      const dest = selectedDest;
      selectedDest = null;
      phase = "move";
      doMove(dest[0], dest[1], r, c);
    }
  }

  function aiTurn() {
    if (phase === "over" || turn === human) return;
    const [kr, kc] = turn === "B" ? black : white;
    const opts = knightTargets(kr, kc);
    if (!opts.length) {
      phase = "over";
      document.getElementById("status").textContent = "Knight immobilized — Black wins!";
      render();
      return;
    }

    let choice = opts[0];
    if (turn === "W") {
      const cap = opts.find((o) => o[2]);
      if (cap) choice = cap;
      else {
        // approach black
        opts.sort((a, b) => {
          const da = Math.abs(a[0] - black[0]) + Math.abs(a[1] - black[1]);
          const db = Math.abs(b[0] - black[0]) + Math.abs(b[1] - black[1]);
          return da - db;
        });
        choice = opts[0];
      }
    } else {
      // flee white
      opts.sort((a, b) => {
        const da = Math.abs(a[0] - white[0]) + Math.abs(a[1] - white[1]);
        const db = Math.abs(b[0] - white[0]) + Math.abs(b[1] - white[1]);
        return db - da;
      });
      choice = opts[0];
    }

    let extra = null;
    if (markersLeft > 0) {
      const only = oppOnlyEscape(turn === "B" ? "W" : "B");
      const empties = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (occupied(r, c)) continue;
          if (r === choice[0] && c === choice[1]) continue;
          if (only && only[0] === r && only[1] === c) continue;
          empties.push([r, c]);
        }
      }
      // Prefer placing near opponent to restrict
      const target = turn === "W" ? black : white;
      empties.sort((a, b) => {
        const da = Math.abs(a[0] - target[0]) + Math.abs(a[1] - target[1]);
        const db = Math.abs(b[0] - target[0]) + Math.abs(b[1] - target[1]);
        return da - db;
      });
      extra = empties[0] || [kr, kc]; // fallback shouldn't happen
    }

    doMove(choice[0], choice[1], extra ? extra[0] : null, extra ? extra[1] : null);
  }

  document.getElementById("newGame").addEventListener("click", reset);
  document.getElementById("side").addEventListener("change", reset);
  reset();
})();
