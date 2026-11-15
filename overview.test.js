"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { build, children, firstPostorder, nextPostorder, optimalPath, positionAt, geometry, hitTest, draw, zoomPosition, visibleNodes } = require("./overview.js");
const { result, evaluate } = require("./game.js");

test("vollständiger Startbaum enthält alle Zugfolgen bis zum Spielende", () => {
  const board = Array(9).fill(null);
  const tree = build(board, "X");
  assert.equal(tree.nodeCount, 549946);
  assert.equal(tree.leafCount, 255168);
  assert.equal(tree.maxDepth, 9);
  assert.equal(tree.values[0], 0);
  assert.equal(tree.starts[0], 0);
  assert.equal(tree.ends[0], tree.leafCount);
  assert.deepEqual(board, Array(9).fill(null));

  let leaves = 0;
  for (let i = 1; i < tree.nodeCount; i++) {
    const parent = tree.parents[i];
    assert.ok(parent >= 0 && parent < i);
    assert.equal(tree.depths[i], tree.depths[parent] + 1);
    assert.ok(tree.starts[i] >= tree.starts[parent] && tree.ends[i] <= tree.ends[parent]);
    if (i === tree.nodeCount - 1 || tree.parents[i + 1] !== i) leaves++;
  }
  assert.equal(leaves, tree.leafCount);
});

test("kleine und abgeschlossene Bäume zeigen Werte und Ebenen korrekt", () => {
  const board = ["X", "X", null, "O", "O", null, null, null, null];
  const tree = build(board, "X");
  assert.equal(tree.values[0], 1);
  assert.equal(tree.parents[0], -1);
  assert.equal(tree.starts[1], 0);
  assert.equal(tree.ends[1], 1);
  assert.equal(tree.values[1], 1);
  assert.equal(tree.depths[1], 1);
  const ended = build(["O", "O", "O", "X", "X", null, null, null, null], "X");
  assert.equal(ended.nodeCount, 1);
  assert.equal(ended.leafCount, 1);
  assert.equal(ended.maxDepth, 0);
  assert.equal(ended.values[0], -1);
});

test("Schrittfolge bewertet alle besuchten Knoten in Tiefensuche von links nach rechts", () => {
  const board = ["X", "O", "X", null, "O", null, null, null, null];
  for (const pruning of [false, true]) {
    const tree = build(board, "X", pruning);
    const expected = [];
    function visit(node) {
      for (const child of children(tree, node)) visit(child);
      expected.push(node);
    }
    visit(0);
    const actual = [];
    for (let node = firstPostorder(tree); node !== -1; node = nextPostorder(tree, node)) actual.push(node);
    assert.deepEqual(actual, expected);
    assert.equal(actual.length, tree.nodeCount);
    assert.equal(actual.at(-1), 0);
    assert.ok(result(positionAt(tree, actual[0]).board));
  }
});

test("Alpha und Beta entsprechen den rekursiv übernommenen und aktualisierten Suchgrenzen", () => {
  for (const [board, turn] of [[Array(9).fill(null), "X"], [[null, null, null, null, "X", null, null, null, null], "O"]]) {
    const tree = build(board, turn, true);
    function visit(node, alpha, beta) {
      assert.equal(tree.entryAlphas[node], alpha);
      assert.equal(tree.entryBetas[node], beta);
      const { board, turn } = positionAt(tree, node);
      const outcome = result(board);
      let value;
      if (outcome) {
        value = outcome.winner === "X" ? 1 : outcome.winner === "O" ? -1 : 0;
      } else {
        value = turn === "X" ? -Infinity : Infinity;
        for (const child of children(tree, node)) {
          assert.ok(alpha < beta);
          const next = visit(child, alpha, beta);
          value = turn === "X" ? Math.max(value, next) : Math.min(value, next);
          if (turn === "X") alpha = Math.max(alpha, value);
          else beta = Math.min(beta, value);
        }
      }
      assert.equal(tree.values[node], value);
      assert.equal(tree.alphas[node], alpha);
      assert.equal(tree.betas[node], beta);
      return value;
    }
    visit(0, -Infinity, Infinity);
  }
});

