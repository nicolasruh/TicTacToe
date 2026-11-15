"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const TicTacToe = require("./game.js");
const OverviewTree = require("./overview.js");

function createApp() {
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
      this.classList = { toggle() {} };
    }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    dispatch(type) { for (const handler of this.listeners[type] || []) handler({ target: this, currentTarget: this }); }
    append(child) { this.children.push(child); }
    setAttribute() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch("close"); }
    scrollTo() {}
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
  let nextTimer = 0;
  const timers = new Map();
  const context = vm.createContext({
    document: { getElementById: get, createElement: () => new Element() },
    window: { addEventListener() {} },
    TicTacToe,
    OverviewTree,
    MinimaxExplorer: {
      renderSelection: (_container, _tree, _node, navigate, path, onMove, step) => { selection = { navigate, path, onMove, step }; },
      layoutSelection() {}
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
  return { get, run, showRoot, timers, getSelection: () => selection };
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
  assert.equal(app.run("stepState.current"), 0);
  assert.equal(app.run("stepState.revealed[1]"), 1);
  assert.deepEqual(Array.from(app.run("selectedPath")), []);
  app.getSelection().step.check(0);
  assert.equal(app.run("stepState"), null);
  assert.deepEqual(Array.from(app.run("selectedPath")), [0, 1]);
  assert.equal(app.get("step-next").disabled, true);
});

test("Generierung folgt der Tiefensuche auch beim Backtracking und bei Pruning", () => {
  for (const pruning of [false, true]) {
    const app = createApp();
    app.run(`overview = OverviewTree.build(['X','O','X',null,'O',null,null,null,null], 'X', ${pruning}); byId('explorer').open = true; startSearch()`);
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
  }
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
  assert.equal(app.run("stepState.completed"), 1);
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
  app.get("overview-scroll").scrollTop = 300;
  app.run("advanceStep(overview.nodeCount)");
  assert.equal(app.run("selectedNode"), 0);
  assert.equal(Number(app.get("overview-position").value), 500000000);
  assert.equal(app.get("overview-scroll").scrollTop, 0);
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
  assert.equal(app.run("stepState.completed"), 1);
  assert.equal(app.run("stepState.current"), 0);
  app.get("step-mode").checked = false;
  app.get("step-mode").dispatch("change");
  app.get("step-next").dispatch("click");
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

test("Pruning wartet auf Wert, Alpha und Beta und behält bestätigte Eingaben", () => {
  const app = createApp();
  app.get("step-mode").checked = true;
  app.run("overview = OverviewTree.build(['X','X',null,'O','O',null,null,null,null], 'X', true); byId('explorer').open = true; startSearch()");
  assert.equal(app.run("stepState.current"), 1);
  assert.match(app.getSelection().step.check(0, "alpha"), /stimmt noch nicht/);
  assert.equal(app.getSelection().step.check(-Infinity, "alpha"), "");
  assert.equal(app.run("stepState.completed"), 0);
  assert.equal(app.getSelection().step.answers.alpha, true);
  assert.equal(app.getSelection().step.check(1), "");
  assert.equal(app.run("stepState.completed"), 0);
  assert.match(app.getSelection().step.check(0, "beta"), /stimmt noch nicht/);
  app.run("showNodeDetail(0); showNodeDetail(stepState.current)");
  assert.equal(app.getSelection().step.answers.value, true);
  assert.equal(app.getSelection().step.answers.alpha, true);
  assert.equal(app.getSelection().step.check(Infinity, "beta"), "");
  assert.equal(app.run("stepState.current"), 0);
  assert.equal(app.run("stepState.completed"), 1);
  assert.deepEqual(Object.keys(app.getSelection().step.answers), []);
  app.getSelection().step.check(Infinity, "beta");
  app.getSelection().step.check(1, "alpha");
  assert.equal(app.run("stepState.completed"), 1);
  app.getSelection().step.check(1);
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
    const before = app.run("stepState.completed");
    app.timers.clear();
    timer.callback();
    assert.equal(app.run("stepState.completed") - before, count);
  }
});
