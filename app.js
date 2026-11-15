"use strict";

const byId = id => document.getElementById(id);
const boardElement = byId("board");
const modeElement = byId("mode");
const cells = [];
let board;
let turn;
let outcome;
let timer = null;
let overview = null;
let overviewJob = 0;
let overviewFrame = null;
let zoomLevel = 0;
let expectedScrollLeft = 0;
let hoverDirection = 0;
let hoverFrame = null;
let lastHoverTime = null;
let hoverDistance = 0;
let wheelDelta = 0;
let lastWheelTime = 0;
let selectedNode = null;
let selectedPath = [];
let stepState = null;
let stepTimer = null;
let hoveredNode = null;
let overviewDrag = null;
let ignoreOverviewClick = false;
const positionSteps = 1000000000;
const stepSpeeds = [
  { delay: 1000, count: 1, label: "1×" },
  { delay: 250, count: 1, label: "4×" },
  { delay: 50, count: 1, label: "20×" },
  { delay: 10, count: 1, label: "100×" },
  { delay: 30, count: 1000, label: "Schnell" }
];
const stepSpeed = () => stepSpeeds[Number(byId("step-speed").value)];

const roles = {
  "human-computer": { X: "Mensch", O: "Computer" },
  "human-human": { X: "Mensch", O: "Mensch" },
  "computer-human": { X: "Computer", O: "Mensch" }
};

function render() {
  const currentRoles = roles[modeElement.value];
  const computerTurn = !outcome && currentRoles[turn] === "Computer";
  byId("role-x").textContent = currentRoles.X;
  byId("role-o").textContent = currentRoles.O;
  for (const player of ["X", "O"]) {
    const active = !outcome && turn === player;
    byId(`actor-${player.toLowerCase()}`).classList.toggle("active", active);
    byId(`status-${player.toLowerCase()}`).textContent = active ? "Am Zug" : "";
  }
  byId("move-count").textContent = outcome ? "Spiel beendet" : `Zug ${board.filter(Boolean).length + 1}`;
  const turnBox = byId("turn-box");
  turnBox.className = `turn-box ${outcome && !outcome.winner ? "draw" : `player-${(outcome ? outcome.winner : turn).toLowerCase()}`}`;
  turnBox.classList.toggle("thinking", computerTurn);
  byId("game-status").textContent = outcome
    ? outcome.winner ? `${outcome.winner} gewinnt!` : "Unentschieden!"
    : `${turn} ist am Zug${computerTurn ? " · Computer überlegt" : ""}`;
  byId("instruction").textContent = outcome ? "Starte ein neues Spiel." : computerTurn ? "Bitte kurz warten." : "Klicke auf ein freies Feld.";

  cells.forEach((cell, index) => {
    const symbol = board[index];
    cell.textContent = symbol || "";
    cell.className = `cell${symbol ? ` player-${symbol.toLowerCase()}` : ""}${outcome && outcome.line.includes(index) ? " winning" : ""}`;
    cell.disabled = Boolean(symbol || outcome || computerTurn);
    cell.setAttribute("aria-label", `Zeile ${Math.floor(index / 3) + 1}, Spalte ${index % 3 + 1}: ${symbol || "frei"}${outcome && outcome.line.includes(index) ? ", Gewinnfeld" : ""}`);
  });
}

function play(index) {
  if (outcome || board[index]) return;
  board[index] = turn;
  outcome = TicTacToe.result(board);
  if (!outcome) turn = turn === "X" ? "O" : "X";
  render();
  scheduleComputer();
}

function scheduleComputer() {
  if (timer !== null || byId("explorer").open || outcome || roles[modeElement.value][turn] !== "Computer") return;
  timer = setTimeout(() => {
    timer = null;
    play(TicTacToe.bestMove(board, turn));
  }, 650);
}

function startGame() {
  clearTimeout(timer);
  timer = null;
  board = Array(9).fill(null);
  turn = "X";
  outcome = null;
  render();
  scheduleComputer();
}