test("noch nicht bewertete Knoten und Kanten bleiben weiss", () => {
  const tree = build(["X", "X", null, "O", "O", null, null, null, null], "X", true);
  const fills = [];
  const strokes = [];
  const context = {
    scale() {}, save() {}, restore() {}, rect() {}, clip() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() { strokes.push(this.strokeStyle); },
    fillRect() { fills.push(this.fillStyle); }
  };
  const canvas = { clientWidth: 200, style: {}, getContext: () => context };
  const previousWindow = global.window;
  global.window = { devicePixelRatio: 1 };
  try {
    const revealed = new Uint8Array(tree.nodeCount);
    draw(canvas, tree, 1, 0.5, null, null, [], revealed);
    assert.deepEqual(fills.slice(-tree.nodeCount), ["#ffffff", "#ffffff"]);
    assert.equal(strokes.at(-1), "#ffffff");
    fills.length = 0;
    revealed[1] = 1;
    draw(canvas, tree, 1, 0.5, null, null, [], revealed);
    assert.deepEqual(fills.slice(-tree.nodeCount), ["#255e8c", "#ffffff"]);
    fills.length = 0;
    revealed[1] = 0;
    canvas.clientWidth = 130;
    draw(canvas, tree, 1, 0.5, null, null, [], revealed);
    assert.ok(fills.includes("rgb(255,255,255)"));
  } finally {
    global.window = previousWindow;
  }
});

test("noch nicht generierte Zweige sind gepunktet und werden erst nach Generierung weiss", () => {
  const tree = {
    starts: [0, 0, 1], ends: [2, 1, 2], parents: [-1, 0, 0],
    subtreeEnds: [3, 2, 3], depths: [0, 1, 1], values: [0, 1, -1],
    nodeCount: 3, leafCount: 2, maxDepth: 1, turn: "X"
  };
  const fills = [];
  const strokes = [];
  let dash = [];
  const context = {
    scale() {}, save() {}, restore() {}, rect() {}, clip() {},
    beginPath() {}, moveTo() {}, lineTo() {},
    setLineDash(value) { dash = value.slice(); },
    stroke() { strokes.push({ color: this.strokeStyle, dash: dash.slice(), alpha: this.globalAlpha }); },
    strokeRect() {},
    fillRect() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); }
  };
  const canvas = { clientWidth: 200, style: {}, getContext: () => context };
  const revealed = new Uint8Array(3);
  const previousWindow = global.window;
  global.window = { devicePixelRatio: 1 };
  try {
    draw(canvas, tree, 1, 0.5, null, null, [], revealed, 1);
    assert.deepEqual(fills.slice(-3), [
      { color: "#ffffff", alpha: 1 }, { color: "#ffffff", alpha: 1 },
      { color: "#a9bbb0", alpha: 0.28 }
    ]);
    assert.ok(strokes.some(stroke => stroke.color === "#81968a" && stroke.alpha < 1 && stroke.dash.length > 0));
    fills.length = 0;
    revealed[1] = 1;
    draw(canvas, tree, 1, 0.5, null, null, [], revealed, 2);
    assert.deepEqual(fills.slice(-3).map(fill => fill.color), ["#255e8c", "#ffffff", "#ffffff"]);
    fills.length = 0;
    revealed[1] = 0;
    canvas.clientWidth = 130;
    draw(canvas, tree, 1, 0.5, null, null, [], revealed, 1);
    assert.ok(fills.some(fill => fill.color === "rgb(238,241,239)"));
  } finally {
    global.window = previousWindow;
  }
});

