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
let stepTransitionTimer = null;
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
  const width = OverviewTree.plotBounds(byId("overview-canvas").clientWidth).width;
  const canZoom = width / overview.leafCount < 10;
  const maximum = maximumOverviewZoom();
  byId("overview-zoom").max = String(maximum);
  if (zoomLevel > maximum) changeOverviewZoom(maximum, 0.5);
  byId("overview-controls").hidden = !canZoom;
  if (!canZoom) {
    zoomLevel = 0;
    byId("overview-zoom").value = "0";
    byId("overview-position").value = String(positionSteps / 2);
  }
  const zoom = 2 ** Number(byId("overview-zoom").value);
  const position = Number(byId("overview-position").value) / positionSteps;
  const revealed = stepState ? stepState.revealed : null;
  const generatedThrough = revealed ? stepState.generatedThrough : null;
  const leafWidth = OverviewTree.draw(byId("overview-canvas"), overview, zoom, position, selectedNode, hoveredNode, selectedPath, revealed, generatedThrough, stepState);
  byId("overview-canvas").style.cursor = overviewDrag && overviewDrag.dragging ? "grabbing" : "pointer";
  const zoomLabel = zoom.toLocaleString("de-CH", { maximumFractionDigits: 1 });
  byId("zoom-value").textContent = `${zoomLabel}×`;
  byId("overview-zoom").setAttribute("aria-valuetext", `${zoomLabel}-fach`);
  byId("overview-position").setAttribute("aria-valuetext", `${Math.round(position * 100)} Prozent`);
  byId("overview-position").disabled = zoom === 1;
  for (const id of ["pan-left", "pan-right"]) {
    byId(id).hidden = !canZoom;
    byId(id).setAttribute("aria-disabled", String(zoom === 1));
  }
  const density = `${leafWidth.toFixed(leafWidth < 0.01 ? 3 : leafWidth < 2 ? 2 : 1)} px pro Endstand.`;
  const endLabel = overview.leafCount === 1 ? "Endstand" : "Endstände";
  const status = `${overview.nodeCount.toLocaleString("de-CH")} Knoten · ${overview.leafCount.toLocaleString("de-CH")} ${endLabel}.${canZoom ? ` ${density}` : ""}`;
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

function maximumOverviewZoom() {
  if (!overview) return 0;
  const width = OverviewTree.plotBounds(byId("overview-canvas").clientWidth).width;
  if (width / overview.leafCount >= 10) return 0;
  return Math.max(0, Math.floor(Math.log2(30 * overview.leafCount / width) * 100) / 100);
}

function changeOverviewZoom(level, anchor) {
  if (overview && OverviewTree.plotBounds(byId("overview-canvas").clientWidth).width / overview.leafCount >= 10) return;
  byId("overview-zoom-tip").hidden = true;
  const maximum = maximumOverviewZoom();
  byId("overview-zoom").max = String(maximum);
  const nextLevel = Math.max(0, Math.min(maximum, level));
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
  const busy = Boolean(stepState && (stepState.running || stepState.settling));
  byId("explorer").classList.toggle("manual-mode", !done && byId("step-mode").checked);
  byId("step-mode-control").hidden = done;
  byId("pending-legend").hidden = done;
  byId("step-status").hidden = done;
  byId("step-end").setAttribute("aria-pressed", String(done));
  byId("step-start").disabled = !overview;
  byId("step-next").disabled = !overview || done || busy;
  byId("detail-step-next").hidden = done || byId("step-mode").checked;
  byId("detail-step-next").disabled = done || busy;
  byId("step-play").disabled = !overview || done || busy;
  byId("step-stop").disabled = !busy;
  byId("step-focus").hidden = done || selectedNode === stepState.current;
  if (done) return;
  byId("step-status").setAttribute("aria-live", stepState.running ? "off" : "polite");
  const position = OverviewTree.positionAt(overview, stepState.current);
  const instruction = stepState.phase === "prune"
    ? "Pruning-Bedingung erfüllt? Nächsten Ast abschneiden oder generieren?"
    : TicTacToe.result(position.board)
    ? "Bewerte den Endstand."
    : `${position.turn === "X" ? "MAX" : "MIN"} wählt den ${position.turn === "X" ? "grössten" : "kleinsten"} Score der besuchten Folgezüge.`;
  byId("step-status").textContent = `Schritt ${(stepState.steps + 1).toLocaleString("de-CH")} · ${stepState.completed.toLocaleString("de-CH")} / ${overview.visitedNodeCount.toLocaleString("de-CH")} Knoten bewertet: ${instruction}`;
}

