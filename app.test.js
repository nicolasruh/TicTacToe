"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const TicTacToe = require("./game.js");
const OverviewTree = require("./overview.js");
const MinimaxWorksheet = require("./worksheet.js");

function createApp() {
  const downloads = [];
  class Element {
    constructor(id) {
      this.id = id;
      this.value = "0";
      this.open = false;
      this.hidden = false;
      this.clientWidth = 1000;
      this.clientHeight = 300;
      this.scrollTop = 0;
      this.children = [];
      this.listeners = {};
      this.style = {};
      const classes = new Set();
      this.classList = {
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      };
    }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    dispatch(type, data = {}) { for (const handler of this.listeners[type] || []) handler({ target: this, currentTarget: this, preventDefault() {}, ...data }); }
    matches() { return false; }
    focus() {}
    click() { if (this.download) downloads.push(this.download); }
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch("close"); }
    scrollTo() {}
    querySelector() { return null; }
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  get("mode").value = "human-computer";
  get("step-mode").checked = false;
  get("overview-panel").hidden = true;
  get("node-detail-tree").parentElement = new Element("detail-scroll");
  let selection;
  let layoutManual;
  let nextTimer = 0;
  const timers = new Map();
  const context = vm.createContext({
    document: { getElementById: get, createElement: () => new Element() },
    window: { addEventListener() {} },
    TicTacToe,
    OverviewTree: { ...OverviewTree, draw: () => 10 },
    MinimaxWorksheet,
    Blob,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    MinimaxExplorer: {
      createLevelLabel: () => new Element(),
      renderSelection: (_container, _tree, _node, navigate, path, onMove, step) => { selection = { navigate, path, onMove, step }; },
      layoutSelection() { layoutManual = get("explorer").classList.contains("manual-mode"); }
    },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {}
  });
  vm.runInContext(fs.readFileSync(`${__dirname}/app.js`, "utf8"), context);
  const run = code => vm.runInContext(code, context);
  function showRoot() {
    run("overview = {}; byId('explorer').open = true; showNodeDetail(0)");
    return selection;
  }
  function tick() {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    timer.callback();
    return timer.delay;
  }
  return { get, run, showRoot, timers, tick, downloads, getSelection: () => selection, getLayoutManual: () => layoutManual };
}

test("Zug aus oberster Ebene übernehmen, Explorer schliessen und Computer antworten lassen", () => {
  const app = createApp();
  const selection = app.showRoot();
  selection.onMove(4);
  assert.equal(app.get("board").children[4].textContent, "X");
  assert.equal(app.get("node-detail").open, false);
  assert.equal(app.get("explorer").open, false);
  assert.match(app.get("game-status").textContent, /Computer überlegt/);
  assert.equal(app.timers.size, 1);
  const timer = [...app.timers.values()][0];
  assert.equal(timer.delay, 650);
  timer.callback();
  assert.equal(app.get("board").children.filter(cell => cell.textContent === "O").length, 1);
  assert.equal(app.get("game-status").textContent, "X ist am Zug");
});

test("übernommener Gewinnzug beendet die Partie", () => {
  const app = createApp();
  app.get("mode").value = "human-human";
  app.get("mode").dispatch("change");
  app.run("[0, 3, 1, 4].forEach(play)");
  app.showRoot().onMove(2);
  assert.equal(app.get("game-status").textContent, "X gewinnt!");
  assert.equal(app.get("board").children.filter(cell => cell.className.includes("winning")).length, 3);
  assert.equal(app.timers.size, 0);
});

test("Zugübernahme funktioniert auch für Mensch O", () => {
  const app = createApp();
  app.get("mode").value = "human-human";
  app.get("mode").dispatch("change");
  app.run("play(0)");
  app.showRoot().onMove(8);
  assert.equal(app.get("board").children[0].textContent, "X");
  assert.equal(app.get("board").children[8].textContent, "O");
  assert.equal(app.get("game-status").textContent, "X ist am Zug");
  assert.equal(app.get("explorer").open, false);
});