test("Knoten und Verbindungen verwenden die Farbe des jeweiligen Werts", () => {
  const tree = {
    starts: [0, 0, 1], ends: [2, 1, 2], parents: [-1, 0, 0],
    subtreeEnds: [3, 2, 3],
    depths: [0, 1, 1], values: [0, 1, -1],
    nodeCount: 3, leafCount: 2, maxDepth: 1, turn: "X"
  };
  const fills = [];
  const strokes = [];
  let path;
  const context = {
    scale() {}, save() {}, restore() {}, rect() {}, clip() {}, fillText() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push(["move", x, y]); },
    lineTo(x, y) { path.push(["line", x, y]); },
    stroke() { strokes.push({ color: this.strokeStyle, path }); },
    fillRect(x, y, width, height) { fills.push({ color: this.fillStyle, x, y, width, height }); }
  };
  const canvas = { clientWidth: 200, style: {}, getContext: () => context };
  const previousWindow = global.window;
  global.window = { devicePixelRatio: 1 };
  try {
    draw(canvas, tree, 1, 0.5);
  } finally {
    global.window = previousWindow;
  }
  assert.deepEqual(strokes.map(stroke => [stroke.color, stroke.path.length]), [
    ["#a95212", 2], ["#87958f", 0], ["#255e8c", 2]
  ]);
  assert.ok(strokes[0].path[1][1] > strokes[2].path[1][1]);
  assert.deepEqual(fills.slice(-3).map(fill => fill.color), ["#a95212", "#87958f", "#255e8c"]);
});

test("Mausposition bleibt beim Zoomen auf demselben Punkt", () => {
  for (const [zoom, position, nextZoom, anchor] of [[1, 0.5, 2, 0.25], [8, 0.5, 32, 0.7], [8, 0.6, 4, 0.5]]) {
    const nextPosition = zoomPosition(zoom, position, nextZoom, anchor);
    const before = position * (1 - 1 / zoom) + anchor / zoom;
    const after = nextPosition * (1 - 1 / nextZoom) + anchor / nextZoom;
    assert.ok(Math.abs(before - after) < 1e-12);
  }
  assert.equal(zoomPosition(4, 0, 2, 0), 0);
  assert.equal(zoomPosition(4, 1, 2, 1), 1);
  assert.equal(zoomPosition(2, 0.1, 1, 0.5), 0.5);
});

test("Sichtbarkeitsfilter erhält alle sichtbaren Knoten und Kanten", () => {
  const tree = build(["X", "O", null, null, "X", null, null, null, null], "O");
  const center = i => (tree.starts[i] + tree.ends[i]) / (2 * tree.leafCount);
  for (const [zoom, position] of [[1, 0.5], [4, 0], [4, 0.4], [16, 1]]) {
    const start = position * (1 - 1 / zoom);
    const end = start + 1 / zoom;
    const expected = [];
    for (let i = 0; i < tree.nodeCount; i++) {
      const nodeX = center(i);
      const parentX = tree.parents[i] < 0 ? nodeX : center(tree.parents[i]);
      if ((nodeX >= start && nodeX <= end) ||
          (tree.parents[i] >= 0 && Math.max(nodeX, parentX) >= start && Math.min(nodeX, parentX) <= end)) expected.push(i);
    }
    const selected = new Set(visibleNodes(tree, zoom, position));
    for (const index of expected) assert.ok(selected.has(index), `Knoten ${index} fehlt bei ${zoom}×`);
  }
  const all = build(Array(9).fill(null), "X");
  assert.ok(visibleNodes(all, 4096, 0.5).length < all.nodeCount / 100);
});

