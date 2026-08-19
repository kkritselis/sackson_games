(() => {
  // Grid lettering (Sackson):
  // A B C D
  // E F G H
  // I J K L
  const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const ADJ = {
    A: ["B", "E"],
    B: ["A", "C", "F"],
    C: ["B", "D", "G"],
    D: ["C", "H"],
    E: ["A", "F", "I"],
    F: ["B", "E", "G", "J"],
    G: ["C", "F", "H", "K"],
    H: ["D", "G", "L"],
    I: ["E", "J"],
    J: ["F", "I", "K"],
    K: ["G", "J", "L"],
    L: ["H", "K"]
  };

  const BAG = [
    "penny", "penny", "penny", "penny",
    "dime", "dime", "dime", "dime",
    "nickel", "nickel",
    "quarter"
  ];

  const LABEL = { penny: "1¢", nickel: "5¢", dime: "10¢", quarter: "25¢" };

  const state = {
    board: {}, // label -> coin type or null
    empty: "L",
    moves: 0,
    total: 0,
    boardNum: 1,
    history: [],
    solvedBoards: 0,
    campaignOver: false
  };

  const el = {
    board: document.getElementById("board"),
    status: document.getElementById("status"),
    moves: document.getElementById("moves"),
    total: document.getElementById("total"),
    boardNum: document.getElementById("board-num"),
    campaign: document.getElementById("campaign"),
    btnNew: document.getElementById("btn-new"),
    btnUndo: document.getElementById("btn-undo")
  };

  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function dealBoard() {
    const coins = shuffle(BAG);
    const cells = {};
    LABELS.forEach((lab, i) => {
      if (i < 11) cells[lab] = coins[i];
      else cells[lab] = null;
    });
    // empty always starts at L per book diagram, but after shuffle the empty is wherever we put null
    // Book: place mixed coins then empty at bottom-right. We shuffle 11 coins into first 11 slots, L empty.
    state.board = cells;
    state.empty = "L";
    state.moves = 0;
    state.history = [];
    // Rare: already symmetric — reshuffle
    if (isSymmetric()) dealBoard();
  }

  function isSymmetric() {
    const top = ["A", "B", "C", "D"];
    const mid = ["E", "F", "G", "H"];
    const bot = ["I", "J", "K", "L"];
    // empty and unique (quarter) must be in middle row
    const emptyInMid = mid.includes(state.empty);
    let quarterPos = null;
    for (const lab of LABELS) {
      if (state.board[lab] === "quarter") quarterPos = lab;
    }
    const quarterInMid = mid.includes(quarterPos);
    if (!emptyInMid || !quarterInMid) return false;
    for (let i = 0; i < 4; i++) {
      if (state.board[top[i]] !== state.board[bot[i]]) return false;
    }
    return true;
  }

  function render() {
    el.board.innerHTML = "";
    const movable = new Set(ADJ[state.empty] || []);
    LABELS.forEach((lab) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.setAttribute("aria-label", `Space ${lab}`);
      const coin = state.board[lab];
      if (coin) {
        const c = document.createElement("span");
        c.className = `coin ${coin}`;
        c.textContent = LABEL[coin];
        slot.appendChild(c);
        if (movable.has(lab) && !state.campaignOver) {
          slot.classList.add("movable");
          slot.addEventListener("click", () => moveCoin(lab));
        }
      } else if (movable.size && !state.campaignOver) {
        // empty — show nothing
      }
      el.board.appendChild(slot);
    });
    el.moves.textContent = state.moves;
    el.total.textContent = state.total;
    el.boardNum.textContent = Math.min(state.boardNum, 7);
    el.btnUndo.disabled = state.history.length === 0 || state.campaignOver;
  }

  function moveCoin(from) {
    if (state.campaignOver) return;
    if (!ADJ[state.empty].includes(from)) return;
    state.history.push({ board: { ...state.board }, empty: state.empty, moves: state.moves });
    state.board[state.empty] = state.board[from];
    state.board[from] = null;
    state.empty = from;
    state.moves++;
    state.total++;
    render();
    if (isSymmetric()) {
      onSolved();
    } else {
      el.status.textContent = `Moved from ${from}. Empty at ${state.empty}.`;
    }
  }

  function onSolved() {
    state.solvedBoards++;
    el.status.textContent = `Symmetry! Board ${state.boardNum} solved in ${state.moves} moves.`;
    if (state.boardNum >= 7) {
      state.campaignOver = true;
      const win = state.total <= 100;
      el.campaign.textContent = win
        ? `Campaign complete in ${state.total} moves — you win (≤100)!`
        : `Campaign complete in ${state.total} moves — over 100; try again for a win.`;
      render();
      return;
    }
    setTimeout(() => {
      state.boardNum++;
      dealBoard();
      el.status.textContent = `Board ${state.boardNum} — find symmetry again.`;
      el.campaign.textContent = `Solved ${state.solvedBoards} of 7. Running total: ${state.total} moves.`;
      render();
    }, 900);
  }

  function undo() {
    if (!state.history.length || state.campaignOver) return;
    const prev = state.history.pop();
    // Adjust totals: undoing reduces total by the move we're reverting
    state.total -= state.moves - prev.moves;
    state.board = prev.board;
    state.empty = prev.empty;
    state.moves = prev.moves;
    el.status.textContent = "Undo.";
    render();
  }

  function newCampaign() {
    state.total = 0;
    state.boardNum = 1;
    state.solvedBoards = 0;
    state.campaignOver = false;
    dealBoard();
    el.status.textContent = "Slide an adjacent coin into the empty space.";
    el.campaign.textContent = "Seven boards · win with 100 or fewer total moves.";
    render();
  }

  el.btnNew.addEventListener("click", newCampaign);
  el.btnUndo.addEventListener("click", undo);

  newCampaign();
})();