test("Computerzug und beendete Partie erlauben keine Zugübernahme", () => {
  const app = createApp();
  app.get("mode").value = "computer-human";
  app.get("mode").dispatch("change");
  const computer = app.showRoot();
  assert.equal(computer.onMove, null);
  app.get("mode").value = "human-human";
  app.get("mode").dispatch("change");
  app.run("[0, 3, 1, 4, 2].forEach(play)");
  const ended = app.showRoot();
  assert.equal(ended.onMove, null);
});

test("Knotenauswahl und Navigation ändern den optimalen Pfad nicht", () => {
  const app = createApp();
  app.run("overview = {}; selectedPath = [0, 5]; byId('explorer').open = true; showNodeDetail(8)");
  assert.deepEqual(Array.from(app.run("selectedPath")), [0, 5]);
  app.run("showNodeDetail(3)");
  assert.deepEqual(Array.from(app.run("selectedPath")), [0, 5]);
});

test("Schrittweise prüft Eingaben und zeigt den Pfad erst nach Abschluss", () => {
  const app = createApp();
  app.get("step-mode").checked = true;
  app.run("overview = OverviewTree.build(['X','O','X','X','O','O','O','X',null], 'X'); byId('explorer').open = true; startSearch()");
  assert.equal(app.run("stepState.current"), 1);
  assert.equal(app.run("stepState.completed"), 0);
  assert.deepEqual(Array.from(app.run("selectedPath")), []);
  assert.equal(app.getSelection().step.revealed[1], 0);
  assert.match(app.getSelection().step.check(null), /zuerst/);
  assert.match(app.getSelection().step.check(1), /stimmt noch nicht/);
  assert.equal(app.run("stepState.completed"), 0);
  assert.equal(app.getSelection().step.check(0), "");
  assert.equal(app.run("stepState.current"), 1);
  assert.equal(app.run("OverviewTree.nodeValue(overview, 1, stepState)"), 0);
  assert.equal(app.tick(), 250);
  assert.equal(app.run("stepState.current"), 0);
  assert.equal(app.run("stepState.revealed[1]"), 1);
  assert.deepEqual(Array.from(app.run("selectedPath")), []);
  app.getSelection().step.check(0);
  app.tick();
  assert.equal(app.run("stepState"), null);
  assert.deepEqual(Array.from(app.run("selectedPath")), [0, 1]);
  assert.equal(app.get("step-next").disabled, true);
});

test("Generierung ohne Pruning folgt weiterhin der Postorder-Tiefensuche", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X',null,'O',null,null,null,null], 'X'); byId('explorer').open = true; startSearch()");
  const tree = app.run("overview");
  const expected = [];
  let frontier = 0;
  function visit(node) {
    frontier = node;
    for (const child of OverviewTree.children(tree, node)) visit(child);
    expected.push({ node, frontier });
  }
  visit(0);
  for (const entry of expected) {
    assert.equal(app.run("stepState.current"), entry.node);
    assert.equal(app.run("stepState.generatedThrough"), entry.frontier);
    assert.equal(app.getSelection().step.generatedThrough, entry.frontier);
    app.run("advanceStep()");
  }
  assert.equal(app.run("stepState"), null);
});

test("Stop pausiert die Automatik und bewahrt den Fortschritt", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X','X','O','O','O','X',null], 'X'); byId('explorer').open = true; startSearch()");
  app.get("step-speed").value = "2";
  app.get("step-play").dispatch("click");
  assert.equal(app.run("stepState.running"), true);
  assert.equal(app.timers.size, 1);
  const timer = [...app.timers.values()][0];
  app.timers.clear();
  timer.callback();
  assert.equal(app.run("stepState.completed"), 0);
  assert.equal(app.run("stepState.settling"), true);
  assert.equal(app.timers.size, 1);
  app.get("step-stop").dispatch("click");
  assert.equal(app.run("stepState.running"), false);
  assert.equal(app.timers.size, 0);
  assert.equal(app.run("stepState.completed"), 1);
  assert.equal(app.run("stepState.current"), 0);
  assert.equal(app.getSelection().step.revealed[1], 1);
});

test("Explorer schliessen beendet die laufende Schritt-Automatik", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X','X','O','O','O','X',null], 'X'); byId('explorer').open = true; startSearch()");
  app.get("step-play").dispatch("click");
  assert.equal(app.timers.size, 1);
  app.get("close-explorer").dispatch("click");
  assert.equal(app.get("explorer").open, false);
  assert.equal(app.timers.size, 0);
  assert.equal(app.run("stepState"), null);
});

