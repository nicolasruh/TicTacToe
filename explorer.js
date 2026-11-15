"use strict";

const MinimaxExplorer = (() => {
  const other = player => player === "X" ? "O" : "X";
  const formatScore = score => score === Infinity ? "+∞" : score === -Infinity ? "−∞" : score === 1 ? "+1" : score === -1 ? "−1" : "0";
  const isRevealed = (revealed, index) => !revealed || Boolean(revealed[index]);
  const nodeScore = (tree, index, revealed) => isRevealed(revealed, index)
    ? `${tree.bounds[index] < 0 ? "≤" : tree.bounds[index] > 0 ? "≥" : ""}${formatScore(tree.values[index])}`
    : "?";
  const isOptimal = (tree, parent, child, revealed) =>
    isRevealed(revealed, parent) && isRevealed(revealed, child) &&
    tree.bounds[parent] === 0 && tree.bounds[child] === 0 && tree.values[parent] === tree.values[child];

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

  function createNode(board, turn, move, optimal, tree, nodeIndex, step, onMove = null) {
    const outcome = TicTacToe.result(board);
    const revealed = step && step.revealed;
    const generated = !step || nodeIndex <= step.generatedThrough;
    const visibleChildren = OverviewTree.children(tree, nodeIndex).map(index => {
      const childBoard = board.slice();
      const childMove = tree.moves[index];
      childBoard[childMove] = turn;
      return { index, move: childMove, board: childBoard };
    });
    const item = document.createElement("li");
    item.dataset.node = String(nodeIndex);
    const card = document.createElement("div");
    const valueClass = !generated ? "value-pending" : !isRevealed(revealed, nodeIndex) ? "value-empty" :
      tree.values[nodeIndex] === 1 ? "value-x" : tree.values[nodeIndex] === -1 ? "value-o" : "value-draw";
    card.className = `tree-card ${valueClass}${optimal ? " optimal" : ""}${step && nodeIndex === step.current ? " step-current" : ""}`;

    const title = document.createElement("strong");
    title.className = "tree-node-title";
    title.textContent = move === null ? "Aktuell" : `${other(turn)}: ${Math.floor(move / 3) + 1} / ${move % 3 + 1}`;
    if (move !== null) title.title = `Zug ${other(turn)}: Zeile ${Math.floor(move / 3) + 1}, Spalte ${move % 3 + 1}`;

    const body = document.createElement("div");
    body.className = "tree-card-body";
    const grid = document.createElement("div");
    grid.className = "mini-board";
    grid.setAttribute("role", nodeIndex === 0 && onMove ? "group" : "img");
    grid.setAttribute("aria-label", `Spielfeld: ${board.map(value => value || "leer").join(", ")}`);
    board.forEach((value, index) => {
      const playable = nodeIndex === 0 && onMove && !value;
      const cell = document.createElement(playable ? "button" : "span");
      cell.textContent = value || "";
      if (playable) {
        cell.type = "button";
        cell.className = "root-move";
        cell.setAttribute("aria-label", `Zug ${turn}, Zeile ${Math.floor(index / 3) + 1}, Spalte ${index % 3 + 1} spielen`);
        cell.title = cell.getAttribute("aria-label");
        cell.addEventListener("click", () => onMove(index));
      }
      if (value) cell.classList.add(`player-${value.toLowerCase()}`);
      if (index === move) cell.classList.add("last-move");
      if (outcome && outcome.line.includes(index)) cell.classList.add("mini-winning");
      grid.append(cell);
    });

    const editable = step && step.manual && nodeIndex === step.current;
    const known = isRevealed(revealed, nodeIndex) || Boolean(step && nodeIndex === step.current && step.answers.value);
    const valueExplanation = outcome
      ? "Endstand: Drei X ergeben +1, drei O ergeben −1; ein volles Brett ohne Gewinnreihe ergibt 0."
      : `${turn === "X" ? "MAX: Wähle den grössten" : "MIN: Wähle den kleinsten"} zurückgegebenen Wert der besuchten Folgezüge (${visibleChildren.map(child => nodeScore(tree, child.index, revealed)).join(", ")}). Nicht besuchte Zweige zählen nicht mit.`;
    const boundExplanation = known && tree.bounds[nodeIndex]
      ? ` Alpha-Beta liefert eine Schranke: Der genaue Wert ist ${tree.bounds[nodeIndex] < 0 ? "höchstens" : "mindestens"} ${formatScore(tree.values[nodeIndex])}.`
      : "";
    const role = outcome
      ? outcome.winner ? `${outcome.winner} gewinnt` : "Unentschieden"
      : `${turn} am Zug · ${turn === "X" ? "MAX" : "MIN"}`;
    const explanation = !generated ? "Dieser Knoten wurde noch nicht generiert." :
      !known ? "Dieser Knoten wurde noch nicht bewertet." :
        `${valueExplanation} Ergebnis: ${nodeScore(tree, nodeIndex, null)}.${visibleChildren.length && visibleChildren.length < board.filter(value => !value).length ? " Weitere Folgezüge wurden abgeschnitten." : ""}${boundExplanation}`;
    card.title = `${role}. ${explanation}${optimal ? " Optimaler Zug." : ""}`;
    card.tabIndex = 0;
    const values = document.createElement("div");
    values.className = "node-values";
    const feedback = document.createElement("p");
    feedback.className = "step-feedback";
    feedback.setAttribute("role", "status");
    const fields = [{ name: "value", label: "Wert", expected: tree.values[nodeIndex], explanation: valueExplanation + boundExplanation }];
    if (tree.pruning) {
      for (const [name, label, entries, results, updates, rule] of [
        ["alpha", "α", tree.entryAlphas, tree.alphas, turn === "X", "max(übernommenes α, Wert)"],
        ["beta", "β", tree.entryBetas, tree.betas, turn === "O", "min(übernommenes β, Wert)"]
      ]) {
        const inherited = generated ? formatScore(entries[nodeIndex]) : "erst nach Generierung bekannt";
        const update = outcome
          ? "Am Endstand werden beide Grenzen unverändert zurückgelassen."
          : updates ? `Nach den besuchten Folgezügen: ${label} = ${rule}.` : `${turn === "X" ? "MAX" : "MIN"} verändert ${label} nicht: übernommenen Wert beibehalten.`;
        fields.push({
          name, label, expected: results[nodeIndex],
          explanation: `${label === "α" ? "α: Untergrenze für MAX" : "β: Obergrenze für MIN"}. Beim Betreten vom Elternknoten übernommen: ${inherited}${nodeIndex === 0 ? " (Root startet mit α = −∞, β = +∞)" : ""}. ${update} Gesucht ist die Grenze am Ende dieser Knotenbewertung, nicht der Minimax-Wert. Bei α ≥ β entfallen weitere Folgezüge; auch bei MAX = +1 bzw. MIN = −1 wird abgebrochen.`
        });
      }
    }
    for (const field of fields) {
      const metric = document.createElement("div");
      metric.className = "node-metric";
      metric.dataset.field = field.name;
      metric.title = field.explanation;
      const accepted = isRevealed(revealed, nodeIndex) || Boolean(step && nodeIndex === step.current && step.answers[field.name]);
      const score = document.createElement("div");
      score.className = `tree-score ${accepted ? "score-verified" : "score-question"}`;
      score.textContent = `${field.label} ${accepted ? field.name === "value" ? nodeScore(tree, nodeIndex, null) : formatScore(field.expected) : "?"}`;
      score.title = field.explanation;
      score.tabIndex = 0;
      metric.append(score);
      if (editable) {
        const choices = document.createElement("div");
        choices.className = "step-score-choices";
        choices.setAttribute("role", "group");
        choices.setAttribute("aria-label", `${field.label} auswählen`);
        for (const value of field.name === "value" ? [-1, 0, 1] : [-Infinity, -1, 0, 1, Infinity]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = formatScore(value);
          button.disabled = accepted;
          button.setAttribute("aria-pressed", String(accepted && value === field.expected));
          button.addEventListener("click", () => {
            const container = card.closest(".tree");
            const error = step.check(value, field.name);
            feedback.textContent = error;
            if (error) {
              for (const option of choices.children) option.setAttribute("aria-pressed", String(option === button));
            } else {
              const nextChoice = container.querySelector(".step-score-choices button:not(:disabled)");
              if (nextChoice) nextChoice.focus({ preventScroll: true });
            }
          });
          choices.append(button);
        }
        metric.append(choices);
      }
      values.append(metric);
    }
    if (editable) card.append(feedback);
    body.append(grid, values);
    card.append(title, body);

    item.prepend(card);
    return item;
  }

  function renderSelection(container, tree, index, navigate, path, onMove, step = null) {
    const { board, turn } = OverviewTree.positionAt(tree, index);
    const root = document.createElement("ul");
    const revealed = step && step.revealed;
    const item = createNode(board, turn, index === 0 ? null : tree.moves[index], false, tree, index, step, index === 0 ? onMove : null);
    item.querySelector(".tree-node-title").textContent = index === 0 ? "Root" : step && index === step.current ? "Nächster Schritt" : "Gewählter Knoten";
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
        const childItem = createNode(child.board, child.turn, tree.moves[childIndex], isOptimal(tree, index, childIndex, revealed), tree, childIndex, step);
        const card = childItem.querySelector(".tree-card");
        card.classList.toggle("path-card", path.includes(childIndex));
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
    container.classList.toggle("with-pruning", tree.pruning);
    container.replaceChildren(bands, svg, root, labels);
  }

  function layoutSelection(container, tree, index, path, step = null) {
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
    const bandSplit = childItems.length ? (parentCard.bottom + cardRect(childItems[0]).top) / 2 : parentCard.bottom + 21;
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
    function line(x1, y1, x2, y2, node, onPath) {
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [name, value] of Object.entries({ x1, y1, x2, y2 })) edge.setAttribute(name, String(value));
      const generated = !step || node <= step.generatedThrough;
      edge.setAttribute("stroke", generated ? OverviewTree.scoreColor(isRevealed(step && step.revealed, node) ? tree.values[node] : null) : "#81968a");
      edge.setAttribute("stroke-width", "3");
      if (!generated) {
        edge.setAttribute("stroke-dasharray", "2 4");
        edge.setAttribute("opacity", ".45");
      }
      svg.append(edge);
      if (onPath) pathEdges.push(edge);
    }
    if (tree.parents[index] !== -1) {
      line(parentCard.x, parentCard.top - 26, parentCard.x, parentCard.top, index, path.includes(index));
    }
    for (const childItem of childItems) {
      const childIndex = Number(childItem.dataset.node);
      const childCard = cardRect(childItem);
      line(parentCard.x, parentCard.bottom, childCard.x, childCard.top, childIndex, path.includes(index) && path.includes(childIndex));
      const grandchildren = OverviewTree.children(tree, childIndex);
      grandchildren.forEach((grandchild, position) => {
        const offset = (position - (grandchildren.length - 1) / 2) * 12;
        line(childCard.x, childCard.bottom, childCard.x + offset, childCard.bottom + 27, grandchild, path.includes(childIndex) && path.includes(grandchild));
      });
    }
    for (const edge of pathEdges) {
      const outline = edge.cloneNode();
      outline.setAttribute("stroke", "#fff");
      outline.setAttribute("stroke-width", "7");
      edge.setAttribute("stroke-width", "4");
      edge.setAttribute("stroke-dasharray", "6 4");
      edge.classList.add("path-edge");
      svg.append(outline, edge);
    }
  }

  return { renderSelection, layoutSelection, createLevelLabel };
})();
