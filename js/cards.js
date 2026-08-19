/** Shared card helpers for Sackson browser games. Paths relative to games/<id>/. */
(function (global) {
  const SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"];
  const SUIT_SHORT = { Spades: "S", Hearts: "H", Diamonds: "D", Clubs: "C" };
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const RANK_VALUE = {
    A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "10": 10, J: 11, Q: 12, K: 13
  };
  const CARD_BASE = "../../assets/Cards/";
  const BACK = CARD_BASE + "cardBack_blue1.png";

  function cardId(suit, rank) {
    return rank + SUIT_SHORT[suit];
  }

  function makeCard(suit, rank) {
    return {
      suit,
      rank,
      id: cardId(suit, rank),
      value: RANK_VALUE[rank],
      color: suit === "Hearts" || suit === "Diamonds" ? "red" : "black",
      src: CARD_BASE + "card" + suit + rank + ".png"
    };
  }

  function standardDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(makeCard(s, r));
    return d;
  }

  function deckWithout(predicate) {
    return standardDeck().filter((c) => !predicate(c));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function imgEl(card, opts) {
    const o = opts || {};
    const el = document.createElement("img");
    el.className = "card-img" + (o.selected ? " selected" : "") + (o.small ? " small" : "");
    el.src = o.faceDown ? BACK : card.src;
    el.alt = o.faceDown ? "Card back" : card.rank + " of " + card.suit;
    el.draggable = false;
    if (o.title) el.title = o.title;
    if (o.dataset) Object.assign(el.dataset, o.dataset);
    return el;
  }

  function isPicture(card) {
    return card.rank === "J" || card.rank === "Q" || card.rank === "K";
  }

  function cloneCard(c) {
    return Object.assign({}, c);
  }

  global.Cards = {
    SUITS,
    SUIT_SHORT,
    RANKS,
    RANK_VALUE,
    BACK,
    CARD_BASE,
    makeCard,
    cardId,
    standardDeck,
    deckWithout,
    shuffle,
    imgEl,
    isPicture,
    cloneCard
  };
})(window);