test("Schliessen, Ende und Neustart entfernen auch einen wartenden Wertübergang", () => {
  for (const control of ["close-explorer", "step-end", "step-start"]) {
    const app = createApp();
    app.run("overview = OverviewTree.build(['X','O','X','X','O','O','O','X',null], 'X'); byId('explorer').open = true; startSearch()");
    app.get("detail-step-next").dispatch("click");
    assert.equal(app.run("stepState.settling"), true);
    assert.equal(app.timers.size, 1);
    app.get(control).dispatch("click");
    assert.equal(app.timers.size, 0);
    if (control === "step-start") {
      assert.equal(app.run("stepState.completed"), 0);
      assert.equal(app.run("stepState.current"), 1);
    } else assert.equal(app.run("stepState"), null);
  }
});

test("schnelle Automatik verarbeitet mehrere Schritte und beendet den Baum", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X',null,'O',null,null,null,null], 'X', true); byId('explorer').open = true; startSearch()");
  app.get("step-speed").value = "4";
  app.get("step-play").dispatch("click");
  const timer = [...app.timers.values()][0];
  assert.equal(timer.delay, 30);
  app.timers.clear();
  timer.callback();
  assert.equal(app.run("stepState"), null);
  assert.deepEqual(Array.from(app.run("selectedPath")), OverviewTree.optimalPath(app.run("overview")));
  assert.equal(app.timers.size, 0);
});

test("nach Abschluss richtet sich der Graph wieder auf die Wurzel aus", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(Array(9).fill(null), 'X', true); byId('explorer').open = true; startSearch()");
  app.run("advanceStep(overview.nodeCount * 3)");
  assert.equal(app.run("selectedNode"), 0);
  assert.equal(Number(app.get("overview-position").value), 500000000);
  assert.equal(app.run("zoomLevel"), 0);
});

test("Manuell wartet bei Schritt und Abspielen auf eine korrekte Eingabe", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X','X','O','O','O','X',null], 'X'); byId('explorer').open = true; startSearch()");
  app.get("step-mode").checked = true;
  app.get("step-mode").dispatch("change");
  app.get("step-next").dispatch("click");
  app.get("step-play").dispatch("click");
  assert.equal(app.run("stepState.completed"), 0);
  assert.equal(app.timers.size, 0);
  assert.equal(app.getSelection().step.manual, true);
  app.getSelection().step.check(1);
  assert.equal(app.run("stepState.completed"), 0);
  app.getSelection().step.check(0);
  app.tick();
  assert.equal(app.run("stepState.completed"), 1);
  assert.equal(app.run("stepState.current"), 0);
  app.get("step-mode").checked = false;
  app.get("step-mode").dispatch("change");
  app.get("step-next").dispatch("click");
  app.tick();
  assert.equal(app.run("stepState"), null);
});

test("Ende beendet die Animation und setzt Root und Zoom zurück", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(Array(9).fill(null), 'X', true); byId('explorer').open = true; startSearch()");
  app.get("step-play").dispatch("click");
  app.get("step-end").dispatch("click");
  assert.equal(app.timers.size, 0);
  assert.equal(app.run("stepState"), null);
  assert.equal(app.run("zoomLevel"), 0);
  assert.equal(app.run("selectedNode"), 0);
  assert.equal(app.get("step-mode-control").hidden, true);
});

test("Pruning fragt nach Kindrückgabe und neuem Elternwert vor dem Abschneiden", () => {
  const app = createApp();
  app.get("step-mode").checked = true;
  app.run("overview = OverviewTree.build(['X','X',null,'O','O',null,null,null,null], 'X', true); byId('explorer').open = true; startSearch()");
  assert.equal(app.run("stepState.current"), 1);
  assert.match(app.getSelection().step.check(0), /stimmt noch nicht/);
  assert.equal(app.getSelection().step.check(1), "");
  app.tick();
  assert.equal(app.run("stepState.current"), 0);
  assert.equal(app.run("stepState.completed"), 1);
  assert.equal(app.run("stepState.phase"), "value");
  app.getSelection().step.check(1);
  app.tick();
  assert.equal(app.run("stepState.phase"), "prune");
  assert.equal(app.run("stepState.alphas[0]"), 1);
  assert.equal(app.run("stepState.betas[0]"), Infinity);
  assert.equal(app.run("stepState.generatedThrough"), 1);
  assert.deepEqual(Array.from(app.run("OverviewTree.cutMoves(overview, 0, stepState)")), []);
  assert.match(app.getSelection().step.check(false), /stimmt noch nicht/);
  assert.equal(app.run("stepState.completed"), 1);
  assert.equal(app.run("stepState.generatedThrough"), 1);
  app.getSelection().step.check(true);
  app.tick();
  assert.equal(app.run("stepState"), null);
  assert.equal(app.run("overview.prunedBy"), null);
  assert.equal(app.run("overview.nodeCount"), 2);
});