for (let index = 0; index < 9; index++) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.addEventListener("click", () => {
    if (roles[modeElement.value][turn] === "Mensch") play(index);
  });
  cells.push(cell);
  boardElement.append(cell);
}
modeElement.addEventListener("change", startGame);
byId("restart").addEventListener("click", startGame);
function drawOverview() {
  if (!overview || byId("overview-panel").hidden) return;
  const zoom = 2 ** Number(byId("overview-zoom").value);
  const position = Number(byId("overview-position").value) / positionSteps;
  const revealed = stepState ? stepState.revealed : null;
  const generatedThrough = revealed ? stepState.generatedThrough : null;
  const leafWidth = OverviewTree.draw(byId("overview-canvas"), overview, zoom, position, selectedNode, hoveredNode, selectedPath, revealed, generatedThrough);
  byId("overview-canvas").style.cursor = overviewDrag && overviewDrag.dragging ? "grabbing" : leafWidth < 10 ? "zoom-in" : "pointer";
  byId("detail-hint").textContent = leafWidth < 10
    ? "Für Detailansichten höhere Zoomstufe einstellen. Klick vergrössert."
    : "Für Detailansicht Knoten wählen.";
  byId("detail-zoom-note").hidden = leafWidth >= 10;
  byId("zoom-value").textContent = `${zoom}×`;
  byId("overview-zoom").setAttribute("aria-valuetext", `${zoom}-fach`);
  byId("overview-position").setAttribute("aria-valuetext", `${Math.round(position * 100)} Prozent`);
  byId("overview-position").disabled = zoom === 1;
  for (const id of ["pan-left", "pan-right"]) byId(id).setAttribute("aria-disabled", String(zoom === 1));
  const scrollbar = byId("overview-hscroll");
  byId("overview-htrack").style.width = `${Math.min(4000000, scrollbar.clientWidth * zoom)}px`;
  scrollbar.scrollLeft = position * (scrollbar.scrollWidth - scrollbar.clientWidth);
  expectedScrollLeft = scrollbar.scrollLeft;
  const density = leafWidth < 2
    ? `Pro Endstand ${leafWidth.toFixed(leafWidth < 0.01 ? 3 : 2)} px Platz: einzelne Knoten sind nicht unterscheidbar, Farben werden gemischt.`
    : `Pro Endstand ${leafWidth.toFixed(1)} px Platz.`;
  const endLabel = overview.leafCount === 1 ? "Endstand" : "Endstände";
  const status = `${overview.nodeCount.toLocaleString("de-CH")} Knoten · ${overview.leafCount.toLocaleString("de-CH")} ${endLabel}. ${density}`;
  if (byId("overview-status").textContent !== status) byId("overview-status").textContent = status;
}

function setOverviewPosition(position) {
  const slider = byId("overview-position");
  const value = Math.round(Math.max(0, Math.min(1, position)) * positionSteps);
  if (Number(slider.value) === value) return false;
  slider.value = String(value);
  scheduleOverviewDraw();
  return true;
}

function changeOverviewZoom(level, anchor) {
  const nextLevel = Math.max(0, Math.min(18, level));
  if (nextLevel === zoomLevel) {
    byId("overview-zoom").value = String(nextLevel);
    return;
  }
  const position = Number(byId("overview-position").value) / positionSteps;
  const nextPosition = OverviewTree.zoomPosition(2 ** zoomLevel, position, 2 ** nextLevel, anchor);
  zoomLevel = nextLevel;
  byId("overview-zoom").value = String(nextLevel);
  setOverviewPosition(nextPosition);
  scheduleOverviewDraw();
}

function panOverview(viewportFraction) {
  const zoom = 2 ** zoomLevel;
  if (!overview || zoom === 1) return false;
  const position = Number(byId("overview-position").value) / positionSteps;
  return setOverviewPosition(position + viewportFraction / (zoom - 1));
}

function stopHoverPan() {
  hoverDirection = 0;
  if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
  hoverFrame = null;
  lastHoverTime = null;
  hoverDistance = 0;
}

function startHoverPan(direction) {
  stopHoverPan();
  hoverDirection = direction;
  function frame(time) {
    hoverFrame = null;
    if (!hoverDirection || !overview || byId("overview-panel").hidden || !byId("explorer").open) return;
    if (lastHoverTime !== null) {
      const seconds = Math.min((time - lastHoverTime) / 1000, 0.1);
      hoverDistance += hoverDirection * seconds * 0.7;
      const zoom = 2 ** zoomLevel;
      if (zoom === 1) return;
      if (Math.abs(hoverDistance) * positionSteps / (zoom - 1) >= 1) {
        const moved = panOverview(hoverDistance);
        hoverDistance = 0;
        if (!moved) return;
      }
    }
    lastHoverTime = time;
    hoverFrame = requestAnimationFrame(frame);
  }
  if (overview && zoomLevel > 0) hoverFrame = requestAnimationFrame(frame);
}