test("Alpha-Beta zeigt genau die besuchten Zugfolgen und zählt sie korrekt", () => {
  function reference(board, turn) {
    const paths = [];
    const scores = [];
    let leaves = 0;
    let cut = 0;
    function search(position, player, alpha, beta, path) {
      const index = paths.length;
      paths.push(path);
      const end = result(position);
      if (end) {
        leaves++;
        return scores[index] = end.winner === "X" ? 1 : end.winner === "O" ? -1 : 0;
      }
      const available = position.map((value, index) => value ? null : index).filter(index => index !== null);
      let best = player === "X" ? -Infinity : Infinity;
      for (let i = 0; i < available.length; i++) {
        const next = position.slice();
        next[available[i]] = player;
        const score = search(next, player === "X" ? "O" : "X", alpha, beta, `${path}${available[i]}`);
        if (player === "X") {
          best = Math.max(best, score);
          alpha = Math.max(alpha, best);
        } else {
          best = Math.min(best, score);
          beta = Math.min(beta, best);
        }
        if (alpha >= beta || best === (player === "X" ? 1 : -1)) {
          cut += available.length - i - 1;
          break;
        }
      }
      return scores[index] = best;
    }
    return { score: search(board, turn, -Infinity, Infinity, ""), paths, scores, get leaves() { return leaves; }, get cut() { return cut; } };
  }
  for (const [board, turn] of [
    [Array(9).fill(null), "X"],
    [["X", null, null, null, "O", null, null, null, null], "X"],
    [["X", null, null, null, null, null, null, null, null], "O"],
    [["X", "X", "X", "O", "O", null, null, null, null], "O"]
  ]) {
    const expected = reference(board, turn);
    const tree = build(board, turn, true);
    assert.equal(tree.nodeCount, expected.paths.length);
    assert.equal(tree.leafCount, expected.leaves);
    assert.equal(tree.prunedBranches, expected.cut);
    assert.equal(tree.values[0], expected.score);
    const paths = [""];
    for (let index = 1; index < tree.nodeCount; index++) {
      paths[index] = paths[tree.parents[index]] + tree.moves[index];
      assert.equal(paths[index], expected.paths[index]);
      assert.equal(tree.values[index], expected.scores[index]);
      const current = positionAt(tree, index);
      const exact = evaluate(current.board, current.turn);
      if (tree.bounds[index] < 0) assert.ok(exact <= tree.values[index]);
      else if (tree.bounds[index] > 0) assert.ok(exact >= tree.values[index]);
      else assert.equal(tree.values[index], exact);
    }
  }
  const tree = build(Array(9).fill(null), "X", true);
  assert.equal(tree.nodeCount, 16811);
  assert.equal(tree.leafCount, 6740);
  assert.ok(tree.bounds.some(bound => bound !== 0));
});

test("Knotenauswahl ist ab genau 10 Pixel Platz pro Endstand möglich", () => {
  const tree = build(["X", "O", "X", "X", "O", null, null, null, null], "O");
  const width = 139;
  const zoom = 10 * tree.leafCount / (width - 129);
  const layout = geometry(tree, width, zoom, 0.5);
  const index = visibleNodes(tree, zoom, 0.5).find(node => node > 0 && layout.x(node) > layout.left + 1 && layout.x(node) < width - layout.right - 1);
  assert.notEqual(index, undefined);
  assert.equal(hitTest(tree, width, zoom, 0.5, layout.x(index), layout.y(index)), index);
  assert.equal(hitTest(tree, width, zoom * 0.99, 0.5, layout.x(index), layout.y(index)), null);
  assert.equal(hitTest(tree, width, zoom, 0.5, layout.left - 1, layout.y(index)), null);
});

test("der linkste gleichwertige Pfad wird auch bei kürzerer Alternative gewählt", () => {
  const board = ["X", "O", null, null, null, null, null, null, null];
  const full = build(board, "X");
  const fullPath = optimalPath(full);
  const shorter = children(full, 0).find(child => full.moves[child] === 6);
  let shorterLength = 1;
  for (let node = shorter; node !== -1; node = full.bestChildren[node]) shorterLength++;
  assert.equal(full.values[shorter], full.values[0]);
  assert.ok(shorterLength < fullPath.length);
  for (const pruning of [false, true]) {
    const tree = build(board, "X", pruning);
    const path = optimalPath(tree);
    assert.equal(tree.moves[path[1]], 3);
    assert.deepEqual(path.map(node => tree.moves[node]), fullPath.map(node => full.moves[node]));
    for (let i = 1; i < path.length; i++) {
      assert.equal(tree.parents[path[i]], path[i - 1]);
      const options = children(tree, path[i - 1]);
      const maximizing = tree.depths[path[i - 1]] % 2 === 0;
      const best = maximizing ? Math.max(...options.map(child => tree.values[child])) : Math.min(...options.map(child => tree.values[child]));
      assert.equal(path[i], options.find(child => tree.values[child] === best));
    }
    assert.ok(result(positionAt(tree, path.at(-1)).board));
  }
  const ended = build(["X", "X", "X", "O", "O", null, null, null, null], "O", true);
  assert.deepEqual(optimalPath(ended), [0]);
});

