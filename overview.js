"use strict";

const OverviewTree = (() => {
  const game = typeof module !== "undefined" && module.exports ? require("./game.js") : TicTacToe;
  const other = player => player === "X" ? "O" : "X";
  const colors = ["#a95212", "#87958f", "#255e8c"];
  const scoreColor = score => score === null ? "#ffffff" : colors[score + 1];

  function build(board, turn, pruning = false) {
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
    const entryAlphas = pruning ? new Float32Array(totals.nodes) : null;
    const entryBetas = pruning ? new Float32Array(totals.nodes) : null;
    const alphas = pruning ? new Float32Array(totals.nodes) : null;
    const betas = pruning ? new Float32Array(totals.nodes) : null;
    let nodeCount = 0;
    let leafCount = 0;
    let maxDepth = 0;
    let prunedBranches = 0;

    function visit(player, parent, depth, move, alpha, beta) {
      const index = nodeCount++;
      starts[index] = leafCount;
      parents[index] = parent;
      depths[index] = depth;
      moves[index] = move;
      bestChildren[index] = -1;
      maxDepth = Math.max(maxDepth, depth);
      const originalAlpha = alpha;
      const originalBeta = beta;
      if (pruning) {
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
        for (let nextMove = 0; nextMove < 9; nextMove++) {
          if (position[nextMove]) continue;
          position[nextMove] = player;
          const childIndex = nodeCount;
          const childValue = visit(other(player), index, depth + 1, nextMove, alpha, beta);
          position[nextMove] = null;
          if (player === "X" ? childValue > value : childValue < value) {
            value = childValue;
            bestChildren[index] = childIndex;
          }
          if (player === "X") {
            alpha = Math.max(alpha, value);
          } else {
            beta = Math.min(beta, value);
          }
          if (pruning && (beta <= alpha || value === (player === "X" ? 1 : -1))) {
            for (let remaining = nextMove + 1; remaining < 9; remaining++) {
              if (!position[remaining]) prunedBranches++;
            }
            break;
          }
        }
        if (pruning && value <= originalAlpha && value !== -1) bounds[index] = -1;
        else if (pruning && value >= originalBeta && value !== 1) bounds[index] = 1;
      }
      values[index] = value;
      if (pruning) {
        alphas[index] = alpha;
        betas[index] = beta;
      }
      ends[index] = leafCount;
      subtreeEnds[index] = nodeCount;
      return value;
    }
    visit(turn, -1, 0, 255, -Infinity, Infinity);
    return { starts, ends, parents, subtreeEnds, depths, values, bounds, bestChildren, moves, entryAlphas, entryBetas, alphas, betas, nodeCount, leafCount, maxDepth, turn, pruning, prunedBranches, board: board.slice() };
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
      ...bounds, leafWidth,
      nodeWidth: Math.min(16, leafWidth * 0.7),
      nodeHeight: Math.min(14, Math.max(8, leafWidth * 0.7)),
      x: index => bounds.left + (((tree.starts[index] + tree.ends[index]) / 2 / tree.leafCount) - visibleStart) * bounds.width * zoom,
      y: index => tree.depths[index] * 48 + 24
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

  function draw(canvas, tree, zoom, position, selected = null, hovered = null, path = [], revealed = null, generatedThrough = null) {
    const width = canvas.clientWidth;
    const rowHeight = 48;
    const height = (tree.maxDepth + 1) * rowHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const { left, right, width: plotWidth, leafWidth, nodeWidth, nodeHeight, x, y } = geometry(tree, width, zoom, position);
    const visible = visibleNodes(tree, zoom, position);
    const pending = "pending";
    const valueAt = index => generatedThrough !== null && index > generatedThrough ? pending :
      revealed && !revealed[index] ? null : tree.values[index];
    const displayValues = revealed ? [-1, 0, 1, null] : [-1, 0, 1];
    if (generatedThrough !== null && generatedThrough < tree.nodeCount - 1) displayValues.push(pending);

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
    if (leafWidth < 2) {
      const columns = Math.ceil(plotWidth);
      const bins = new Uint32Array((tree.maxDepth + 1) * columns * 5);
      for (const i of visible) {
        const column = Math.floor(x(i) - left);
        if (column < 0 || column >= columns) continue;
        const value = valueAt(i);
        bins[(tree.depths[i] * columns + column) * 5 + (value === pending ? 4 : value === null ? 3 : value + 1)]++;
      }
      const rgb = [[169, 82, 18], [135, 149, 143], [37, 94, 140], [255, 255, 255], [220, 227, 223]];
      for (let depth = 0; depth <= tree.maxDepth; depth++) {
        for (let column = 0; column < columns; column++) {
          const offset = (depth * columns + column) * 5;
          const total = bins[offset] + bins[offset + 1] + bins[offset + 2] + bins[offset + 3] + bins[offset + 4];
          if (!total) continue;
          const mixed = [0, 1, 2].map(channel => Math.round(
            (bins[offset] * rgb[0][channel] + bins[offset + 1] * rgb[1][channel] + bins[offset + 2] * rgb[2][channel] + bins[offset + 3] * rgb[3][channel] + bins[offset + 4] * rgb[4][channel]) / total
          ));
          context.fillStyle = `rgb(${mixed.join(",")})`;
          context.fillRect(left + column, depth * rowHeight + rowHeight / 2 - 4, 1, 8);
        }
      }
    } else {
      for (const value of displayValues) {
        context.fillStyle = value === pending ? "#a9bbb0" : scoreColor(value);
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

  return { build, children, firstPostorder, nextPostorder, optimalPath, positionAt, plotBounds, geometry, hitTest, draw, zoomPosition, visibleNodes, scoreColor };
})();

if (typeof module !== "undefined" && module.exports) module.exports = OverviewTree;