function scheduleOverviewDraw() {
  if (overviewFrame !== null) return;
  overviewFrame = requestAnimationFrame(() => {
    overviewFrame = null;
    drawOverview();
  });
}

function updateStepControls() {
  const done = !stepState || stepState.current === -1;
  byId("step-mode-control").hidden = done;
  byId("pending-legend").hidden = done;
  byId("step-status").hidden = done;
  byId("step-end").setAttribute("aria-pressed", String(done));
  byId("step-start").disabled = !overview;
  byId("step-next").disabled = !overview || done || stepState.running;
  byId("step-play").disabled = !overview || done || stepState.running;
  byId("step-stop").disabled = !stepState || !stepState.running;
  byId("step-focus").hidden = done || selectedNode === stepState.current;
  if (done) return;
  byId("step-status").setAttribute("aria-live", stepState.running ? "off" : "polite");
  const position = OverviewTree.positionAt(overview, stepState.current);
  const instruction = TicTacToe.result(position.board)
    ? "Bewerte den Endstand."
    : `${position.turn === "X" ? "MAX" : "MIN"} wählt den ${position.turn === "X" ? "grössten" : "kleinsten"} Wert der besuchten Folgezüge.`;
  byId("step-status").textContent = `Schritt ${(stepState.completed + 1).toLocaleString("de-CH")} / ${overview.nodeCount.toLocaleString("de-CH")}: ${instruction}`;
}

function pauseSteps() {
  if (stepTimer !== null) clearTimeout(stepTimer);
  stepTimer = null;
  if (stepState) stepState.running = false;
}

function focusStep(node = stepState && stepState.current) {
  if (!overview || node === null || node === -1) return;
  const canvas = byId("overview-canvas");
  const width = OverviewTree.plotBounds(canvas.clientWidth).width;
  const target = Math.ceil(Math.log2(10 * overview.leafCount / width));
  if (zoomLevel < target) changeOverviewZoom(target, 0.5);
  const zoom = 2 ** zoomLevel;
  const center = (overview.starts[node] + overview.ends[node]) / (2 * overview.leafCount);
  if (zoom > 1) setOverviewPosition((center - 1 / (2 * zoom)) / (1 - 1 / zoom));
  const scroll = byId("overview-scroll");
  const y = overview.depths[node] * 48 + 24;
  if (y < scroll.scrollTop || y > scroll.scrollTop + scroll.clientHeight) {
    scroll.scrollTop = Math.max(0, y - scroll.clientHeight / 2);
  }
  showNodeDetail(node, true);
}

function advanceStep(count = 1) {
  if (!stepState || stepState.current === -1) return;
  const detail = byId("node-detail-tree");
  const restoreFocus = !stepState.running && document.activeElement && detail.contains(document.activeElement);
  for (let i = 0; i < count && stepState.current !== -1; i++) {
    const current = stepState.current;
    stepState.revealed[current] = 1;
    stepState.completed++;
    stepState.current = OverviewTree.nextPostorder(overview, current);
    stepState.answers = {};
    if (stepState.current !== -1) stepState.generatedThrough = Math.max(stepState.generatedThrough, stepState.current);
  }
  if (stepState.current === -1) {
    endSearch();
  } else {
    focusStep();
    const choice = restoreFocus && detail.querySelector(".step-score-choices button");
    if (choice) choice.focus({ preventScroll: true });
  }
  updateStepControls();
}

function checkStep(choice, field = "value") {
  if (!stepState || stepState.current === -1) return "Die Suche ist bereits abgeschlossen.";
  if (!["value", ...(overview.pruning ? ["alpha", "beta"] : [])].includes(field)) {
    throw new Error("Unbekanntes Eingabefeld für diesen Suchschritt.");
  }
  if (choice === null) return "Wähle zuerst einen Wert.";
  const expected = field === "alpha" ? overview.alphas : field === "beta" ? overview.betas : overview.values;
  if (choice !== expected[stepState.current]) return "Das stimmt noch nicht. Versuch es erneut.";
  stepState.answers[field] = true;
  if (stepState.answers.value && (!overview.pruning || stepState.answers.alpha && stepState.answers.beta)) {
    advanceStep();
  } else {
    showNodeDetail(stepState.current, true);
  }
  return "";
}

function runSteps() {
  stepTimer = null;
  if (!stepState || !stepState.running) return;
  if (!byId("explorer").open) {
    pauseSteps();
    return;
  }
  if (byId("step-mode").checked) {
    pauseSteps();
    focusStep();
    return;
  }
  const speed = stepSpeed();
  advanceStep(speed.count);
  if (stepState && stepState.running) stepTimer = setTimeout(runSteps, speed.delay);
}