function pauseSteps() {
  if (stepTimer !== null) clearTimeout(stepTimer);
  stepTimer = null;
  if (stepTransitionTimer !== null) clearTimeout(stepTransitionTimer);
  stepTransitionTimer = null;
  if (stepState) {
    stepState.running = false;
    if (stepState.settling) {
      stepState.settling = false;
      if (overview) OverviewTree.advanceSearch(overview, stepState);
    }
  }
}

function focusStep(node = stepState && stepState.current) {
  if (!overview || node === null || node === -1) return;
  const canvas = byId("overview-canvas");
  const width = OverviewTree.plotBounds(canvas.clientWidth).width;
  const target = Math.ceil(Math.log2(10 * overview.leafCount / width));
  if (zoomLevel < target) changeOverviewZoom(target, 0.5);
  showNodeDetail(node, true);
}

function keepNodeVisible(node) {
  const zoom = 2 ** zoomLevel;
  if (zoom === 1) return;
  const canvas = byId("overview-canvas");
  const position = Number(byId("overview-position").value) / positionSteps;
  const layout = OverviewTree.geometry(overview, canvas.clientWidth, zoom, position);
  const x = layout.x(node);
  if (x >= layout.left + 10 && x <= canvas.clientWidth - layout.right - 10) return;
  const center = (overview.starts[node] + overview.ends[node]) / (2 * overview.leafCount);
  setOverviewPosition((center - 1 / (2 * zoom)) / (1 - 1 / zoom));
}

function advanceStep(count = 1) {
  if (!stepState || stepState.current === -1) return;
  const detail = byId("node-detail-tree");
  const restoreFocus = !stepState.running && document.activeElement && detail.contains(document.activeElement);
  for (let i = 0; i < count && stepState.current !== -1; i++) OverviewTree.advanceSearch(overview, stepState);
  if (stepState.current === -1) {
    endSearch();
  } else {
    focusStep();
    if (restoreFocus) {
      const target = detail.querySelector(".step-score-choices button") || byId("node-detail-title");
      target.focus({ preventScroll: true });
    }
  }
  updateStepControls();
}

function animateStep() {
  if (!stepState || stepState.current === -1 || stepState.settling) return;
  const restoreFocus = byId("step-mode").checked ||
    document.activeElement && byId("node-detail-tree").contains(document.activeElement);
  const duration = stepState.running ? Math.min(250, stepSpeed().delay) : 250;
  stepState.preview = OverviewTree.expectedStep(overview, stepState);
  stepState.settling = true;
  focusStep();
  if (restoreFocus) byId("node-detail-title").focus({ preventScroll: true });
  stepTransitionTimer = setTimeout(() => {
    stepTransitionTimer = null;
    stepState.settling = false;
    advanceStep();
    if (restoreFocus && stepState) {
      const target = byId("node-detail-tree").querySelector(".step-score-choices button") || byId("node-detail-title");
      target.focus({ preventScroll: true });
    }
    if (stepState && stepState.running) {
      stepTimer = setTimeout(runSteps, Math.max(0, stepSpeed().delay - duration));
    }
  }, duration);
}

function checkStep(choice) {
  if (!stepState || stepState.current === -1) return "Die Suche ist bereits abgeschlossen.";
  if (choice === null) return "Wähle zuerst einen Score.";
  if (stepState.settling) return "Der Score wird gerade eingesetzt. Bitte kurz warten.";
  if (choice !== OverviewTree.expectedStep(overview, stepState)) return "Das stimmt noch nicht. Versuch es erneut.";
  animateStep();
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
  if (speed.count === 1) animateStep();
  else {
    advanceStep(speed.count);
    if (stepState && stepState.running) stepTimer = setTimeout(runSteps, speed.delay);
  }
}

