(() => {
  const GUESTS = [
    { id: "ava", name: "Ava", ribbons: 1 },
    { id: "ben", name: "Ben", ribbons: 1 },
    { id: "cy", name: "Cy", ribbons: 1 },
    { id: "dee", name: "Dee", ribbons: 1 },
  ];
  const QUESTIONS = [
    "Want another drink?",
    "Have you finished your project?",
    "Can I borrow your pen?",
    "Are you leaving early?",
    "Do you know where the chips are?",
    "Is this your first time playing?",
    "Should we start another round?",
    "Did you bring an umbrella?",
    "Can you keep a secret?",
    "Are you allergic to peanuts?",
  ];
  const BAITS = [
    { prompt: "Ask {name}: Need a refill?", yes: "Absolutely not — I'm fine!", no: "No thanks." },
    { prompt: "Ask {name}: Ready to leave?", yes: "Not a chance!", no: "No, I'll stay." },
    { prompt: "Ask {name}: Mind if I take that chair?", yes: "Go ahead — wait, actually I'd rather you didn't!", no: "No, that's mine." },
    { prompt: "Ask {name}: Is the music too loud?", yes: "It's perfect!", no: "No, turn it up." },
  ];

  const ROUND_SECS = 120;
  let you;
  let guests;
  let chatEl;
  let over;
  let timer;
  let tick;

  function hasNo(text) {
    return /\bno\b/i.test(text);
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function renderRibbons() {
    const bar = document.getElementById("ribbons");
    bar.innerHTML = "";
    const all = [{ id: "you", name: "You", ribbons: you }, ...guests];
    all.forEach((p) => {
      const div = document.createElement("div");
      div.className = "player" + (p.id === "you" ? " you" : "");
      div.innerHTML = `<strong>${p.name}</strong><span class="ribbons">${"ribbon ".repeat(p.ribbons).trim() || "(none)"} ×${p.ribbons}</span>`;
      bar.appendChild(div);
    });
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = you;
  }

  function endByTimer() {
    if (over) return;
    over = true;
    clearInterval(tick);
    const standings = [{ name: "You", ribbons: you }, ...guests.map((g) => ({ name: g.name, ribbons: g.ribbons }))];
    standings.sort((a, b) => b.ribbons - a.ribbons);
    const top = standings[0];
    bubble(
      "Host",
      `Time! ${top.name} leads with ${top.ribbons} ribbon(s). ${
        top.name === "You" ? "You win the party." : "Try another round."
      }`,
      "them"
    );
    document.getElementById("input").disabled = true;
  }

  function bubble(who, text, cls) {
    const div = document.createElement("div");
    div.className = `bubble ${cls}`;
    div.innerHTML = `<span class="who">${who}</span>${text}`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  function steal(fromId, toId) {
    if (fromId === "you") {
      const amount = you;
      you = 0;
      const g = guests.find((x) => x.id === toId);
      g.ribbons += amount;
      bubble("Host", `${g.name} swipes all your ribbons!`, "them");
    } else if (toId === "you") {
      const g = guests.find((x) => x.id === fromId);
      const amount = g.ribbons;
      g.ribbons = 0;
      you += amount;
      bubble("Host", `You collect ${amount} ribbon(s) from ${g.name}!`, "them");
    } else {
      const a = guests.find((x) => x.id === fromId);
      const b = guests.find((x) => x.id === toId);
      b.ribbons += a.ribbons;
      a.ribbons = 0;
    }
    renderRibbons();
  }

  function guestAsks() {
    if (over) return;
    const g = guests[Math.floor(Math.random() * guests.length)];
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    bubble(g.name, q, "them");
    document.getElementById("input").placeholder = `Answer ${g.name} (don't say no)…`;
    document.getElementById("form").dataset.asker = g.id;
  }

  function yourBait() {
    if (over) return;
    const g = guests[Math.floor(Math.random() * guests.length)];
    const bait = BAITS[Math.floor(Math.random() * BAITS.length)];
    const div = bubble("You", bait.prompt.replace("{name}", g.name), "you");
    const choices = document.createElement("div");
    choices.className = "choices";
    const safe = document.createElement("button");
    safe.type = "button";
    safe.textContent = "They dodge: “Absolutely not!”";
    safe.addEventListener("click", () => {
      bubble(g.name, bait.yes, "them");
      choices.remove();
      setTimeout(guestAsks, 500);
    });
    const trap = document.createElement("button");
    trap.type = "button";
    trap.textContent = "Push until they slip";
    trap.addEventListener("click", () => {
      // 55% chance they say no
      if (Math.random() < 0.55) {
        bubble(g.name, bait.no, "them");
        steal(g.id, "you");
      } else {
        bubble(g.name, "I'd rather not discuss it.", "them");
      }
      choices.remove();
      checkEnd();
      setTimeout(guestAsks, 600);
    });
    choices.append(safe, trap);
    div.appendChild(choices);
  }

  function checkEnd() {
    if (guests.every((g) => g.ribbons === 0) && you > 0) {
      over = true;
      clearInterval(tick);
      bubble("Host", `You hoarded ${you} ribbons — sneakiest guest wins!`, "them");
      document.getElementById("input").disabled = true;
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (over) return;
    const input = document.getElementById("input");
    const text = input.value.trim();
    if (!text) return;
    const asker = document.getElementById("form").dataset.asker;
    bubble("You", text, "you");
    input.value = "";
    if (hasNo(text) && asker) {
      steal("you", asker);
      checkEnd();
    }
    setTimeout(yourBait, 500);
  }

  function newGame() {
    clearInterval(tick);
    you = 1;
    guests = GUESTS.map((g) => ({ ...g }));
    over = false;
    timer = ROUND_SECS;
    chatEl = document.getElementById("chat");
    chatEl.innerHTML = "";
    document.getElementById("input").disabled = false;
    document.getElementById("timer").textContent = formatTime(timer);
    bubble("Host", "Ribbons are pinned. Don't say the forbidden word. Two minutes on the clock.", "them");
    renderRibbons();
    tick = setInterval(() => {
      timer--;
      document.getElementById("timer").textContent = formatTime(Math.max(0, timer));
      if (timer <= 0) endByTimer();
    }, 1000);
    setTimeout(guestAsks, 400);
  }

  document.getElementById("form").addEventListener("submit", onSubmit);
  document.getElementById("newGame").addEventListener("click", newGame);
  newGame();
})();
