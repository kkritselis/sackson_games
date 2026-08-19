async function loadCatalog() {
  const root = document.getElementById("catalog");
  try {
    const res = await fetch("games.json");
    if (!res.ok) throw new Error("Could not load games.json");
    const data = await res.json();
    root.innerHTML = "";

    data.chapters.forEach((chapter, index) => {
      const section = document.createElement("section");
      section.className = "chapter";
      section.id = chapter.id;

      const head = document.createElement("div");
      head.className = "chapter-head";
      head.innerHTML = `
        <span class="chapter-num">${String(index + 1).padStart(2, "0")}</span>
        <h2>${chapter.title}</h2>
      `;
      section.appendChild(head);

      const list = document.createElement("ul");
      list.className = "game-list";

      chapter.games.forEach((game) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <a class="game-card" href="${game.path}">
            <h3>${game.title}</h3>
            <p class="meta">${game.author} · ${game.players} players · ${game.equipment}</p>
            <p class="blurb">${game.blurb}</p>
          </a>
        `;
        list.appendChild(li);
      });

      section.appendChild(list);
      root.appendChild(section);
    });
  } catch (err) {
    root.innerHTML = `<p class="loading">Failed to load catalog: ${err.message}</p>`;
  }
}

loadCatalog();
