"use strict";

const OverviewTree = (() => {
  const game = typeof module !== "undefined" && module.exports ? require("./game.js") : TicTacToe;
  const other = player => player === "X" ? "O" : "X";
  const colors = ["#a95212", "#87958f", "#255e8c"];
  const scoreColor = score => score === null ? "#ffffff" : colors[score + 1];

  function build(board, turn, pruning = false, includePruned = false, trackLimits = false) {
    const position = board.slice();
    const counts = new Map();
    function count(player) {
      const key = `${position.map(value => value || "-").join("")}:${player}`;
      if (counts.has(key)) return counts.get(key);
      let nodes = 1;
      let leaves = 0;
      if (game.result(position)) {
        leaves = 1;
      } else {
        for (let move = 0; move < 9; move++) {
          if (position[move]) continue;
          position[move] = player;
          const child = count(other(player));
          nodes += child.nodes;
          leaves += child.leaves;
          position[move] = null;
        }
      }
      const total = { nodes, leaves };
      counts.set(key, total);
      return total;
    }

    const totals = count(turn);
    const starts = new Uint32Array(totals.nodes);
    const ends = new Uint32Array(totals.nodes);
    const parents = new Int32Array(totals.nodes);
    const subtreeEnds = new Uint32Array(totals.nodes);
    const depths = new Uint8Array(totals.nodes);
    const values = new Int8Array(totals.nodes);
    const bounds = new Int8Array(totals.nodes);
    const bestChildren = new Int32Array(totals.nodes);
    const moves = new Uint8Array(totals.nodes);
    const entryAlphas = pruning || trackLimits ? new Float32Array(totals.nodes) : null;
    const entryBetas = pruning || trackLimits ? new Float32Array(totals.nodes) : null;
    const alphas = pruning || trackLimits ? new Float32Array(totals.nodes) : null;
    const betas = pruning || trackLimits ? new Float32Array(totals.nodes) : null;
    const prunedMoves = pruning ? new Uint16Array(totals.nodes) : null;
    const prunedBy = pruning && includePruned ? new Int32Array(totals.nodes).fill(-1) : null;
    let visitedNodeCount = 0;
    let nodeCount = 0;
    let leafCount = 0;
    let maxDepth = 0;
    let prunedBranches = 0;

    function visit(player, parent, depth, move, alpha, beta, excludedBy = -1) {
      const index = nodeCount++;
      if (excludedBy === -1) visitedNodeCount++;
      if (prunedBy) prunedBy[index] = excludedBy;
      starts[index] = leafCount;
      parents[index] = parent;
      depths[index] = depth;
      moves[index] = move;
      bestChildren[index] = -1;
      maxDepth = Math.max(maxDepth, depth);
      const originalAlpha = alpha;
      const originalBeta = beta;
      if (entryAlphas) {
        entryAlphas[index] = alpha;
        entryBetas[index] = beta;
      }
      let value;
      const outcome = game.result(position);
      if (outcome) {
        leafCount++;
        value = outcome.winner === "X" ? 1 : outcome.winner === "O" ? -1 : 0;
      } else {
        value = player === "X" ? -Infinity : Infinity;
        let cutoff = false;
        for (let nextMove = 0; nextMove < 9; nextMove++) {
          if (position[nextMove]) continue;
          position[nextMove] = player;
          const childIndex = nodeCount;
          const childValue = visit(other(player), index, depth + 1, nextMove, alpha, beta,
            excludedBy !== -1 ? excludedBy : cutoff ? index : -1);
          position[nextMove] = null;
          // Hypothetical continuations preserve the layout, not the search result.
          if (cutoff) continue;
          if (player === "X" ? childValue > value : childValue < value) {
            value = childValue;
            bestChildren[index] = childIndex;
          }
          if (player === "X") {
            alpha = Math.max(alpha, value);
          } else {
            beta = Math.min(beta, value);
          }
          if (pruning && excludedBy === -1 && (beta <= alpha || value === (player === "X" ? 1 : -1))) {
            for (let remaining = nextMove + 1; remaining < 9; remaining++) {
              if (!position[remaining]) {
                prunedBranches++;
                prunedMoves[index] |= 1 << remaining;
              }
            }
            if (!includePruned) break;
            cutoff = true;
          }
        }
        if (pruning && excludedBy === -1 && value <= originalAlpha && value !== -1) bounds[index] = -1;
        else if (pruning && excludedBy === -1 && value >= originalBeta && value !== 1) bounds[index] = 1;
      }
      values[index] = value;
      if (entryAlphas) {
        alphas[index] = alpha;
        betas[index] = beta;
      }
      ends[index] = leafCount;
      subtreeEnds[index] = nodeCount;
      return value;
    }
    visit(turn, -1, 0, 255, -Infinity, Infinity);
    return { starts, ends, parents, subtreeEnds, depths, values, bounds, bestChildren, moves, entryAlphas, entryBetas, alphas, betas, prunedMoves, prunedBy, visitedNodeCount, nodeCount, leafCount, maxDepth, turn, pruning, prunedBranches, board: board.slice() };
  }

  function children(tree, index) {
    const result = [];
    for (let child = index + 1; child < tree.subtreeEnds[index]; child = tree.subtreeEnds[child]) result.push(child);
    return result;
  }

  function firstPostorder(tree, index = 0) {
    while (index + 1 < tree.subtreeEnds[index]) index++;
    return index;
  }

  function nextPostorder(tree, index) {
    const parent = tree.parents[index];
    if (parent === -1) return -1;
    const next = tree.subtreeEnds[index];
    return next < tree.subtreeEnds[parent] ? firstPostorder(tree, next) : parent;
  }

  function navigate(tree, index, key) {
    if (key === "ArrowUp") return tree.parents[index] === -1 ? null : tree.parents[index];
    if (key === "ArrowDown" || /^[1-9]$/.test(key)) {
      return children(tree, index)[key === "ArrowDown" ? 0 : Number(key) - 1] ?? null;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const parent = tree.parents[index];
      if (parent === -1) return null;
      const siblings = children(tree, parent);
      return siblings[siblings.indexOf(index) + (key === "ArrowRight" ? 1 : -1)] ?? null;
    }
    return null;
  }

  function createSearch(tree) {
    const current = firstPostorder(tree);
    return {
      current, phase: "value", child: -1, completed: 0, steps: 0, running: false,
      generatedThrough: current,
      revealed: new Uint8Array(tree.nodeCount),
      values: new Float32Array(tree.nodeCount).fill(NaN),
      alphas: tree.pruning ? tree.entryAlphas.slice(0, tree.nodeCount) : null,
      betas: tree.pruning ? tree.entryBetas.slice(0, tree.nodeCount) : null,
      cutoffs: new Uint8Array(tree.nodeCount)
    };
  }

  function expectedStep(tree, search) {
    const node = search.current;
    if (node === -1) throw new Error("Die Suche ist bereits abgeschlossen.");
    if (search.phase === "prune") {
      const player = tree.depths[node] % 2 === 0 ? tree.turn : other(tree.turn);
      return search.alphas[node] >= search.betas[node] || search.values[node] === (player === "X" ? 1 : -1);
    }
    if (!tree.pruning || search.child === -1) return tree.values[node];
    const previous = search.values[node];
    const returned = search.values[search.child];
    if (Number.isNaN(previous)) return returned;
    const player = tree.depths[node] % 2 === 0 ? tree.turn : other(tree.turn);
    return player === "X" ? Math.max(previous, returned) : Math.min(previous, returned);
  }

  function advanceSearch(tree, search) {
    const node = search.current;
    const expected = expectedStep(tree, search);
    search.steps++;
    function finish() {
      search.revealed[node] = 1;
      search.completed++;
      const parent = tree.parents[node];
      search.current = parent;
      search.child = node;
      search.phase = "value";
    }
    function generate(node) {
      search.current = firstPostorder(tree, node);
      search.child = -1;
      search.phase = "value";
      search.generatedThrough = Math.max(search.generatedThrough, search.current);
    }
    if (!tree.pruning) {
      search.values[node] = expected;
      search.revealed[node] = 1;
      search.completed++;
      search.current = nextPostorder(tree, node);
      search.generatedThrough = Math.max(search.generatedThrough, search.current);
      return;
    }
    if (search.phase === "prune") {
      if (expected) {
        search.cutoffs[node] = 1;
        finish();
      } else {
        generate(tree.subtreeEnds[search.child]);
      }
      return;
    }
    search.values[node] = expected;
    if (search.child === -1) {
      finish();
      return;
    }
    const player = tree.depths[node] % 2 === 0 ? tree.turn : other(tree.turn);
    if (player === "X") search.alphas[node] = Math.max(search.alphas[node], expected);
    else search.betas[node] = Math.min(search.betas[node], expected);
    const next = tree.subtreeEnds[search.child];
    if (next < tree.subtreeEnds[node] || tree.prunedMoves[node]) search.phase = "prune";
    else finish();
  }

  function nodeValue(tree, index, search = null) {
    if (tree.prunedBy && tree.prunedBy[index] !== -1) return null;
    if (!search) return tree.values[index];
    if (search.settling && index === search.current && search.phase === "value") return search.preview;
    if (index > search.generatedThrough || Number.isNaN(search.values[index]) ||
        index === search.current && search.phase === "value") return null;
    return search.values[index];
  }

  function isPruned(tree, index, search) {
    return Boolean(search && tree.prunedBy && tree.prunedBy[index] !== -1 && search.cutoffs[tree.prunedBy[index]]);
  }

  function isGenerated(tree, index, search) {
    return !search || index <= search.generatedThrough && (!tree.prunedBy || tree.prunedBy[index] === -1);
  }

  function cutMoves(tree, index, search = null) {
    if (!tree.prunedMoves || search && !search.cutoffs[index]) return [];
    const mask = tree.prunedMoves[index];
    if (!mask) return [];
    return Array.from({ length: 9 }, (_, move) => move).filter(move => mask & (1 << move));
  }

  function limits(tree, index, search = null) {
    const generated = isGenerated(tree, index, search);
    const alpha = !generated ? null : search ? search.alphas[index] : tree.alphas[index];
    const beta = !generated ? null : search ? search.betas[index] : tree.betas[index];
    const cutting = !search ? Boolean(tree.prunedMoves[index]) :
      Boolean(search.cutoffs[index] || index === search.current && search.phase === "prune" && expectedStep(tree, search));
    const value = nodeValue(tree, index, search);
    return {
      alpha, beta,
      alphaCut: cutting && (alpha >= beta || value === 1),
      betaCut: cutting && (alpha >= beta || value === -1),
      alphaChanged: generated && alpha !== tree.entryAlphas[index],
      betaChanged: generated && beta !== tree.entryBetas[index]
    };
  }

  function optimalPath(tree) {
    const path = [];
    for (let node = 0; node !== -1; node = tree.bestChildren[node]) path.push(node);
    return path;
  }

  function positionAt(tree, index) {
    const path = [];
    for (let current = index; tree.parents[current] !== -1; current = tree.parents[current]) path.push(tree.moves[current]);
    const board = tree.board.slice();
    let turn = tree.turn;
    for (const move of path.reverse()) {
      board[move] = turn;
      turn = other(turn);
    }
    return { board, turn };
  }

  function plotBounds(width) {
    const left = 92;
    const right = 37;
    return { left, right, width: Math.max(1, width - left - right) };
  }

  function geometry(tree, width, zoom, position) {
    const bounds = plotBounds(width);
    const visibleStart = position * (1 - 1 / zoom);
    const leafWidth = bounds.width * zoom / tree.leafCount;
    return {
      ...bounds, leafWidth, rowHeight: 300 / (tree.maxDepth + 1),
      nodeWidth: Math.min(16, leafWidth * 0.7),
      nodeHeight: Math.min(14, Math.max(8, leafWidth * 0.7)),
      x: index => bounds.left + (((tree.starts[index] + tree.ends[index]) / 2 / tree.leafCount) - visibleStart) * bounds.width * zoom,
      y: index => (tree.depths[index] + 0.5) * 300 / (tree.maxDepth + 1)
    };
  }

  function hitTest(tree, width, zoom, position, x, y) {
    const layout = geometry(tree, width, zoom, position);
    if (layout.leafWidth < 10 || x < layout.left || x > width - layout.right) return null;
    let closest = null;
    let distance = Infinity;
    for (const index of visibleNodes(tree, zoom, position)) {
      const dx = Math.abs(layout.x(index) - x);
      const dy = Math.abs(layout.y(index) - y);
      if (dx <= Math.max(6, layout.nodeWidth / 2 + 3) && dy <= layout.nodeHeight / 2 + 4 && dx < distance) {
        closest = index;
        distance = dx;
      }
    }
    return closest;
  }

  function zoomPosition(zoom, position, nextZoom, anchor) {
    if (nextZoom === 1) return 0.5;
    const start = position * (1 - 1 / zoom);
    const nextStart = start + anchor * (1 / zoom - 1 / nextZoom);
    return Math.max(0, Math.min(1, nextStart / (1 - 1 / nextZoom)));
  }

  function visibleNodes(tree, zoom, position) {
    const start = position * (1 - 1 / zoom);
    const end = start + 1 / zoom;
    const center = index => (tree.starts[index] + tree.ends[index]) / (2 * tree.leafCount);
    const visible = [];
    for (let i = 0; i < tree.nodeCount;) {
      const outside = tree.ends[i] / tree.leafCount <= start || tree.starts[i] / tree.leafCount >= end;
      if (!outside) {
        visible.push(i++);
      } else {
        const parent = tree.parents[i];
        if (parent >= 0) {
          const a = center(i);
          const b = center(parent);
          if (Math.max(a, b) >= start && Math.min(a, b) <= end) visible.push(i);
        }
        i = tree.subtreeEnds[i];
      }
    }
    return visible;
  }

  function draw(canvas, tree, zoom, position, selected = null, hovered = null, path = [], revealed = null, generatedThrough = null, search = null) {
    const width = canvas.clientWidth;
    const height = 300;
    const rowHeight = height / (tree.maxDepth + 1);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const { left, right, width: plotWidth, leafWidth, nodeWidth, nodeHeight, x, y } = geometry(tree, width, zoom, position);
    const visible = visibleNodes(tree, zoom, position);
    const pending = "pending";
    const valueAt = index => isPruned(tree, index, search) ? "pruned" :
      search && !isGenerated(tree, index, search) || generatedThrough !== null && index > generatedThrough ? pending :
      search ? nodeValue(tree, index, search) : revealed && !revealed[index] ? null : tree.values[index];
    const displayValues = revealed ? [-1, 0, 1, null] : [-1, 0, 1];
    if (generatedThrough !== null && generatedThrough < tree.nodeCount - 1) displayValues.push(pending);
    if (search && tree.prunedBy) {
      if (!displayValues.includes(pending)) displayValues.push(pending);
      displayValues.push("pruned");
    }

    for (let depth = 0; depth <= tree.maxDepth; depth++) {
      const player = depth % 2 === 0 ? tree.turn : other(tree.turn);
      context.fillStyle = player === "X" ? "#edf5fb" : "#fff3e8";
      context.fillRect(0, depth * rowHeight, width, rowHeight);
    }

    context.save();
    context.beginPath();
    context.rect(left, 0, plotWidth, height);
    context.clip();
    context.lineWidth = Math.min(2.5, Math.max(0.2, leafWidth * 0.5));
    context.globalAlpha = leafWidth < 2 ? 0.35 : 1;
    for (const value of displayValues) {
      context.beginPath();
      if (value === pending) {
        context.strokeStyle = "#81968a";
        context.globalAlpha = leafWidth < 2 ? 0.18 : 0.45;
        context.setLineDash([2, 4]);
      } else if (value === "pruned") {
        context.strokeStyle = "#e8b3ae";
        context.globalAlpha = 1;
      } else {
        context.strokeStyle = scoreColor(value);
      }
      for (const i of visible) {
        if (i === 0) continue;
        if (valueAt(i) !== value) continue;
        const childX = x(i);
        const parentX = x(tree.parents[i]);
        if (childX < left && parentX < left || childX > width - right && parentX > width - right) continue;
        context.moveTo(parentX, y(tree.parents[i]) + nodeHeight / 2);
        context.lineTo(childX, y(i) - nodeHeight / 2);
      }
      context.stroke();
      if (value === pending) context.setLineDash([]);
    }
    context.globalAlpha = 1;
    context.strokeStyle = "#b63832";
    context.lineWidth = 2;
    for (const index of tree.pruning && !(search && tree.prunedBy) ? visible : []) {
      if (revealed && !search && !revealed[index]) continue;
      const removed = cutMoves(tree, index, search);
      removed.forEach((move, order) => {
        const x1 = x(index);
        const y1 = y(index) + nodeHeight / 2;
        const x2 = x1 + 16 * (order + 1);
        const y2 = y1 + rowHeight * 0.65;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        const crossX = x1 + (x2 - x1) * 0.7;
        const crossY = y1 + (y2 - y1) * 0.7;
        context.moveTo(crossX - 4, crossY - 3);
        context.lineTo(crossX + 4, crossY + 3);
        context.moveTo(crossX - 4, crossY + 3);
        context.lineTo(crossX + 4, crossY - 3);
        context.stroke();
      });
    }
    if (leafWidth < 2) {
      const columns = Math.ceil(plotWidth);
      const bins = new Uint32Array((tree.maxDepth + 1) * columns * 6);
      for (const i of visible) {
        const column = Math.floor(x(i) - left);
        if (column < 0 || column >= columns) continue;
        const value = valueAt(i);
        bins[(tree.depths[i] * columns + column) * 6 + (value === "pruned" ? 5 : value === pending ? 4 : value === null ? 3 : value + 1)]++;
      }
      const rgb = [[169, 82, 18], [135, 149, 143], [37, 94, 140], [255, 255, 255], [220, 227, 223], [248, 218, 214]];
      for (let depth = 0; depth <= tree.maxDepth; depth++) {
        for (let column = 0; column < columns; column++) {
          const offset = (depth * columns + column) * 6;
          const total = bins[offset] + bins[offset + 1] + bins[offset + 2] + bins[offset + 3] + bins[offset + 4] + bins[offset + 5];
          if (!total) continue;
          const mixed = [0, 1, 2].map(channel => Math.round(
            rgb.reduce((sum, color, value) => sum + bins[offset + value] * color[channel], 0) / total
          ));
          context.fillStyle = `rgb(${mixed.join(",")})`;
          context.fillRect(left + column, depth * rowHeight + rowHeight / 2 - 4, 1, 8);
        }
      }
    } else {
      for (const value of displayValues) {
        context.fillStyle = value === "pruned" ? "#f8dad6" : value === pending ? "#a9bbb0" : scoreColor(value);
        if (value === pending) {
          context.globalAlpha = 0.28;
          context.strokeStyle = "#81968a";
          context.lineWidth = 1;
          context.setLineDash([2, 3]);
        }
        for (const i of visible) {
          if (valueAt(i) !== value) continue;
          const nodeX = x(i);
          if (nodeX < left - nodeWidth || nodeX > width - right + nodeWidth) continue;
          context.fillRect(nodeX - nodeWidth / 2, y(i) - nodeHeight / 2, nodeWidth, nodeHeight);
          if (value === pending) context.strokeRect(nodeX - nodeWidth / 2, y(i) - nodeHeight / 2, nodeWidth, nodeHeight);
        }
        if (value === pending) {
          context.globalAlpha = 1;
          context.setLineDash([]);
        }
      }
    }
    if (path.length > 1) {
      for (const index of path.slice(1)) {
        const parent = tree.parents[index];
        context.beginPath();
        context.moveTo(x(parent), y(parent) + nodeHeight / 2);
        context.lineTo(x(index), y(index) - nodeHeight / 2);
        context.setLineDash([]);
        context.strokeStyle = "#fff";
        context.lineWidth = 7;
        context.stroke();
        context.setLineDash([6, 4]);
        context.strokeStyle = scoreColor(valueAt(index));
        context.lineWidth = 4;
        context.stroke();
      }
      context.setLineDash([]);
    }
    if (path.length === 1) {
      context.strokeStyle = "#253c3b";
      context.lineWidth = 2;
      context.strokeRect(x(path[0]) - Math.max(nodeWidth, 4) / 2 - 3, y(path[0]) - nodeHeight / 2 - 3, Math.max(nodeWidth, 4) + 6, nodeHeight + 6);
    }
    if (hovered !== null) {
      context.strokeStyle = "#253c3b";
      context.lineWidth = 2;
      for (const index of [hovered, ...children(tree, hovered)]) {
        context.strokeRect(x(index) - Math.max(nodeWidth, 4) / 2 - 2, y(index) - nodeHeight / 2 - 2, Math.max(nodeWidth, 4) + 4, nodeHeight + 4);
      }
    }
    if (selected !== null) {
      context.strokeStyle = "#253c3b";
      context.lineWidth = 2;
      context.strokeRect(x(selected) - Math.max(nodeWidth, 4) / 2 - 3, y(selected) - nodeHeight / 2 - 3, Math.max(nodeWidth, 4) + 6, nodeHeight + 6);
    }
    context.restore();
    return leafWidth;
  }

  return { build, children, firstPostorder, nextPostorder, navigate, createSearch, expectedStep, advanceSearch, nodeValue, isPruned, isGenerated, cutMoves, limits, optimalPath, positionAt, plotBounds, geometry, hitTest, draw, zoomPosition, visibleNodes, scoreColor };
})();

if (typeof module !== "undefined" && module.exports) module.exports = OverviewTree;