test("Pruning bricht bei bestmöglichem Wert für X und O auch an der Wurzel ab", () => {
  for (const [board, turn, value] of [
    [["X", "X", null, "O", "O", null, null, null, null], "X", 1],
    [["O", "O", null, "X", "X", null, "X", null, null], "O", -1]
  ]) {
    const tree = build(board, turn, true);
    assert.equal(tree.values[0], value);
    assert.deepEqual(children(tree, 0).map(child => tree.moves[child]), [2]);
    assert.equal(tree.prunedBranches, board.filter(cell => !cell).length - 1);
    assert.deepEqual(optimalPath(tree).map(node => tree.values[node]), [value, value]);
  }
});

test("ein frühes Gewinnblatt ist nicht unbedingt Teil des optimalen Pfads", () => {
  const board = ["X", "O", "X", null, "O", null, null, null, null];
  for (const pruning of [false, true]) {
    const tree = build(board, "X", pruning);
    let first = 0;
    while (children(tree, first).length) first = children(tree, first)[0];
    assert.equal(tree.values[first], 1);
    assert.equal(tree.values[0], 0);
    const path = optimalPath(tree);
    assert.equal(tree.moves[path[1]], 7);
    assert.ok(path.every(node => tree.values[node] === 0 && tree.bounds[node] === 0));
  }
});

test("gewählter Pfad wird bei kleiner und grosser Zoomstufe gestrichelt gezeichnet", () => {
  const tree = {
    starts: [0, 0, 0], ends: [1, 1, 1], parents: [-1, 0, 1], subtreeEnds: [3, 3, 3],
    depths: [0, 1, 2], values: [0, 1, -1], nodeCount: 3, leafCount: 1, maxDepth: 2, turn: "X"
  };
  const strokes = [];
  let dash = [];
  const context = {
    scale() {}, save() {}, restore() {}, rect() {}, clip() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, setLineDash(value) { dash = value.slice(); },
    stroke() { strokes.push({ dash: dash.slice(), color: this.strokeStyle, width: this.lineWidth }); }
  };
  const canvas = { clientWidth: 130, style: {}, getContext: () => context };
  const previousWindow = global.window;
  global.window = { devicePixelRatio: 1 };
  try {
    for (const zoom of [1, 32]) {
      strokes.length = 0;
      draw(canvas, tree, zoom, 0.5, null, null, [0, 1, 2]);
      const path = strokes.filter(stroke => stroke.dash.length && stroke.color !== "#ffffff");
      assert.deepEqual(path.map(stroke => stroke.color), ["#255e8c", "#a95212"]);
      assert.ok(path.every(stroke => stroke.width >= 4));
    }
  } finally {
    global.window = previousWindow;
  }
});

test("abgeschlossener Einzelknoten bleibt auch ohne Auswahl markiert", () => {
  const tree = build(["X", "X", "X", "O", "O", null, null, null, null], "O");
  let outlines = 0;
  const context = {
    scale() {}, save() {}, restore() {}, rect() {}, clip() {}, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, strokeRect() { outlines++; }
  };
  const canvas = { clientWidth: 200, style: {}, getContext: () => context };
  const previousWindow = global.window;
  global.window = { devicePixelRatio: 1 };
  try {
    draw(canvas, tree, 1, 0.5, null, null, optimalPath(tree));
  } finally {
    global.window = previousWindow;
  }
  assert.equal(outlines, 1);
});
