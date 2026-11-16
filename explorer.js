"use strict";

const MinimaxExplorer = (() => {
  const other = player => player === "X" ? "O" : "X";
  const formatScore = score => score === Infinity ? "+∞" : score === -Infinity ? "−∞" : score === 1 ? "+1" : score === -1 ? "−1" : "0";
  const isRevealed = (revealed, index) => !revealed || Boolean(revealed[index]);
  const nodeScore = (tree, index, search) => {
    const value = OverviewTree.nodeValue(tree, index, search);
    const bound = !search || search.revealed[index] ? tree.bounds[index] : 0;
    return value === null ? "?" : `${bound < 0 ? "≤" : bound > 0 ? "≥" : ""}${formatScore(value)}`;
  };
  const isOptimal = (tree, parent, child, revealed) =>
    isRevealed(revealed, parent) && isRevealed(revealed, child) &&
    tree.bounds[parent] === 0 && tree.bounds[child] === 0 && tree.values[parent] === tree.values[child];

  function createLevelLabel(player, ended = false) {
    const label = document.createElement("span");
    const explanation = ended ? "Das Spiel ist beendet." :
      `${player} ist am Zug und wählt den ${player === "X" ? "grössten (MAX)" : "kleinsten (MIN)"} Score der möglichen Folgezüge, sofern das Spiel noch nicht beendet ist.`;
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

  function createNode(board, turn, move, optimal, tree, nodeIndex, step, onMove = null, active = false) {
    const outcome = TicTacToe.result(board);
    const revealed = step && step.revealed;
    const generated = OverviewTree.isGenerated(tree, nodeIndex, step);
    const pruned = OverviewTree.isPruned(tree, nodeIndex, step);
    const visibleChildren = OverviewTree.children(tree, nodeIndex);
    const displayedValue = OverviewTree.nodeValue(tree, nodeIndex, step);
    const item = document.createElement("li");
    item.dataset.node = String(nodeIndex);
    const card = document.createElement("div");
    const valueClass = pruned ? "value-pruned" : !generated ? "value-pending" : displayedValue === null ? "value-empty" :
      displayedValue === 1 ? "value-x" : displayedValue === -1 ? "value-o" : "value-draw";
    card.className = `tree-card ${valueClass}${optimal ? " optimal" : ""}${step && nodeIndex === step.current ? ` step-current${step.settling ? " step-settling" : ""}` : ""}`;

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

    const editable = active && step && step.manual && !step.settling && nodeIndex === step.current;
    const known = displayedValue !== null;
    const valueExplanation = outcome
      ? "Endstand: Drei X ergeben +1, drei O ergeben −1; ein volles Brett ohne Gewinnreihe ergibt 0."
      : `${turn === "X" ? "MAX: Wähle den grössten" : "MIN: Wähle den kleinsten"} bisher zurückgegebenen Score der Folgezüge (${visibleChildren.map(child => nodeScore(tree, child, step)).join(", ")}). Noch nicht bewertete und abgeschnittene Zweige zählen nicht mit.`;
    const boundExplanation = isRevealed(revealed, nodeIndex) && tree.bounds[nodeIndex]
      ? ` Alpha-Beta liefert eine Schranke: Der genaue Score ist ${tree.bounds[nodeIndex] < 0 ? "höchstens" : "mindestens"} ${formatScore(tree.values[nodeIndex])}.`
      : "";
    const role = outcome
      ? outcome.winner ? `${outcome.winner} gewinnt` : "Unentschieden"
      : `${turn} am Zug · ${turn === "X" ? "MAX" : "MIN"}`;
    const explanation = pruned ? "Dieser hypothetische Knoten wird wegen Pruning nicht generiert oder bewertet." :
      !generated ? "Dieser Knoten wurde noch nicht generiert." :
      !known ? "Dieser Knoten wurde noch nicht bewertet." :
        `${valueExplanation} Bisheriger Score: ${nodeScore(tree, nodeIndex, step)}.${OverviewTree.cutMoves(tree, nodeIndex, step).length ? " Weitere Folgezüge wurden abgeschnitten." : ""}${boundExplanation}`;
    card.title = `${role}. ${explanation}${optimal ? " Optimaler Zug." : ""}`;
    card.tabIndex = 0;
    const values = document.createElement("div");
    values.className = "node-values";
    const feedback = document.createElement("p");
    feedback.className = "step-feedback";
    feedback.setAttribute("role", "status");
    const fields = [{ name: "value", label: "Score", value: displayedValue, explanation: valueExplanation + boundExplanation }];
    let pruningExplanation = "";
    if (tree.pruning) {
      const limits = OverviewTree.limits(tree, nodeIndex, step);
      const returned = visibleChildren.filter(child =>
        (!tree.prunedBy || tree.prunedBy[child] === -1) &&
        (!step || step.revealed[child]) &&
        !(step && nodeIndex === step.current && step.phase === "value" && child === step.child)
      ).map(child => nodeScore(tree, child, step));
      for (const [name, label, entries, updates, rule] of [
        ["alpha", "α", tree.entryAlphas, turn === "X", "max(bisheriges α, neuer Kind-Score)"],
        ["beta", "β", tree.entryBetas, turn === "O", "min(bisheriges β, neuer Kind-Score)"]
      ]) {
        const inherited = generated ? formatScore(entries[nodeIndex]) : "erst nach Generierung bekannt";
        const update = outcome
          ? "Am Endstand werden beide Grenzen unverändert zurückgelassen."
          : updates ? `Nach jedem zurückgegebenen Kind-Score: ${label} = ${rule}.` : `${turn === "X" ? "MAX" : "MIN"} verändert ${label} nicht: übernommene Grenze beibehalten.`;
        const progress = generated
          ? `Bereits berücksichtigte Kind-Scores: ${returned.length ? returned.join(", ") : "noch keine"}. Aktuell: ${formatScore(limits[name])}.`
          : "Die aktuelle Grenze ist noch nicht bekannt.";
        fields.push({
          name, label, value: limits[name], cut: limits[`${name}Cut`], changed: limits[`${name}Changed`],
          explanation: `${label === "α" ? "α: Untergrenze für MAX" : "β: Obergrenze für MIN"}. ${nodeIndex === 0 ? "Anfangsgrenze" : "Vom Elternknoten übernommen"}: ${inherited}. ${progress} ${update} Weiss: übernommen; Blau/Orange/Grau: angepasst; Rot: führt zum Abschneiden.`
        });
      }
      if (editable && step.phase === "prune") {
        pruningExplanation = `Prüfe: Ist α ≥ β oder hat ${turn === "X" ? "MAX den bestmöglichen Score +1" : "MIN den bestmöglichen Score −1"} erreicht? Dann Ja: restliche Äste abschneiden. Sonst Nein: nächsten Ast generieren. Aktuell: α = ${formatScore(limits.alpha)}, β = ${formatScore(limits.beta)}, Score = ${nodeScore(tree, nodeIndex, step)}.`;
      }
    }
    function createChoices(options, pruning = false) {
      const choices = document.createElement("div");
      choices.className = `step-score-choices ${pruning ? "pruning-score-choices" : "step-value-choices"}`;
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-label", pruning ? "Pruning-Bedingung erfüllt?" : "Score auswählen");
      if (pruning) {
        choices.title = pruningExplanation;
        const label = document.createElement("span");
        label.textContent = "Pruning?";
        choices.append(label);
      }
      for (const value of options) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = typeof value === "boolean" ? value ? "Ja" : "Nein" : formatScore(value);
        button.title = typeof value === "boolean" ? pruningExplanation : valueExplanation;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          const container = card.closest(".tree");
          const error = step.check(value);
          feedback.textContent = error;
          if (error) {
            for (const option of choices.querySelectorAll("button")) option.setAttribute("aria-pressed", String(option === button));
          } else {
            const nextChoice = container.querySelector(".step-score-choices button:not(:disabled)");
            if (nextChoice) nextChoice.focus({ preventScroll: true });
          }
        });
        choices.append(button);
      }
      return choices;
    }
    for (const field of fields) {
      const metric = document.createElement("div");
      metric.className = "node-metric";
      metric.dataset.field = field.name;
      metric.title = field.explanation;
      const accepted = field.value !== null;
      const score = document.createElement("div");
      score.className = `tree-score ${accepted ? "score-verified" : "score-question"}`;
      score.textContent = `${field.label} `;
      if (accepted) {
        score.append(document.createTextNode(field.name === "value" ? nodeScore(tree, nodeIndex, step) : formatScore(field.value)));
      } else {
        const question = document.createElement("span");
        question.className = "score-placeholder";
        question.textContent = "?";
        score.append(question);
      }
      if (field.name !== "value") {
        score.classList.add(field.cut ? "limit-cut" : field.changed ? "limit-updated" : "limit-inherited");
        if (field.changed) {
          score.style.setProperty("--limit-color", OverviewTree.scoreColor(field.value));
          score.style.setProperty("--limit-text", field.value === 0 ? "#102219" : "#fff");
        }
      }
      score.title = field.explanation;
      score.tabIndex = 0;
      metric.append(score);
      if (editable && field.name === "value" && step.phase !== "prune") {
        metric.append(createChoices([-1, 0, 1]));
      }
      values.append(metric);
    }
    if (editable && step.phase === "prune") {
      values.classList.add("has-pruning-choice");
      values.append(createChoices([true, false], true));
    }
    if (editable) card.append(feedback);
    body.append(grid, values);
    card.append(title, body);

    item.prepend(card);
    return item;
  }

  function renderSelection(container, tree, index, navigate, path, onMove, step = null) {
    const { board, turn } = OverviewTree.positionAt(tree, index);
    const rows = document.createElement("div");
    rows.className = "detail-rows";
    const parentRow = document.createElement("ul");
    parentRow.className = "detail-row detail-parent";
    const activeRow = document.createElement("ul");
    activeRow.className = "detail-row detail-active";
    const childRow = document.createElement("ul");
    childRow.className = "detail-row detail-children";
    const revealed = step && step.revealed;
    const parent = tree.parents[index];
    function displayedNode(node, optimal = false) {
      const position = OverviewTree.positionAt(tree, node);
      const item = createNode(position.board, position.turn, node === 0 ? null : tree.moves[node], optimal, tree, node, step);
      item.querySelector(".tree-card").classList.toggle("path-card", path.includes(node));
      return item;
    }
    function note(row, text) {
      const item = document.createElement("li");
      item.className = "detail-row-note";
      item.textContent = text;
      row.append(item);
    }
    if (parent !== -1) {
      const item = displayedNode(parent);
      item.querySelector(".tree-node-title").textContent = parent === 0 ? "Elternknoten · Root" : "Elternknoten";
      parentRow.append(item);
    } else {
      note(parentRow, "Oberste Ebene, das entspricht dem aktuell zu wählenden Zug. Freies Feld im Root wählen → nächsten Zug spielen.");
    }
    const item = createNode(board, turn, index === 0 ? null : tree.moves[index], false, tree, index, step, index === 0 ? onMove : null, true);
    item.querySelector(".tree-node-title").textContent = index === 0 ? "Aktiver Knoten · Root" : "Aktiver Knoten";
    item.querySelector(".tree-card").classList.toggle("path-card", path.includes(index));
    item.dataset.node = String(index);
    const selectedCard = item.querySelector(".tree-card");
    const childIndices = OverviewTree.children(tree, index);
    function navigation(key, text, label, position) {
      const wrapper = document.createElement("div");
      wrapper.className = `node-navigation nav-${position}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "detail-nav";
      button.textContent = text;
      button.title = label;
      button.setAttribute("aria-label", label);
      const destination = OverviewTree.navigate(tree, index, key);
      button.disabled = destination === null;
      button.addEventListener("click", () => navigate(destination));
      wrapper.append(button);
      selectedCard.append(wrapper);
      return wrapper;
    }
    navigation("ArrowUp", "↑", "Elternknoten (Pfeil hoch)", "up");
    navigation("ArrowLeft", "←", "Linkes Geschwister (Pfeil links)", "left");
    navigation("ArrowRight", "→", "Rechtes Geschwister (Pfeil rechts)", "right");
    const down = navigation("ArrowDown", "↓ / 1", "Linkestes Kind (Pfeil runter oder Taste 1)", "bottom");
    childIndices.forEach((child, order) => {
      if (order === 0) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "detail-nav";
      button.textContent = String(order + 1);
      button.title = `${order + 1}. Kindknoten (Taste ${order + 1})`;
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => navigate(child));
      down.append(button);
    });
    activeRow.append(item);
    if (childIndices.length) {
      for (const childIndex of childIndices) {
        const childItem = displayedNode(childIndex, isOptimal(tree, index, childIndex, revealed));
        childRow.append(childItem);
      }
    } else if (TicTacToe.result(board)) {
      note(childRow, "Bei Endzuständen soll der Score reflektieren, wer das Spiel gewonnen hat.");
    }
    rows.append(parentRow, activeRow, childRow);
    const bands = document.createElement("div");
    bands.className = "detail-bands";
    const labels = document.createElement("div");
    labels.className = "detail-labels";
    for (const [level, player] of [parent !== -1 ? other(turn) : null, turn, childIndices.length ? other(turn) : null].entries()) {
      const band = document.createElement("div");
      band.className = `detail-band${player ? ` band-${player.toLowerCase()}` : ""}`;
      band.style.top = `${level * 192}px`;
      bands.append(band);
      const label = document.createElement("div");
      label.className = "detail-label-row";
      label.style.top = `${level * 192}px`;
      if (player) label.append(createLevelLabel(player, level === 1 && Boolean(TicTacToe.result(board))));
      labels.append(label);
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("detail-edges");
    svg.setAttribute("aria-hidden", "true");
    container.classList.toggle("with-pruning", tree.pruning);
    container.replaceChildren(bands, svg, rows, labels);
  }

  function layoutSelection(container, tree, index, path, step = null) {
    const root = container.querySelector(".detail-active > li");
    if (!root) return;
    const svg = container.querySelector(".detail-edges");
    const containerRect = container.getBoundingClientRect();
    const cardRect = item => {
      const rect = item.querySelector(":scope > .tree-card").getBoundingClientRect();
      return { x: rect.left - containerRect.left + rect.width / 2, top: rect.top - containerRect.top, bottom: rect.bottom - containerRect.top };
    };
    const parentCard = cardRect(root);
    const childItems = Array.from(container.querySelectorAll(".detail-children > li[data-node]"));
    const ancestor = container.querySelector(".detail-parent > li[data-node]");
    svg.replaceChildren();
    svg.setAttribute("width", containerRect.width);
    svg.setAttribute("height", containerRect.height);
    const pathEdges = [];
    function line(x1, y1, x2, y2, node, onPath) {
      const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [name, value] of Object.entries({ x1, y1, x2, y2 })) edge.setAttribute(name, String(value));
      const generated = OverviewTree.isGenerated(tree, node, step);
      const pruned = OverviewTree.isPruned(tree, node, step);
      edge.setAttribute("stroke", pruned ? "#e8b3ae" : generated ? OverviewTree.scoreColor(OverviewTree.nodeValue(tree, node, step)) : "#81968a");
      edge.setAttribute("stroke-width", "3");
      if (!generated && !pruned) {
        edge.setAttribute("stroke-dasharray", "2 4");
        edge.setAttribute("opacity", ".45");
      }
      svg.append(edge);
      if (onPath) pathEdges.push(edge);
    }
    function prunedEdges(card, node, length) {
      if (step && tree.prunedBy) return;
      OverviewTree.cutMoves(tree, node, step).forEach((move, order) => {
        const x1 = card.x;
        const y1 = card.bottom;
        const x2 = x1 + (order + 1) * 16;
        const y2 = y1 + length;
        const crossX = x1 + (x2 - x1) * 0.7;
        const crossY = y1 + length * 0.7;
        const edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
        edge.classList.add("pruned-edge");
        edge.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2} M ${crossX - 4} ${crossY - 4} L ${crossX + 4} ${crossY + 4} M ${crossX - 4} ${crossY + 4} L ${crossX + 4} ${crossY - 4}`);
        edge.setAttribute("stroke", "#b63832");
        edge.setAttribute("stroke-width", "3");
        edge.setAttribute("fill", "none");
        svg.append(edge);
      });
    }
    if (ancestor) {
      const ancestorCard = cardRect(ancestor);
      line(ancestorCard.x, ancestorCard.bottom, parentCard.x, parentCard.top, index, path.includes(index) && path.includes(tree.parents[index]));
      if (tree.parents[tree.parents[index]] !== -1) {
        line(ancestorCard.x, ancestorCard.top - 26, ancestorCard.x, ancestorCard.top, tree.parents[index], path.includes(tree.parents[index]));
      }
    }
    prunedEdges(parentCard, index, 32);
    for (const childItem of childItems) {
      const childIndex = Number(childItem.dataset.node);
      const childCard = cardRect(childItem);
      prunedEdges(childCard, childIndex, 27);
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