function startSearch() {
  if (!overview) return;
  pauseSteps();
  const first = OverviewTree.firstPostorder(overview);
  stepState = { revealed: new Uint8Array(overview.nodeCount), current: first, generatedThrough: first, completed: 0, running: false, answers: {} };
  selectedPath = [];
  stopHoverPan();
  focusStep();
  updateStepControls();
}

function endSearch() {
  pauseSteps();
  stepState = null;
  if (overview) {
    selectedPath = OverviewTree.optimalPath(overview);
    zoomLevel = 0;
    byId("overview-zoom").value = "0";
    byId("overview-position").value = String(positionSteps / 2);
    byId("overview-scroll").scrollTop = 0;
    showNodeDetail(0, true);
  }
  updateStepControls();
}

function renderLevelLabels(tree) {
  const labels = byId("level-labels");
  labels.replaceChildren();
  for (let depth = 0; depth <= tree.maxDepth; depth++) {
    const player = depth % 2 === 0 ? tree.turn : tree.turn === "X" ? "O" : "X";
    labels.append(MinimaxExplorer.createLevelLabel(player, tree.nodeCount === 1));
  }
}

function rebuildOverview() {
  const currentBoard = board.slice();
  const currentTurn = turn;
  const job = ++overviewJob;
  const pruning = byId("pruning").checked;
  const selectedMoves = [];
  const restartingSteps = stepState !== null;
  if (!stepState && overview && selectedNode !== null) {
    for (let node = selectedNode; overview.parents[node] !== -1; node = overview.parents[node]) selectedMoves.push(overview.moves[node]);
    selectedMoves.reverse();
  }
  const hadSelection = !stepState && overview && selectedNode !== null;
  pauseSteps();
  stepState = null;
  overview = null;
  selectedNode = null;
  selectedPath = [];
  hoveredNode = null;
  stopHoverPan();
  byId("overview-zoom").disabled = true;
  byId("overview-position").disabled = true;
  byId("pruning").disabled = true;
  byId("overview-status").textContent = "Spielbaum wird berechnet …";
  byId("overview-canvas").hidden = true;
  byId("level-labels").replaceChildren();
  byId("node-detail-tree").replaceChildren();
  updateStepControls();
  const note = byId("pruning-note");
  const pruningExplanation = "Pruning: Nur besuchte Zweige; ≤/≥ sind Schranken.";
  note.textContent = `${pruning ? pruningExplanation : ""}${restartingSteps ? `${pruning ? " " : ""}Die Schrittfolge wurde neu gestartet.` : ""}`;
  note.hidden = !pruning && !restartingSteps;
  setTimeout(() => {
    if (job !== overviewJob) return;
    overview = OverviewTree.build(currentBoard, currentTurn, pruning);
    if (hadSelection) {
      selectedNode = 0;
      for (const move of selectedMoves) {
        const next = OverviewTree.children(overview, selectedNode).find(child => overview.moves[child] === move);
        if (next === undefined) {
          note.textContent = `${pruningExplanation} Der untersuchte Zweig wurde abgeschnitten; ausgewählt bleibt der letzte sichtbare Knoten.`;
          note.hidden = false;
          break;
        }
        selectedNode = next;
      }
    }
    renderLevelLabels(overview);
    byId("overview-canvas").hidden = false;
    byId("overview-zoom").disabled = false;
    byId("pruning").disabled = false;
    if (restartingSteps) startSearch();
    else {
      selectedPath = OverviewTree.optimalPath(overview);
      showNodeDetail(selectedNode === null ? 0 : selectedNode, true);
    }
  }, 50);
}

