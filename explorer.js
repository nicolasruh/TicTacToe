"use strict";

const MinimaxExplorer = (() => {
  const other = player => player === "X" ? "O" : "X";
  const formatScore = score => score === 1 ? "+1" : score === -1 ? "−1" : "0";

  function createLevelLabel(player, ended = false) {
    const label = document.createElement("span");
    const explanation = ended ? "Das Spiel ist beendet." :
      `${player} ist am Zug und wählt den ${player === "X" ? "grössten (MAX)" : "kleinsten (MIN)"} Wert der möglichen Folgezüge, sofern das Spiel noch nicht beendet ist.`;
    label.className = `level-label player-${player.toLowerCase()}`;
    label.tabIndex = 0;
    label.setAttribute("aria-label", explanation);
    label.append(document.createTextNode(ended ? "Ende" : `${player} ${player === "X" ? "MAX" : "MIN"}`));
    const tooltip = document.createElement("span");
    tooltip.className = "level-tooltip";
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.textContent = explanation;
    label.append(tooltip);
    return label;
  }

  function createNode(board, turn, move = null, optimal = false, tree = null, nodeIndex = 0, expandable = true, afterToggle = null) {
    const analysis = TicTacToe.analyze(board, turn);
    const visibleChildren = tree
      ? OverviewTree.children(tree, nodeIndex).map(index => ({ ...analysis.children.find(child => child.move === tree.moves[index]), index }))
      : analysis.children;
    const outcome = TicTacToe.result(board);
    const item = document.createElement("li");
    if (tree) item.dataset.node = String(nodeIndex);
    const card = document.createElement("div");
    const valueClass = analysis.score === 1 ? "value-x" : analysis.score === -1 ? "value-o" : "value-draw";
    card.className = `tree-card ${valueClass}${optimal ? " optimal" : ""}`;

    const title = document.createElement("strong");
    title.className = "tree-node-title";
    title.textContent = move === null ? "Aktuell" : `${other(turn)}: ${Math.floor(move / 3) + 1} / ${move % 3 + 1}`;
    if (move !== null) title.title = `Zug ${other(turn)}: Zeile ${Math.floor(move / 3) + 1}, Spalte ${move % 3 + 1}`;

    const grid = document.createElement("div");
    grid.className = "mini-board";
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", `Spielfeld: ${board.map(value => value || "leer").join(", ")}`);
    board.forEach((value, index) => {
      const cell = document.createElement("span");
      cell.textContent = value || "";
      if (value) cell.classList.add(`player-${value.toLowerCase()}`);
      if (index === move) cell.classList.add("last-move");
      if (outcome && outcome.line.includes(index)) cell.classList.add("mini-winning");
      grid.append(cell);
    });

    const score = document.createElement("div");
    score.className = "tree-score";
    score.textContent = `Wert ${formatScore(analysis.score)}`;
    const role = document.createElement("div");
    role.className = "tree-role";
    role.textContent = outcome
      ? outcome.winner ? `${outcome.winner} gewinnt` : "Unentschieden"
      : `${turn} am Zug · ${turn === "X" ? "MAX" : "MIN"}`;

    const explanation = document.createElement("p");
    explanation.className = "tree-explanation";
    explanation.textContent = outcome
      ? outcome.winner ? `${outcome.winner}-Sieg ergibt ${formatScore(analysis.score)}.` : "Unentschieden ergibt 0."
      : tree && visibleChildren.length < analysis.children.length
        ? `Exakter Minimax-Wert: ${formatScore(analysis.score)}. Alpha-Beta hat weitere Folgezüge abgeschnitten.`
        : `${turn === "X" ? "MAX" : "MIN"} wählt ${turn === "X" ? "das Maximum" : "das Minimum"} aus ${analysis.children.map(child => formatScore(child.score)).join(", ")}: ${formatScore(analysis.score)}.`;
    card.append(title, grid, score, role);
    if (optimal) {
      const label = document.createElement("span");
      label.className = "optimal-label";
      label.textContent = "Optimaler Zug";
      card.append(label);
    }
    card.append(explanation);

    if (expandable && visibleChildren.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tree-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", `Fortsetzungen für ${title.textContent} anzeigen`);
      toggle.textContent = `${visibleChildren.length} Züge anzeigen`;
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        if (expanded) {
          item.querySelector(":scope > ul").remove();
        } else {
          const children = document.createElement("ul");
          visibleChildren.forEach(child => {
            children.append(createNode(child.board, other(turn), child.move, child.score === analysis.score, tree, child.index, true, afterToggle));
          });
          item.append(children);
        }
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.setAttribute("aria-label", `Fortsetzungen für ${title.textContent} ${expanded ? "anzeigen" : "schliessen"}`);
        toggle.textContent = expanded ? `${visibleChildren.length} Züge anzeigen` : "Züge schliessen";
        if (afterToggle) afterToggle();
      });
      card.append(toggle);
    }
    item.prepend(card);
    return item;
  }

  function render(container, board, turn, tree, getPath) {
    const root = document.createElement("ul");
    const update = () => updateTreePath(container, tree, getPath());
    root.append(createNode(board, turn, null, false, tree, 0, true, update));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("tree-path-edges");
    svg.setAttribute("aria-hidden", "true");
    container.replaceChildren(svg, root);
    const toggle = root.querySelector(".tree-toggle");
    if (toggle) toggle.click();
    else update();
  }

  function updateTreePath(container, tree, path) {
    const svg = container.querySelector(".tree-path-edges");
    if (!svg || !container.getBoundingClientRect().width) return;
    const rect = container.getBoundingClientRect();
    svg.replaceChildren();
    svg.setAttribute("width", rect.width);
    svg.setAttribute("height", rect.height);
    for (const card of container.querySelectorAll(".path-card")) card.classList.remove("path-card");
    let parentCard = null;
    for (const index of path) {
      const card = container.querySelector(`li[data-node="${index}"] > .tree-card`);
      if (!card) break;
      card.classList.add("path-card");
      if (parentCard) {
        const from = parentCard.getBoundingClientRect();
        const to = card.getBoundingClientRect();
        const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        for (const [name, value] of Object.entries({
          x1: from.left - rect.left + from.width / 2, y1: from.bottom - rect.top,
          x2: to.left - rect.left + to.width / 2, y2: to.top - rect.top
        })) edge.setAttribute(name, String(value));
        const outline = edge.cloneNode();
        outline.setAttribute("stroke", "#fff");
        outline.setAttribute("stroke-width", "5");
        edge.setAttribute("stroke", OverviewTree.scoreColor(tree.values[index]));
        edge.setAttribute("stroke-width", "3");
        edge.setAttribute("stroke-dasharray", "6 4");
        edge.classList.add("path-edge");
        svg.append(outline, edge);
      }
      parentCard = card;
    }
  }

  function renderSelection(container, tree, index, navigate, path) {
    const { board, turn } = OverviewTree.positionAt(tree, index);
    const root = document.createElement("ul");
    const item = createNode(board, turn, index === 0 ? null : tree.moves[index], false, tree, index, false);
    item.querySelector(".tree-node-title").textContent = "Gewählter Knoten";
    item.querySelector(".tree-card").classList.toggle("path-card", path.includes(index));
    item.dataset.node = String(index);
    if (tree.parents[index] !== -1) {
      const up = document.createElement("div");
      up.className = "detail-up";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "detail-nav";
      button.textContent = "↑ Nach oben";
      button.addEventListener("click", () => navigate(tree.parents[index]));
      up.append(button);
      item.prepend(up);
    }
    const childIndices = OverviewTree.children(tree, index);
    if (childIndices.length) {
      const list = document.createElement("ul");
      for (const childIndex of childIndices) {
        const child = OverviewTree.positionAt(tree, childIndex);
        const childItem = createNode(child.board, child.turn, tree.moves[childIndex], tree.values[childIndex] === tree.values[index], tree, childIndex, false);
        childItem.querySelector(".tree-card").classList.toggle("path-card", path.includes(childIndex));
        childItem.dataset.node = String(childIndex);
        const down = document.createElement("div");
        down.className = "detail-down";
        if (OverviewTree.children(tree, childIndex).length) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "detail-nav";
          button.textContent = "↓ Folgezüge";
          button.setAttribute("aria-label", `Folgezüge für ${other(child.turn)}, Zeile ${Math.floor(tree.moves[childIndex] / 3) + 1}, Spalte ${tree.moves[childIndex] % 3 + 1} anzeigen`);
          button.addEventListener("click", () => navigate(childIndex));
          down.append(button);
        }
        childItem.append(down);
        list.append(childItem);
      }
      item.append(list);
    }
    root.append(item);
    const bands = document.createElement("div");
    bands.className = "detail-bands";
    const labels = document.createElement("div");
    labels.className = "detail-labels";
    const rootBand = document.createElement("div");
    rootBand.className = `detail-band band-${turn.toLowerCase()}`;
    bands.append(rootBand);
    const rootLabel = document.createElement("div");
    rootLabel.className = "detail-label-row";
    rootLabel.append(createLevelLabel(turn, Boolean(TicTacToe.result(board))));
    labels.append(rootLabel);
    if (childIndices.length) {
      const childBand = document.createElement("div");
      childBand.className = `detail-band band-${other(turn).toLowerCase()}`;
      bands.append(childBand);
      const childLabel = document.createElement("div");
      childLabel.className = "detail-label-row";
      childLabel.append(createLevelLabel(other(turn)));
      labels.append(childLabel);
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("detail-edges");
    svg.setAttribute("aria-hidden", "true");
    container.replaceChildren(bands, svg, root, labels);
  }

  function layoutSelection(container, tree, index, path) {
    const root = container.querySelector(":scope > ul > li");
    if (!root) return;
    const svg = container.querySelector(".detail-edges");
    const containerRect = container.getBoundingClientRect();
    const cardRect = item => {
      const rect = item.querySelector(":scope > .tree-card").getBoundingClientRect();
      return { x: rect.left - containerRect.left + rect.width / 2, top: rect.top - containerRect.top, bottom: rect.bottom - containerRect.top };
    };
    const parentCard = cardRect(root);
    const childItems = Array.from(container.querySelectorAll(":scope > ul > li > ul > li"));
    const bandSplit = childItems.length ? (parentCard.bottom + cardRect(childItems[0]).top) / 2 : containerRect.height;
    for (const selector of [".detail-band", ".detail-label-row"]) {
      const rows = container.querySelectorAll(selector);
      rows[0].style.height = `${bandSplit}px`;
      if (rows[1]) {
        rows[1].style.top = `${bandSplit}px`;
        rows[1].style.height = `${containerRect.height - bandSplit}px`;
      }
    }
    svg.replaceChildren();
    svg.setAttribute("width", containerRect.width);
    svg.setAttribute("height", containerRect.height);
    const pathEdges = [];
    function line(x1, y1, x2, y2, value, onPath) {
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [name, value] of Object.entries({ x1, y1, x2, y2 })) edge.setAttribute(name, String(value));
      edge.setAttribute("stroke", OverviewTree.scoreColor(value));
      edge.setAttribute("stroke-width", "2");
      svg.append(edge);
      if (onPath) pathEdges.push(edge);
    }
    if (tree.parents[index] !== -1) {
      line(parentCard.x, parentCard.top - 26, parentCard.x, parentCard.top, tree.values[index], path.includes(index));
    }
    for (const childItem of childItems) {
      const childIndex = Number(childItem.dataset.node);
      const childCard = cardRect(childItem);
      line(parentCard.x, parentCard.bottom, childCard.x, childCard.top, tree.values[childIndex], path.includes(index) && path.includes(childIndex));
      const grandchildren = OverviewTree.children(tree, childIndex);
      grandchildren.forEach((grandchild, position) => {
        const offset = (position - (grandchildren.length - 1) / 2) * 12;
        line(childCard.x, childCard.bottom, childCard.x + offset, childCard.bottom + 27, tree.values[grandchild], path.includes(childIndex) && path.includes(grandchild));
      });
    }
    for (const edge of pathEdges) {
      const outline = edge.cloneNode();
      outline.setAttribute("stroke", "#fff");
      outline.setAttribute("stroke-width", "5");
      edge.setAttribute("stroke-width", "3");
      edge.setAttribute("stroke-dasharray", "6 4");
      edge.classList.add("path-edge");
      svg.append(outline, edge);
    }
  }

  return { render, updateTreePath, renderSelection, layoutSelection, createLevelLabel };
})();