test("Return und Detailcontrol lösen nur in Auto den nächsten Schritt aus; Ende reduziert den Baum", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X',null,'O',null,null,null,null], 'X', true); byId('explorer').open = true; startSearch()");
  const fullCount = app.run("overview.nodeCount");
  assert.ok(app.run("overview.prunedBy"));
  assert.equal(app.get("detail-step-next").hidden, false);
  app.get("explorer").dispatch("keydown", { key: "Enter" });
  assert.equal(app.run("stepState.steps"), 0);
  assert.equal(app.get("detail-step-next").disabled, true);
  app.get("explorer").dispatch("keydown", { key: "Enter" });
  assert.equal(app.timers.size, 1);
  assert.equal(app.tick(), 250);
  assert.equal(app.run("stepState.steps"), 1);
  app.get("detail-step-next").dispatch("click");
  app.tick();
  assert.equal(app.run("stepState.steps"), 2);
  app.get("explorer").dispatch("keydown", { key: "Enter", target: { matches: () => true } });
  assert.equal(app.run("stepState.steps"), 2);
  app.get("step-mode").checked = true;
  app.get("step-mode").dispatch("change");
  app.get("explorer").dispatch("keydown", { key: "Enter" });
  assert.equal(app.run("stepState.steps"), 2);
  assert.equal(app.get("detail-step-next").hidden, true);
  app.get("step-end").dispatch("click");
  assert.equal(app.run("overview.prunedBy"), null);
  assert.ok(app.run("overview.nodeCount") < fullCount);
  app.get("explorer").dispatch("keydown", { key: "Enter" });
  assert.equal(app.run("stepState"), null);
});

test("Temposlider behält die fünf nichtlinearen Stufen und passt laufende Timer an", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(Array(9).fill(null), 'X', true); byId('explorer').open = true; startSearch()");
  app.get("step-play").dispatch("click");
  for (const [index, delay, count] of [[0, 1000, 1], [1, 250, 1], [2, 50, 1], [3, 10, 1], [4, 30, 1000]]) {
    app.get("step-speed").value = String(index);
    app.get("step-speed").dispatch("input");
    assert.equal(app.timers.size, 1);
    const timer = [...app.timers.values()][0];
    assert.equal(timer.delay, delay);
    const before = app.run("stepState.steps");
    app.timers.clear();
    timer.callback();
    if (count === 1) {
      assert.equal(app.run("stepState.steps"), before);
      assert.equal(app.tick(), Math.min(250, delay));
    }
    assert.equal(app.run("stepState.steps") - before, count);
  }
});

test("Die dynamische Zoomgrenze erlaubt unabhängig von Baumgrösse und Breite höchstens 30 px pro Endstand", () => {
  const app = createApp();
  for (const board of [Array(9).fill(null), ["X", "O", "X", null, null, null, null, null, null]]) {
    app.run(`overview = OverviewTree.build(${JSON.stringify(board)}, 'O')`);
    for (const width of [300, 1000, 1800]) {
      app.get("overview-canvas").clientWidth = width;
      app.run("changeOverviewZoom(100, 0.5)");
      const pixels = app.run(`OverviewTree.geometry(overview, ${width}, 2 ** zoomLevel, 0.5).leafWidth`);
      assert.ok(pixels <= 30, `${pixels} px überschreiten die Grenze`);
      assert.ok(pixels > 29.7, `${pixels} px erreichen die Zielgrösse nicht`);
      assert.equal(Number(app.get("overview-zoom").max), app.run("zoomLevel"));
    }
  }
});