byId("show-explorer").addEventListener("click", () => {
  clearTimeout(timer);
  timer = null;
  overview = null;
  selectedNode = null;
  selectedPath = [];
  pauseSteps();
  stepState = null;
  stopHoverPan();
  zoomLevel = 0;
  wheelDelta = 0;
  byId("overview-zoom").value = "0";
  byId("overview-zoom").disabled = true;
  byId("overview-position").value = "500000000";
  byId("zoom-value").textContent = "1×";
  byId("overview-position").disabled = true;
  byId("overview-htrack").style.width = "0px";
  byId("overview-hscroll").scrollLeft = 0;
  expectedScrollLeft = 0;
  for (const id of ["pan-left", "pan-right"]) byId(id).setAttribute("aria-disabled", "true");
  byId("step-mode").checked = false;
  updateStepControls();
  byId("explorer").showModal();
  rebuildOverview();
});
byId("close-explorer").addEventListener("click", () => {
  pauseSteps();
  byId("explorer").close();
});
byId("explorer").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    pauseSteps();
    byId("explorer").close();
  }
});
byId("explorer").addEventListener("close", () => {
  if (byId("explorer").open) return;
  overviewJob++;
  overview = null;
  pauseSteps();
  stepState = null;
  stopHoverPan();
  scheduleComputer();
});
byId("step-start").addEventListener("click", startSearch);
byId("step-end").addEventListener("click", endSearch);
byId("step-next").addEventListener("click", () => {
  if (byId("step-mode").checked) focusStep();
  else advanceStep();
});
byId("step-play").addEventListener("click", () => {
  if (!stepState || stepState.current === -1) return;
  if (byId("step-mode").checked) {
    pauseSteps();
    focusStep();
  } else if (!stepState.running) {
    stepState.running = true;
    focusStep();
    stepTimer = setTimeout(runSteps, stepSpeed().delay);
  }
  updateStepControls();
});
byId("step-stop").addEventListener("click", () => {
  pauseSteps();
  if (overview && selectedNode !== null) showNodeDetail(selectedNode, true);
});
byId("step-mode").addEventListener("change", () => {
  pauseSteps();
  focusStep();
});
byId("step-speed").addEventListener("input", () => {
  const speed = stepSpeed();
  byId("step-speed-value").textContent = speed.label;
  byId("step-speed").setAttribute("aria-valuetext", speed.label === "Schnell" ? "Schnell, 1000 Schritte pro Bild" : speed.label);
  if (stepState && stepState.running) {
    clearTimeout(stepTimer);
    stepTimer = setTimeout(runSteps, speed.delay);
  }
});
byId("step-focus").addEventListener("click", () => focusStep());
byId("detail-zoom").addEventListener("click", () => {
  if (!overview) return;
  focusStep(0);
});
byId("pruning").addEventListener("change", rebuildOverview);
byId("overview-zoom").addEventListener("input", event => changeOverviewZoom(Number(event.target.value), 0.5));
byId("overview-position").addEventListener("input", scheduleOverviewDraw);
byId("overview-hscroll").addEventListener("scroll", event => {
  const scrollbar = event.currentTarget;
  if (Math.abs(scrollbar.scrollLeft - expectedScrollLeft) < 1) return;
  const range = scrollbar.scrollWidth - scrollbar.clientWidth;
  if (range > 0) setOverviewPosition(scrollbar.scrollLeft / range);
});
byId("overview-viewport").addEventListener("wheel", event => {
  if (!overview) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? event.currentTarget.clientHeight : 1;
  const horizontal = event.shiftKey ? event.deltaY || event.deltaX : event.deltaX;
  if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    event.preventDefault();
    const plotWidth = OverviewTree.plotBounds(byId("overview-canvas").clientWidth).width;
    panOverview(horizontal * unit / plotWidth);
    return;
  }
  if (!event.deltaY) return;
  event.preventDefault();
  if (event.timeStamp - lastWheelTime > 250 || Math.sign(wheelDelta) !== Math.sign(event.deltaY)) wheelDelta = 0;
  lastWheelTime = event.timeStamp;
  wheelDelta += event.deltaY * unit;
  if (Math.abs(wheelDelta) < 40) return;
  const rect = byId("overview-canvas").getBoundingClientRect();
  const bounds = OverviewTree.plotBounds(rect.width);
  const anchor = Math.max(0, Math.min(1, (event.clientX - rect.left - bounds.left) / bounds.width));
  changeOverviewZoom(zoomLevel - Math.sign(wheelDelta), anchor);
  wheelDelta = 0;
  if (hoverDirection && hoverFrame === null) startHoverPan(hoverDirection);
}, { passive: false });
byId("overview-canvas").addEventListener("pointermove", event => {
  if (!overview) return;
  if (overviewDrag && event.pointerId === overviewDrag.pointerId) {
    if (!overviewDrag.dragging && Math.hypot(event.clientX - overviewDrag.startX, event.clientY - overviewDrag.startY) >= 5) {
      overviewDrag.dragging = true;
      hoveredNode = null;
      event.currentTarget.style.cursor = "grabbing";
      scheduleOverviewDraw();
    }
    if (overviewDrag.dragging) {
      const width = OverviewTree.plotBounds(event.currentTarget.clientWidth).width;
      panOverview(-(event.clientX - overviewDrag.lastX) / width);
      overviewDrag.lastX = event.clientX;
    }
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const node = OverviewTree.hitTest(overview, rect.width, 2 ** zoomLevel, Number(byId("overview-position").value) / positionSteps, event.clientX - rect.left, event.clientY - rect.top);
  if (node !== hoveredNode) {
    hoveredNode = node;
    scheduleOverviewDraw();
  }
});
byId("overview-canvas").addEventListener("pointerdown", event => {
  if (!overview || event.pointerType !== "mouse" || event.button !== 0) return;
  stopHoverPan();
  ignoreOverviewClick = false;
  overviewDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, dragging: false };
  event.currentTarget.setPointerCapture(event.pointerId);
});
function endOverviewDrag(event) {
  if (!overviewDrag || event.pointerId !== overviewDrag.pointerId) return;
  ignoreOverviewClick = event.type === "pointerup" && overviewDrag.dragging;
  overviewDrag = null;
  scheduleOverviewDraw();
}
byId("overview-canvas").addEventListener("pointerup", endOverviewDrag);
byId("overview-canvas").addEventListener("pointercancel", endOverviewDrag);
byId("overview-canvas").addEventListener("lostpointercapture", endOverviewDrag);
byId("overview-canvas").addEventListener("pointerleave", () => {
  if (hoveredNode !== null) {
    hoveredNode = null;
    scheduleOverviewDraw();
  }
});
function showNodeDetail(node, fromStep = false) {
  if (!fromStep && stepState && stepState.running) pauseSteps();
  selectedNode = node;
  hoveredNode = null;
  drawOverview();
  const container = byId("node-detail-tree");
  const computerTurn = !outcome && roles[modeElement.value][turn] === "Computer";
  byId("detail-root-hint").hidden = node !== 0 || outcome || computerTurn;
  MinimaxExplorer.renderSelection(container, overview, node, next => {
    showNodeDetail(next);
    byId("node-detail-title").focus({ preventScroll: true });
  }, selectedPath, !outcome && !computerTurn ? move => {
    if (selectedNode !== 0 || outcome || roles[modeElement.value][turn] !== "Mensch" || board[move]) {
      throw new Error("Der gewählte Zug kann nicht übernommen werden.");
    }
    pauseSteps();
    byId("explorer").close();
    play(move);
  } : null, stepState ? {
    revealed: stepState.revealed,
    current: stepState.current,
    generatedThrough: stepState.generatedThrough,
    manual: byId("step-mode").checked,
    answers: stepState.answers,
    check: checkStep
  } : null);
  const scroll = container.parentElement;
  scroll.scrollTo((scroll.scrollWidth - scroll.clientWidth) / 2, 0);
  MinimaxExplorer.layoutSelection(container, overview, node, selectedPath, stepState);
  updateStepControls();
}
byId("overview-canvas").addEventListener("click", event => {
  if (ignoreOverviewClick) {
    ignoreOverviewClick = false;
    return;
  }
  if (!overview) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const bounds = OverviewTree.plotBounds(rect.width);
  const position = Number(byId("overview-position").value) / positionSteps;
  const layout = OverviewTree.geometry(overview, rect.width, 2 ** zoomLevel, position);
  if (layout.leafWidth < 10) {
    const target = Math.ceil(Math.log2(10 * overview.leafCount / bounds.width));
    const anchor = Math.max(0, Math.min(1, (event.clientX - rect.left - bounds.left) / bounds.width));
    changeOverviewZoom(target, anchor);
    return;
  }
  const node = OverviewTree.hitTest(overview, rect.width, 2 ** zoomLevel, position, event.clientX - rect.left, event.clientY - rect.top);
  if (node === null) return;
  showNodeDetail(node);
});
for (const [id, direction] of [["pan-left", -1], ["pan-right", 1]]) {
  const edge = byId(id);
  edge.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse" && !overviewDrag) startHoverPan(direction);
  });
  edge.addEventListener("pointerleave", stopHoverPan);
  edge.addEventListener("pointercancel", stopHoverPan);
  edge.addEventListener("click", () => panOverview(direction * 0.7));
}
window.addEventListener("resize", () => {
  if (byId("explorer").open) scheduleOverviewDraw();
  if (byId("explorer").open && overview && selectedNode !== null) {
    MinimaxExplorer.layoutSelection(byId("node-detail-tree"), overview, selectedNode, selectedPath, stepState);
  }
});
startGame();
