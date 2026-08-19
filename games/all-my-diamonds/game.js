(function () {
  const SETS = [
    { id: "spades", label: "All my Spades", test: (c) => c.suit === "Spades" },
    { id: "hearts", label: "All my Hearts", test: (c) => c.suit === "Hearts" },
    { id: "diamonds", label: "All my Diamonds", test: (c) => c.suit === "Diamonds" },
    { id: "clubs", label: "All my Clubs", test: (c) => c.suit === "Clubs" },
    { id: "pictures", label: "All my Pictures", test: (c) => ["J", "Q", "K"].includes(c.rank) },
    { id: "high", label: "All my Highs", test: (c) => ["7", "8", "9"].includes(c.rank) },
    { id: "middle", label: "All my Middles", test: (c) => ["4", "5", "6"].includes(c.rank) },
    { id: "low", label: "All my Lows", test: (c) => ["A", "2", "3"].includes(c.rank) }
  ];

  const NAMES = ["You", "Alex", "Blair", "Casey"];
  const CHIP = "../../assets/Chips/chipWhite.png";
  const CHIP_BLUE = "../../assets/Chips/chipBlue.png";

  let state;

  function deck48() {
    return Cards.deckWithout((c) => c.rank === "10");
  }

  function newHand() {
    const deck = Cards.shuffle(deck48());
    const players = NAMES.map((name, i) => ({
      name,
      isHuman: i === 0,
      chips: 80,
      hand: []
    }));
    let i = 0;
    while (deck.length) {
      players[i % 4].hand.push(deck.pop());
      i++;
    }
    players.forEach((p) => sortHand(p.hand));
    const ante = 15;
    players.forEach((p) => { p.chips -= ante; });
    state = {
      players,
      pool: ante * 4,
      turn: 1 % 4,
      dealer: 0,
      phase: "auction",
      selling: null,
      selectedSet: null,
      poolsWon: 0,
      message: "Alex opens the auction."
    };
    maybeAiTurn();
    render();
  }

  function sortHand(hand) {
    const suitOrder = { Spades: 0, Hearts: 1, Diamonds: 2, Clubs: 3 };
    hand.sort((a, b) => suitOrder[a.suit] - suitOrder[b.suit] || a.value - b.value);
  }

  function cardsInSet(hand, set) {
    return hand.filter(set.test);
  }

  function countInSet(hand, setId) {
    const set = SETS.find((s) => s.id === setId);
    return hand.filter(set.test).length;
  }

  function taxFor(n, price) {
    if (n <= 0) return price;
    return Math.floor(price / n);
  }

  function startSale(playerIdx, setId) {
    const p = state.players[playerIdx];
    const set = SETS.find((s) => s.id === setId);
    const cards = cardsInSet(p.hand, set);
    if (!cards.length) return;
    state.selling = {
      seller: playerIdx,
      setId,
      label: set.label,
      cards: cards.slice(),
      bid: 0,
      bidder: null,
      next: (playerIdx + 1) % 4,
      passed: {}
    };
    p.hand = p.hand.filter((c) => !set.test(c));
    state.message = p.name + " auctions: " + set.label + " (" + cards.length + ").";
    continueBidding();
  }

  function continueBidding() {
    const a = state.selling;
    if (!a) return;
    let safety = 0;
    while (safety++ < 20) {
      const alive = state.players.filter((_, i) => i !== a.seller && !a.passed[i]);
      if (!alive.length) {
        settleAuction(0, null);
        return;
      }
      if (a.bidder != null && alive.every((p) => state.players.indexOf(p) === a.bidder || a.passed[state.players.indexOf(p)])) {
        settleAuction(a.bid, a.bidder);
        return;
      }
      while (a.next === a.seller || a.passed[a.next]) {
        a.next = (a.next + 1) % 4;
        if (a.next === a.seller) break;
      }
      const bidder = a.next;
      if (bidder === a.seller || a.passed[bidder]) {
        settleAuction(a.bid || 0, a.bidder);
        return;
      }
      if (state.players[bidder].isHuman) {
        state.phase = "bid";
        render();
        return;
      }
      aiBid(bidder);
    }
  }

  function aiBid(idx) {
    const a = state.selling;
    const p = state.players[idx];
    const n = a.cards.length;
    let want = 0;
    a.cards.forEach((c) => {
      SETS.forEach((s) => {
        if (s.test(c)) {
          const after = countInSet(p.hand, s.id) + a.cards.filter(s.test).length;
          want = Math.max(want, after);
        }
      });
    });
    const maxBid = Math.min(p.chips, Math.max(1, Math.floor(want * 1.5 + n)));
    const raiseTo = a.bid + 1 + Math.floor(Math.random() * 2);
    if (want >= 7 && raiseTo <= maxBid) {
      a.bid = raiseTo;
      a.bidder = idx;
      state.message = p.name + " bids " + a.bid + ".";
    } else if (want >= 5 && a.bid === 0 && maxBid >= 1) {
      a.bid = 1;
      a.bidder = idx;
      state.message = p.name + " bids 1.";
    } else {
      a.passed[idx] = true;
      state.message = p.name + " passes.";
    }
    a.next = (idx + 1) % 4;
  }

  function humanBid(amount) {
    const a = state.selling;
    if (!a || state.phase !== "bid") return;
    const me = 0;
    if (amount === null) {
      a.passed[me] = true;
      state.message = "You pass.";
    } else {
      if (amount <= a.bid || amount > state.players[0].chips) return;
      a.bid = amount;
      a.bidder = me;
      state.message = "You bid " + amount + ".";
    }
    a.next = (me + 1) % 4;
    state.phase = "auction";
    continueBidding();
    render();
  }

  function settleAuction(price, winnerIdx) {
    const a = state.selling;
    const seller = state.players[a.seller];
    const n = a.cards.length;
    if (winnerIdx == null || price <= 0) {
      // No bid — cards return to seller
      seller.hand.push(...a.cards);
      sortHand(seller.hand);
      state.message = "No bids. Cards return to " + seller.name + ".";
    } else {
      const buyer = state.players[winnerIdx];
      const tax = taxFor(n, price);
      buyer.chips -= price;
      seller.chips += price - tax;
      state.pool += tax;
      buyer.hand.push(...a.cards);
      sortHand(buyer.hand);
      state.message = buyer.name + " buys for " + price + " (tax " + tax + " to pool).";
      checkPoolWin(winnerIdx);
    }
    if (!seller.hand.length && state.poolsWon < 2) {
      seller.chips = Math.max(0, seller.chips - 2);
      state.pool += 2;
      state.message += " Empty-hand penalty: " + seller.name + " pays 2.";
    }
    state.selling = null;
    state.phase = "auction";
    if (state.poolsWon >= 2) {
      state.phase = "done";
      state.message += " Hand over.";
      render();
      return;
    }
    state.turn = (a.seller + 1) % 4;
    maybeAiTurn();
    render();
  }

  function checkPoolWin(idx) {
    const p = state.players[idx];
    for (const set of SETS) {
      const cards = cardsInSet(p.hand, set);
      if (cards.length >= 10) {
        if (state.poolsWon === 0) {
          const take = Math.min(60, state.pool);
          state.pool -= take;
          p.chips += take;
          p.hand = p.hand.filter((c) => !set.test(c));
          state.poolsWon = 1;
          state.message += " " + p.name + " wins first pool (+" + take + ") with " + set.label + "!";
        } else {
          p.chips += state.pool;
          state.message += " " + p.name + " wins remaining pool (+" + state.pool + ")!";
          state.pool = 0;
          state.poolsWon = 2;
        }
        return;
      }
    }
  }

  function maybeAiTurn() {
    if (state.phase === "done" || state.phase === "bid") return;
    const p = state.players[state.turn];
    if (p.isHuman) {
      state.message = "Your turn — auction a set.";
      render();
      return;
    }
    if (!p.hand.length) {
      p.chips = Math.max(0, p.chips - 2);
      state.pool += 2;
      state.turn = (state.turn + 1) % 4;
      setTimeout(maybeAiTurn, 200);
      return;
    }
    setTimeout(() => {
      const options = SETS.map((s) => ({ s, cards: cardsInSet(p.hand, s) })).filter((o) => o.cards.length);
      options.sort((a, b) => a.cards.length - b.cards.length);
      const pick = options[Math.floor(Math.random() * Math.min(3, options.length))];
      startSale(state.turn, pick.s.id);
      render();
    }, 450);
  }

  function render() {
    const $ = (id) => document.getElementById(id);
    $("status").textContent = state.message + " Pool: " + state.pool + ".";
    $("bank").innerHTML = state.players.map((p) =>
      "<span><img src=\"" + (p.isHuman ? CHIP_BLUE : CHIP) + "\" alt=\"\" width=\"16\" height=\"16\" /> " +
      p.name + ": " + p.chips + " · " + p.hand.length + " cards</span>"
    ).join("");

    const sellArea = $("sell-area");
    const auctionArea = $("auction-area");
    const humanTurn = state.phase === "auction" && state.players[state.turn].isHuman && !state.selling;

    sellArea.hidden = !humanTurn;
    auctionArea.hidden = !(state.phase === "bid" && state.selling);

    if (humanTurn) {
      const hand = state.players[0].hand;
      const btns = $("set-buttons");
      btns.innerHTML = "";
      state.selectedSet = state.selectedSet || null;
      SETS.forEach((s) => {
        const cards = cardsInSet(hand, s);
        if (!cards.length) return;
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = s.label + " (" + cards.length + ")";
        if (state.selectedSet === s.id) b.classList.add("primary");
        b.onclick = () => {
          state.selectedSet = s.id;
          render();
        };
        btns.appendChild(b);
      });
      const preview = $("preview");
      preview.innerHTML = "";
      if (state.selectedSet) {
        cardsInSet(hand, SETS.find((s) => s.id === state.selectedSet)).forEach((c) => {
          preview.appendChild(Cards.imgEl(c, { small: true }));
        });
      }
      const sellBtn = $("btn-sell");
      sellBtn.disabled = !state.selectedSet;
      sellBtn.onclick = () => {
        if (!state.selectedSet) return;
        const id = state.selectedSet;
        state.selectedSet = null;
        startSale(0, id);
        render();
      };
    }

    if (state.phase === "bid" && state.selling) {
      const a = state.selling;
      $("auction-cards").innerHTML = "";
      a.cards.forEach((c) => $("auction-cards").appendChild(Cards.imgEl(c)));
      $("auction-info").textContent =
        state.players[a.seller].name + ": " + a.label + " · current bid " + a.bid +
        (a.bidder != null ? " by " + state.players[a.bidder].name : "");
      const ctrl = $("bid-controls");
      ctrl.innerHTML = "";
      const pass = document.createElement("button");
      pass.type = "button";
      pass.textContent = "Pass";
      pass.onclick = () => humanBid(null);
      ctrl.appendChild(pass);
      [1, 2, 3, 5].forEach((d) => {
        const amt = a.bid + d;
        if (amt > state.players[0].chips) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "primary";
        b.textContent = "Bid " + amt;
        b.onclick = () => humanBid(amt);
        ctrl.appendChild(b);
      });
    }

    const handEl = $("hand");
    handEl.innerHTML = "";
    state.players[0].hand.forEach((c) => handEl.appendChild(Cards.imgEl(c, { small: true })));
    $("hand-count").textContent = String(state.players[0].hand.length);

    const opp = $("opponents");
    opp.innerHTML = "<h2>Opponents</h2>";
    state.players.slice(1).forEach((p) => {
      const d = document.createElement("div");
      d.className = "opp";
      d.innerHTML = "<strong>" + p.name + "</strong> · " + p.hand.length + " cards · " + p.chips + " chips";
      for (let i = 0; i < Math.min(p.hand.length, 12); i++) {
        d.appendChild(Cards.imgEl(p.hand[i], { faceDown: true, small: true }));
      }
      opp.appendChild(d);
    });
  }

  document.getElementById("btn-new").onclick = newHand;
  newHand();
})();
