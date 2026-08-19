(() => {
  let size = 4;
  let lines; // array of segments {a:[r,c], b:[r,c]}
  let usedDots;
  let ends; // two free ends after first line, or null before first
  let turn; // 0 human, 1 ai
  let over;

  const svg = document.getElementById("svg");
  const status = document.getElementById("status");
  let selectStart = null;

  function dotPos(r, c) {
    const pad = 30;
    const span = 260;
    const step = size === 1 ? span : span / (size - 1);
    return [pad + c * step, pad + r * step];
  }

  function reset() {
    size = Number(document.getElementById("size").value);
    lines = [];
    usedDots = new Set();
    ends = null;
    turn = 0;
    over = false;
    selectStart = null;
    status.textContent = "Your turn — draw the first straight line across unused dots.";
    render();
  }

  function k(r, c) {
    return `${r},${c}`;
  }

  function colinear(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0;
  }

  function between(a, b, p) {
    return (
      Math.min(a[0], b[0]) <= p[0] &&
      p[0] <= Math.max(a[0], b[0]) &&
      Math.min(a[1], b[1]) <= p[1] &&
      p[1] <= Math.max(a[1], b[1])
    );
  }

  function segmentDots(a, b) {
    const dots = [];
    const dr = Math.sign(b[0] - a[0]);
    const dc = Math.sign(b[1] - a[1]);
    // Must be straight orthog or diagonal
    const stepsR = Math.abs(b[0] - a[0]);
    const stepsC = Math.abs(b[1] - a[1]);
    if (!(stepsR === 0 || stepsC === 0 || stepsR === stepsC)) return null;
    const n = Math.max(stepsR, stepsC);
    if (n < 1) return null;
    for (let i = 0; i <= n; i++) {
      dots.push([a[0] + dr * i, a[1] + dc * i]);
    }
    return dots;
  }

  function crossesExisting(a, b) {
    // No shared interior dots with existing path except joining at ends when extending
    return false; // enforced via usedDots
  }

  function legalFirst(a, b) {
    const dots = segmentDots(a, b);
    if (!dots || dots.length < 2) return null;
    for (const d of dots) {
      if (d[0] < 0 || d[0] >= size || d[1] < 0 || d[1] >= size) return null;
      if (usedDots.has(k(d[0], d[1]))) return null;
    }
    return dots;
  }

  function legalExtend(fromEnd, to) {
    const dots = segmentDots(fromEnd, to);
    if (!dots || dots.length < 2) return null;
    // first dot is end (already used); rest must be unused
    for (let i = 1; i < dots.length; i++) {
      const d = dots[i];
      if (d[0] < 0 || d[0] >= size || d[1] < 0 || d[1] >= size) return null;
      if (usedDots.has(k(d[0], d[1]))) return null;
    }
    return dots;
  }

  function applyDots(dots, extending) {
    const a = dots[0];
    const b = dots[dots.length - 1];
    lines.push({ a, b });
    dots.forEach((d) => usedDots.add(k(d[0], d[1])));
    if (!extending) {
      ends = [a, b];
    } else {
      // replace the end we extended from with the new tip
      const from = dots[0];
      if (ends[0][0] === from[0] && ends[0][1] === from[1]) ends[0] = b;
      else ends[1] = b;
    }
  }

  function anyMoves() {
    if (!ends) {
      for (let r1 = 0; r1 < size; r1++) {
        for (let c1 = 0; c1 < size; c1++) {
          for (let r2 = 0; r2 < size; r2++) {
            for (let c2 = 0; c2 < size; c2++) {
              if (legalFirst([r1, c1], [r2, c2])) return true;
            }
          }
        }
      }
      return false;
    }
    for (const end of ends) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (legalExtend(end, [r, c])) return true;
        }
      }
    }
    return false;
  }

  function render() {
    const vb = size <= 4 ? 320 : 360;
    svg.setAttribute("viewBox", `0 0 ${vb} ${vb}`);
    svg.setAttribute("width", vb);
    svg.setAttribute("height", vb);
    svg.innerHTML = "";
    // lines
    lines.forEach((seg, i) => {
      const [x1, y1] = dotPos(seg.a[0], seg.a[1]);
      const [x2, y2] = dotPos(seg.b[0], seg.b[1]);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", i % 2 === 0 ? "#1d4e89" : "#9a3412");
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    });
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const [x, y] = dotPos(r, c);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", selectStart && selectStart[0] === r && selectStart[1] === c ? 8 : 6);
        circle.setAttribute("fill", usedDots.has(k(r, c)) ? "#334155" : "#94a3b8");
        circle.style.cursor = "pointer";
        circle.addEventListener("click", () => onDot(r, c));
        svg.appendChild(circle);
      }
    }
  }

  function endTurn() {
    if (!anyMoves()) {
      over = true;
      status.textContent = turn === 0 ? "No moves left — you lose!" : "No moves left — computer loses; you win!";
      render();
      return;
    }
    turn = 1 - turn;
    selectStart = null;
    if (turn === 1) {
      status.textContent = "Computer thinking…";
      render();
      setTimeout(aiMove, 350);
    } else {
      status.textContent = ends
        ? "Your turn — extend from either free end."
        : "Your turn — draw the first line.";
      render();
    }
  }

  function onDot(r, c) {
    if (over || turn !== 0) return;
    if (!selectStart) {
      if (ends) {
        const isEnd = ends.some((e) => e[0] === r && e[1] === c);
        if (!isEnd) {
          status.textContent = "Start from a free end of the line.";
          return;
        }
      } else if (usedDots.has(k(r, c))) return;
      selectStart = [r, c];
      status.textContent = "Now choose the other end of your straight segment.";
      render();
      return;
    }
    const a = selectStart;
    const b = [r, c];
    selectStart = null;
    let dots;
    if (!ends) dots = legalFirst(a, b);
    else dots = legalExtend(a, b);
    if (!dots) {
      status.textContent = "Illegal segment — try again.";
      render();
      return;
    }
    applyDots(dots, !!ends && lines.length > 0);
    // first line: extending false; after first, true. Fix: for first line ends was null
    // applyDots already handled ends.
    // Actually bug: for first line I passed extending based on ends before apply — need fix.
    render();
    endTurn();
  }

  // Fix apply for first move: rewrite onDot properly
  function onDotFixed(r, c) {
    if (over || turn !== 0) return;
    if (!selectStart) {
      if (ends) {
        if (!ends.some((e) => e[0] === r && e[1] === c)) {
          status.textContent = "Start from a free end.";
          return;
        }
      }
      selectStart = [r, c];
      status.textContent = "Choose the far end of a straight run.";
      render();
      return;
    }
    const start = selectStart;
    selectStart = null;
    if (!ends) {
      const dots = legalFirst(start, [r, c]);
      if (!dots) {
        status.textContent = "Illegal first line.";
        render();
        return;
      }
      lines.push({ a: dots[0], b: dots[dots.length - 1] });
      dots.forEach((d) => usedDots.add(k(d[0], d[1])));
      ends = [dots[0], dots[dots.length - 1]];
    } else {
      const dots = legalExtend(start, [r, c]);
      if (!dots) {
        status.textContent = "Illegal extension.";
        render();
        return;
      }
      const tip = dots[dots.length - 1];
      lines.push({ a: dots[0], b: tip });
      for (let i = 1; i < dots.length; i++) usedDots.add(k(dots[i][0], dots[i][1]));
      if (ends[0][0] === start[0] && ends[0][1] === start[1]) ends[0] = tip;
      else ends[1] = tip;
    }
    endTurn();
  }

  // replace listener usage
  const _render = render;
  render = function () {
    _render();
    // rebind via recreation — already bound in _render to onDot; patch by rewriting render
  };

  function render2() {
    const vb = 320;
    svg.setAttribute("viewBox", `0 0 ${vb} ${vb}`);
    svg.innerHTML = "";
    lines.forEach((seg, i) => {
      const [x1, y1] = dotPos(seg.a[0], seg.a[1]);
      const [x2, y2] = dotPos(seg.b[0], seg.b[1]);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", i % 2 === 0 ? "#1d4e89" : "#9a3412");
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    });
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const [x, y] = dotPos(r, c);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", selectStart && selectStart[0] === r && selectStart[1] === c ? 8 : 6);
        circle.setAttribute("fill", usedDots.has(k(r, c)) ? "#334155" : "#94a3b8");
        circle.style.cursor = "pointer";
        circle.addEventListener("click", () => onDotFixed(r, c));
        svg.appendChild(circle);
      }
    }
  }
  render = render2;

  function aiMove() {
    if (over || turn !== 1) return;
    // Prefer short extensions to delay the end; first move take a medium line
    if (!ends) {
      for (let len = 2; len < size; len++) {
        for (let r = 0; r < size; r++) {
          const dots = legalFirst([r, 0], [r, len]);
          if (dots) {
            lines.push({ a: dots[0], b: dots[dots.length - 1] });
            dots.forEach((d) => usedDots.add(k(d[0], d[1])));
            ends = [dots[0], dots[dots.length - 1]];
            endTurn();
            return;
          }
        }
      }
    }
    const candidates = [];
    for (const end of ends) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const dots = legalExtend(end, [r, c]);
          if (dots) candidates.push({ end, dots });
        }
      }
    }
    if (!candidates.length) {
      over = true;
      status.textContent = "Computer has no move — you win!";
      render();
      return;
    }
    candidates.sort((a, b) => a.dots.length - b.dots.length);
    const pick = candidates[0];
    const tip = pick.dots[pick.dots.length - 1];
    lines.push({ a: pick.dots[0], b: tip });
    for (let i = 1; i < pick.dots.length; i++) usedDots.add(k(pick.dots[i][0], pick.dots[i][1]));
    if (ends[0][0] === pick.end[0] && ends[0][1] === pick.end[1]) ends[0] = tip;
    else ends[1] = tip;
    endTurn();
  }

  document.getElementById("btn-new").addEventListener("click", reset);
  document.getElementById("size").addEventListener("change", reset);
  // need game.css minimal
  reset();
})();