function startSearch() {
  if (!overview) return;
  pauseSteps();
  if (overview.pruning && !overview.prunedBy) {
    overview = OverviewTree.build(overview.board, overview.turn, true, true);
    renderLevelLabels(overview);
  }
  if (overview.pruning) byId("pruning-note").textContent = "Blassrot: durch Pruning ausgeschlossene Teilbäume. ≤/≥: Schranken.";
  stepState = OverviewTree.createSearch(overview);
  selectedPath = [];
  stopHoverPan();
  focusStep();
  updateStepControls();
}

function endSearch() {
  pauseSteps();
  stepState = null;
  if (overview) {
    if (overview.prunedBy) {
      overview = OverviewTree.build(overview.board, overview.turn, true);
      renderLevelLabels(overview);
    }
    if (overview.pruning) byId("pruning-note").textContent = "Rot durchgestrichen: abgeschnittene Äste. ≤/≥: Schranken.";
    selectedPath = OverviewTree.optimalPath(overview);
    zoomLevel = 0;
    byId("overview-zoom").value = "0";
    byId("overview-position").value = String(positionSteps / 2);
    showNodeDetail(0, true);
  }
  updateStepControls();
}

function renderLevelLabels(tree) {
  const labels = byId("level-labels");
  labels.replaceChildren();
  for (let depth = 0; depth <= tree.maxDepth; depth++) {
    const player = depth % 2 === 0 ? tree.turn : tree.turn === "X" ? "O" : "X";
    const label = MinimaxExplorer.createLevelLabel(player, tree.nodeCount === 1);
    label.style.height = `${300 / (tree.maxDepth + 1)}px`;
    labels.append(label);
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
  byId("worksheet").hidden = true;
  byId("worksheet-status").hidden = true;
  updateStepControls();
  const note = byId("pruning-note");
  const pruningExplanation = "Rot durchgestrichen: abgeschnittene Äste. ≤/≥: Schranken.";
  note.textContent = `${pruning ? pruningExplanation : ""}${restartingSteps ? `${pruning ? " " : ""}Die Schrittfolge wurde neu gestartet.` : ""}`;
  note.hidden = !pruning && !restartingSteps;
  setTimeout(() => {
    if (job !== overviewJob) return;
    overview = OverviewTree.build(currentBoard, currentTurn, pruning, restartingSteps);
    byId("worksheet").hidden = overview.starts.length > MinimaxWorksheet.maxNodes;
    if (hadSelection) {
      selectedNode = 0;
      for (const move of selectedMoves) {
        const next = OverviewTree.children(overview, selectedNode).find(child => overview.moves[child] === move);
        if (next === undefined) {
          note.textContent = `${pruningExplanation} Der untersuchte Zweig wurde abgeschnitten; aktiv bleibt der letzte sichtbare Knoten.`;
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
function downloadWorksheet() {
  const status = byId("worksheet-status");
  status.hidden = true;
  if (!overview) {
    status.hidden = false;
    status.textContent = "Der Spielbaum wird noch berechnet.";
    return;
  }
  if (overview.starts.length > MinimaxWorksheet.maxNodes) {
    status.hidden = false;
    status.textContent = `PDF nur für vollständige Bäume mit höchstens ${MinimaxWorksheet.maxNodes} Knoten verfügbar (aktuell ${overview.starts.length}).`;
    return;
  }
  try {
    const pdf = MinimaxWorksheet.create(overview.board, overview.turn, overview.pruning);
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "minimax-aufgabenblatt.pdf";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error("PDF konnte nicht erstellt werden:", error);
    status.hidden = false;
    status.textContent = `PDF konnte nicht erstellt werden: ${error.message}`;
  }
}
byId("worksheet").addEventListener("click", downloadWorksheet);
byId("explorer").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    pauseSteps();
    byId("explorer").close();
    return;
  }
  if (!overview || selectedNode === null || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.matches("input, select, textarea, [contenteditable='true']")) return;
  if (event.key.toLowerCase() === "p" && !event.repeat) {
    event.preventDefault();
    downloadWorksheet();
    return;
  }
  if (event.key === "Enter" && stepState && !byId("step-mode").checked && !stepState.running) {
    event.preventDefault();
    animateStep();
    return;
  }
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && !/^[1-9]$/.test(event.key)) return;
  event.preventDefault();
  const next = OverviewTree.navigate(overview, selectedNode, event.key);
  if (next !== null) {
    showNodeDetail(next);
    byId("node-detail-title").focus({ preventScroll: true });
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
  else animateStep();
});
byId("detail-step-next").addEventListener("click", animateStep);
byId("step-play").addEventListener("click", () => {
  if (!stepState || stepState.current === -1 || stepState.settling) return;
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
  if (stepState && stepState.current === -1) endSearch();
  else if (overview && selectedNode !== null) showNodeDetail(selectedNode, true);
});
byId("step-mode").addEventListener("change", () => {
  pauseSteps();
  if (stepState && stepState.current === -1) endSearch();
  else focusStep();
});
byId("step-speed").addEventListener("input", () => {
  const speed = stepSpeed();
  byId("step-speed-value").textContent = speed.label;
  byId("step-speed").setAttribute("aria-valuetext", speed.label === "Schnell" ? "Schnell, 1000 Schritte pro Bild" : speed.label);
  if (stepState && stepState.running && !stepState.settling) {
    clearTimeout(stepTimer);
    stepTimer = setTimeout(runSteps, speed.delay);
  }
});
byId("step-focus").addEventListener("click", () => focusStep());
byId("pruning").addEventListener("change", rebuildOverview);
byId("overview-zoom").addEventListener("input", event => changeOverviewZoom(Number(event.target.value), 0.5));
byId("overview-position").addEventListener("input", scheduleOverviewDraw);
byId("overview-viewport").addEventListener("wheel", event => {
  if (!overview) return;
  if (OverviewTree.plotBounds(byId("overview-canvas").clientWidth).width / overview.leafCount >= 10) return;
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
  byId("overview-zoom-tip").hidden = true;
  if (hoveredNode !== null) {
    hoveredNode = null;
    scheduleOverviewDraw();
  }
});
function showNodeDetail(node, fromStep = false) {
  if (!fromStep && stepState && (stepState.running || stepState.settling)) {
    pauseSteps();
    if (stepState.current === -1) {
      endSearch();
      return;
    }
  }
  selectedNode = node;
  hoveredNode = null;
  keepNodeVisible(node);
  byId("overview-zoom-tip").hidden = true;
  drawOverview();
  const container = byId("node-detail-tree");
  const computerTurn = !outcome && roles[modeElement.value][turn] === "Computer";
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
    ...stepState,
    manual: byId("step-mode").checked,
    check: checkStep
  } : null);
  updateStepControls();
  const scroll = container.parentElement;
  scroll.scrollTo((scroll.scrollWidth - scroll.clientWidth) / 2, 0);
  MinimaxExplorer.layoutSelection(container, overview, node, selectedPath, stepState);
}
byId("overview-canvas").addEventListener("click", event => {
  if (ignoreOverviewClick) {
    ignoreOverviewClick = false;
    return;
  }
  if (!overview) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const position = Number(byId("overview-position").value) / positionSteps;
  const layout = OverviewTree.geometry(overview, rect.width, 2 ** zoomLevel, position);
  if (layout.leafWidth < 10) {
    const tip = byId("overview-zoom-tip");
    tip.style.left = `${Math.max(4, Math.min(rect.width - 230, event.clientX - rect.left))}px`;
    tip.style.top = `${Math.max(4, Math.min(240, event.clientY - rect.top))}px`;
    tip.hidden = false;
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
  if (overview && selectedNode !== null) keepNodeVisible(selectedNode);
  if (byId("explorer").open) scheduleOverviewDraw();
  if (byId("explorer").open && overview && selectedNode !== null) {
    MinimaxExplorer.layoutSelection(byId("node-detail-tree"), overview, selectedNode, selectedPath, stepState);
  }
});
startGame();