test("Tastaturnavigation verändert nur Auswahl und nötigenfalls Pan, nicht den Pfad oder Zoom", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(Array(9).fill(null), 'X', true); selectedNode = 0; selectedPath = OverviewTree.optimalPath(overview); byId('explorer').open = true; zoomLevel = 12");
  const path = Array.from(app.run("selectedPath"));
  app.get("explorer").dispatch("keydown", { key: "9" });
  assert.equal(app.run("selectedNode"), OverviewTree.children(app.run("overview"), 0)[8]);
  assert.equal(app.run("zoomLevel"), 12);
  const layout = app.run("OverviewTree.geometry(overview, 1000, 2 ** zoomLevel, Number(byId('overview-position').value) / positionSteps)");
  assert.ok(layout.x(app.run("selectedNode")) >= layout.left);
  assert.ok(layout.x(app.run("selectedNode")) <= 1000 - layout.right);
  app.get("explorer").dispatch("keydown", { key: "ArrowLeft" });
  assert.equal(app.run("selectedNode"), OverviewTree.children(app.run("overview"), 0)[7]);
  app.get("explorer").dispatch("keydown", { key: "ArrowUp" });
  assert.equal(app.run("selectedNode"), 0);
  assert.deepEqual(Array.from(app.run("selectedPath")), path);
  const input = { matches: () => true };
  app.get("explorer").dispatch("keydown", { key: "ArrowDown", target: input });
  assert.equal(app.run("selectedNode"), 0);
});

test("P lädt ein PDF nur für vollständige Bäume unter 30 Knoten und respektiert Eingabefelder", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O',null,null,'X',null,'X','O',null], 'O', true); selectedNode = 0; byId('explorer').open = true");
  app.get("explorer").dispatch("keydown", { key: "p", target: { matches: () => true } });
  assert.equal(app.downloads.length, 0);
  app.get("explorer").dispatch("keydown", { key: "P" });
  assert.deepEqual(app.downloads, ["minimax-aufgabenblatt.pdf"]);
  assert.equal(app.get("worksheet-status").hidden, true);
  app.run("overview = OverviewTree.build(['X','X','O','X','O',null,null,null,null], 'O', true)");
  app.get("explorer").dispatch("keydown", { key: "p" });
  assert.equal(app.downloads.length, 1);
  assert.equal(app.get("worksheet-status").hidden, false);
  assert.match(app.get("worksheet-status").textContent, /höchstens 29.*30/);
});

test("Manueller Modus ist während der Suche markiert und wird bei Auto und Ende zurückgesetzt", () => {
  const app = createApp();
  app.run("overview = OverviewTree.build(['X','O','X','X','O','O',null,null,null], 'X'); byId('explorer').open = true; startSearch()");
  assert.equal(app.get("explorer").classList.contains("manual-mode"), false);
  app.get("step-mode").checked = true;
  app.get("step-mode").dispatch("change");
  assert.equal(app.get("explorer").classList.contains("manual-mode"), true);
  assert.equal(app.getLayoutManual(), true);
  app.get("step-mode").checked = false;
  app.get("step-mode").dispatch("change");
  assert.equal(app.get("explorer").classList.contains("manual-mode"), false);
  assert.equal(app.getLayoutManual(), false);
  app.get("step-mode").checked = true;
  app.get("step-mode").dispatch("change");
  app.get("step-end").dispatch("click");
  assert.equal(app.get("explorer").classList.contains("manual-mode"), false);
  assert.equal(app.getLayoutManual(), false);
});

test("Pixeldichte erscheint nur mit Zoomcontrols", () => {
  const app = createApp();
  app.get("overview-panel").hidden = false;
  app.run("overview = OverviewTree.build(['X','O','X','X','O','O',null,null,null], 'X'); drawOverview()");
  assert.equal(app.get("overview-controls").hidden, true);
  assert.doesNotMatch(app.get("overview-status").textContent, /px pro Endstand/);
  app.get("overview-canvas").clientWidth = 200;
  app.run("overview = OverviewTree.build(['X','O','X',null,'O',null,null,null,null], 'X'); drawOverview()");
  assert.equal(app.get("overview-controls").hidden, false);
  assert.match(app.get("overview-status").textContent, /px pro Endstand/);
});
