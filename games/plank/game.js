(() => {
  // Three patterns × 4 = 12 planks (RWB permutations with distinct centers)
  const PATTERNS = [
    ["red", "white", "blue"],
    ["blue", "red", "white"],
    ["white", "blue", "red"],
  ];

  const el = {
    status: document.getElementById("status"),
    youPlanks: document.getElementById("you-planks"),
    aiPlanks: document.getElementById("ai-planks"),
    youMarkers: document.getElementById("you-markers"),
    board: document.getElementById("board"),
    btnNew: document.getElementById("btn-new"),
  };

  let state = null;
  let selectedPlank = null;
  let selectedMarker = null; // {color} from reserve OR {id} on board for move

  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  function makePlanks() {
    const all = [];
    let id = 0;
    for (const pat of PATTERNS) {
      for (let n = 0; n < 4; n++) {
        all.push({ id: "p" + id++, colors: pat.slice() });
      }
    }
    return shuffle(all);
  }

  function makeMarkers(owner) {
    const colors = ["red", "red", "white", "white", "blue", "blue"];
    return colors.map((c, i) => ({ id: owner + "-" + c + i, color: c, owner, placed: null }));
  }

  function newGame() {
    const planks = makePlanks();
    state = {
      youPlanks: planks.slice(0, 6),
      aiPlanks: planks.slice(6, 12),
      youMarkers: makeMarkers("you"),
      aiMarkers: makeMarkers("ai"),
      rows: [], // array of plank refs on board (stacked vertically = long sides touching)
      turn: "you",
      over: false,
      phase: "place", // place until all markers down, then move
    };
    selectedPlank = null;
    selectedMarker = null;
    setStatus("Lay a plank and place a matching marker, or add a marker to the board.");
    render();
  }

  function setStatus(m) { el.status.textContent = m; }

  function markersLeft(side) {
    return (side === "you" ? state.youMarkers : state.aiMarkers).filter((m) => !m.placed);
  }

  function allMarkersPlaced(side) {
    return markersLeft(side).length === 0;
  }

  function cellOccupied(rowIdx, col) {
    for (const m of [...state.youMarkers, ...state.aiMarkers]) {
      if (m.placed && m.placed.row === rowIdx && m.placed.col === col) return m;
    }
    return null;
  }

  function checkWin(side) {
    const marks = (side === "you" ? state.youMarkers : state.aiMarkers).filter((m) => m.placed);
    if (marks.length < 3) return false;
    // Across one plank: three cols same row, colors R+W+B
    for (let r = 0; r < state.rows.length; r++) {
      const onRow = marks.filter((m) => m.placed.row === r);
      if (onRow.length === 3) {
        const cols = onRow.map((m) => m.placed.col).sort().join("");
        if (cols === "012") {
          const set = new Set(onRow.map((m) => m.color));
          if (set.has("red") && set.has("white") && set.has("blue")) return true;
        }
      }
    }
    // Lengthwise over three planks: same col, three consecutive rows
    for (let c = 0; c < 3; c++) {
      for (let r0 = 0; r0 + 2 < state.rows.length; r0++) {
        const trio = [];
        for (let k = 0; k < 3; k++) {
          const m = marks.find((x) => x.placed.row === r0 + k && x.placed.col === c);
          if (m) trio.push(m);
        }
        if (trio.length === 3) {
          const set = new Set(trio.map((m) => m.color));
          if (set.has("red") && set.has("white") && set.has("blue")) return true;
        }
      }
    }
    return false;
  }

  function placeNewPlank(side, plank, color) {
    const left = markersLeft(side);
    const marker = left.find((m) => m.color === color);
    if (!marker) return false;
    if (!plank.colors.includes(color)) return false;
    const col = plank.colors.indexOf(color);
    // remove from rack
    const rack = side === "you" ? state.youPlanks : state.aiPlanks;
    const idx = rack.findIndex((p) => p.id === plank.id);
    if (idx < 0) return false;
    rack.splice(idx, 1);
    const rowIdx = state.rows.length;
    state.rows.push(plank);
    marker.placed = { row: rowIdx, col };
    return true;
  }

  function placeOnExisting(side, rowIdx, col) {
    const plank = state.rows[rowIdx];
    if (!plank) return false;
    const color = plank.colors[col];
    if (cellOccupied(rowIdx, col)) return false;
    const left = markersLeft(side);
    const marker = left.find((m) => m.color === color);
    if (!marker) return false;
    marker.placed = { row: rowIdx, col };
    return true;
  }

  function moveMarker(marker, rowIdx, col) {
    const plank = state.rows[rowIdx];
    if (!plank) return false;
    if (plank.colors[col] !== marker.color) return false;
    if (cellOccupied(rowIdx, col) && cellOccupied(rowIdx, col).id !== marker.id) return false;
    marker.placed = { row: rowIdx, col };
    return true;
  }

  function afterMove(side) {
    if (checkWin(side)) {
      state.over = true;
      setStatus(side === "you" ? "You win — red, white, and blue in a line!" : "Computer wins!");
      render();
      return;
    }
    state.turn = side === "you" ? "ai" : "you";
    selectedPlank = null;
    selectedMarker = null;
    if (state.turn === "ai") {
      setStatus("Computer thinking…");
      render();
      setTimeout(aiTurn, 450);
    } else {
      setStatus(allMarkersPlaced("you") ? "Move one of your markers (or lay a remaining plank with a move)." : "Your turn.");
      render();
    }
  }

  function aiTurn() {
    if (state.over) return;
    const left = markersLeft("ai");
    const rack = state.aiPlanks;

    // Try win / block heuristics
    if (left.length) {
      // Prefer place on existing threat or new plank
      for (let r = 0; r < state.rows.length; r++) {
        for (let c = 0; c < 3; c++) {
          if (cellOccupied(r, c)) continue;
          const color = state.rows[r].colors[c];
          if (!left.some((m) => m.color === color)) continue;
          // score: prefer completing diversity on a row
          placeOnExisting("ai", r, c);
          afterMove("ai");
          return;
        }
      }
      if (rack.length) {
        const plank = rack[0];
        const color = left.find((m) => plank.colors.includes(m.color)).color;
        placeNewPlank("ai", plank, color);
        afterMove("ai");
        return;
      }
    }

    // Move phase
    const marks = state.aiMarkers.filter((m) => m.placed);
    // Try every move for a win
    for (const m of marks) {
      for (let r = 0; r < state.rows.length; r++) {
        for (let c = 0; c < 3; c++) {
          if (state.rows[r].colors[c] !== m.color) continue;
          const occ = cellOccupied(r, c);
          if (occ && occ.id !== m.id) continue;
          const old = { ...m.placed };
          m.placed = { row: r, col: c };
          if (checkWin("ai")) {
            afterMove("ai");
            return;
          }
          m.placed = old;
        }
      }
      if (rack.length) {
        // try new plank + move onto it conceptually: place plank then move marker onto it
      }
    }

    // Lay plank if any then move onto it
    if (rack.length && marks.length) {
      const plank = rack[Math.floor(Math.random() * rack.length)];
      const m = marks.find((x) => plank.colors.includes(x.color)) || marks[0];
      const col = plank.colors.indexOf(m.color);
      if (col >= 0) {
        const idx = rack.findIndex((p) => p.id === plank.id);
        rack.splice(idx, 1);
        const rowIdx = state.rows.length;
        state.rows.push(plank);
        m.placed = { row: rowIdx, col };
        afterMove("ai");
        return;
      }
    }

    // Random legal move
    for (const m of shuffle(marks)) {
      for (let r = 0; r < state.rows.length; r++) {
        for (let c = 0; c < 3; c++) {
          if (state.rows[r].colors[c] !== m.color) continue;
          const occ = cellOccupied(r, c);
          if (occ) continue;
          m.placed = { row: r, col: c };
          afterMove("ai");
          return;
        }
      }
    }
    setStatus("Computer passes.");
    state.turn = "you";
    render();
  }

  function renderMiniPlank(plank, selectable) {
    const div = document.createElement("div");
    div.className = "mini-plank" + (selectedPlank === plank.id ? " selected" : "");
    plank.colors.forEach((c) => {
      const cell = document.createElement("div");
      cell.className = "cell color-" + c;
      div.appendChild(cell);
    });
    if (selectable) {
      div.addEventListener("click", () => {
        if (state.turn !== "you" || state.over) return;
        selectedPlank = plank.id;
        selectedMarker = null;
        setStatus("Selected a plank — click a matching unused marker color chip, then the board edge will place it.");
        // Auto: if only one color available matching, wait for marker click
        render();
      });
    }
    return div;
  }

  function render() {
    el.youPlanks.innerHTML = "";
    state.youPlanks.forEach((p) => el.youPlanks.appendChild(renderMiniPlank(p, true)));
    el.aiPlanks.innerHTML = "";
    state.aiPlanks.forEach((p) => el.aiPlanks.appendChild(renderMiniPlank(p, false)));

    el.youMarkers.innerHTML = "";
    markersLeft("you").forEach((m) => {
      const chip = document.createElement("span");
      chip.className = "marker-chip color-" + m.color;
      chip.title = m.color;
      chip.addEventListener("click", () => {
        if (state.turn !== "you" || state.over) return;
        selectedMarker = { type: "reserve", color: m.color, id: m.id };
        if (selectedPlank) {
          const plank = state.youPlanks.find((p) => p.id === selectedPlank);
          if (plank && plank.colors.includes(m.color)) {
            placeNewPlank("you", plank, m.color);
            afterMove("you");
            return;
          }
        }
        setStatus("Marker ready — click an empty matching square on the board.");
        render();
      });
      el.youMarkers.appendChild(chip);
    });

    el.board.innerHTML = "";
    const col = document.createElement("div");
    col.className = "plank-row";

    state.rows.forEach((plank, ri) => {
      const row = document.createElement("div");
      row.className = "board-plank";
      plank.colors.forEach((color, ci) => {
        const sq = document.createElement("div");
        sq.className = "sq color-" + color;
        const occ = cellOccupied(ri, ci);
        if (occ) {
          const piece = document.createElement("div");
          piece.className = "piece " + occ.owner + " color-" + occ.color;
          piece.textContent = occ.owner === "you" ? "A" : "B";
          if (selectedMarker && selectedMarker.type === "board" && selectedMarker.id === occ.id) {
            piece.classList.add("selected");
          }
          if (occ.owner === "you" && allMarkersPlaced("you")) {
            piece.style.cursor = "pointer";
            piece.addEventListener("click", (e) => {
              e.stopPropagation();
              if (state.turn !== "you" || state.over) return;
              selectedMarker = { type: "board", id: occ.id };
              selectedPlank = null;
              setStatus("Move this marker to a matching empty square (or onto a new plank).");
              render();
            });
          }
          sq.appendChild(piece);
        }

        sq.addEventListener("click", () => onSquare(ri, ci, color));
        row.appendChild(sq);
      });
      col.appendChild(row);
    });

    // Drop zone for new plank below
    if (state.turn === "you" && !state.over && selectedPlank && selectedMarker && selectedMarker.type === "reserve") {
      const hint = document.createElement("p");
      hint.style.color = "#f0d78c";
      hint.style.fontSize = "0.85rem";
      hint.textContent = "Click a reserve marker that matches the plank (auto-places), or click a board square.";
      el.board.appendChild(hint);
    }

    el.board.appendChild(col);

    // Button to confirm placing selected plank with selected color if both set
    if (
      state.turn === "you" &&
      !state.over &&
      selectedPlank &&
      selectedMarker &&
      selectedMarker.type === "reserve"
    ) {
      const plank = state.youPlanks.find((p) => p.id === selectedPlank);
      if (plank && plank.colors.includes(selectedMarker.color)) {
        // show clickable append strip
        const add = document.createElement("button");
        add.className = "btn";
        add.style.marginTop = "0.75rem";
        add.textContent = "Place plank here with " + selectedMarker.color + " marker";
        add.addEventListener("click", () => {
          placeNewPlank("you", plank, selectedMarker.color);
          afterMove("you");
        });
        el.board.appendChild(add);
      }
    }

    // New plank while moving
    if (
      state.turn === "you" &&
      !state.over &&
      allMarkersPlaced("you") &&
      selectedMarker &&
      selectedMarker.type === "board" &&
      selectedPlank
    ) {
      const plank = state.youPlanks.find((p) => p.id === selectedPlank);
      const marker = state.youMarkers.find((m) => m.id === selectedMarker.id);
      if (plank && marker && plank.colors.includes(marker.color)) {
        const add = document.createElement("button");
        add.className = "btn";
        add.style.marginTop = "0.75rem";
        add.textContent = "Lay plank and move marker onto it";
        add.addEventListener("click", () => {
          const col = plank.colors.indexOf(marker.color);
          const idx = state.youPlanks.findIndex((p) => p.id === plank.id);
          state.youPlanks.splice(idx, 1);
          const rowIdx = state.rows.length;
          state.rows.push(plank);
          marker.placed = { row: rowIdx, col };
          afterMove("you");
        });
        el.board.appendChild(add);
      }
    }
  }

  function onSquare(ri, ci, color) {
    if (state.turn !== "you" || state.over) return;

    if (!allMarkersPlaced("you") && selectedMarker && selectedMarker.type === "reserve") {
      if (selectedMarker.color !== color) {
        setStatus("Marker color must match the square.");
        return;
      }
      if (placeOnExisting("you", ri, ci)) {
        afterMove("you");
      }
      return;
    }

    if (allMarkersPlaced("you") && selectedMarker && selectedMarker.type === "board") {
      const marker = state.youMarkers.find((m) => m.id === selectedMarker.id);
      if (!marker) return;
      if (moveMarker(marker, ri, ci)) afterMove("you");
      else setStatus("Illegal square for that marker.");
    }
  }

  el.btnNew.addEventListener("click", newGame);
  newGame();
})();
