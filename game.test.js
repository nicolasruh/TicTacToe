"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { result, evaluate, analyze, bestMove } = require("./game.js");

test("erkennt Gewinnreihen und Unentschieden", () => {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const line of lines) {
    const board = Array(9).fill(null);
    line.forEach(index => { board[index] = "X"; });
    assert.deepEqual(result(board), { winner: "X", line });
  }
  assert.deepEqual(result(["X", "O", "X", "X", "O", "O", "O", "X", "X"]), { winner: null, line: [] });
  assert.equal(result(Array(9).fill(null)), null);
});

test("Minimax gewinnt oder blockiert und verändert das Spielfeld nicht", () => {
  const win = ["X", "X", null, "O", "O", null, null, null, null];
  const before = win.slice();
  assert.equal(bestMove(win, "X"), 2);
  assert.deepEqual(win, before);
  assert.equal(bestMove(["X", "X", null, null, "O", null, null, null, null], "O"), 2);
  assert.equal(bestMove(["X", "X", "X", "O", "O", null, null, null, null], "O"), null);
});

test("Analyse bewertet alle Folgezüge aus X-Perspektive", () => {
  const board = ["X", "X", null, "O", "O", null, null, null, null];
  const before = board.slice();
  const analysis = analyze(board, "X");
  assert.equal(analysis.score, 1);
  assert.deepEqual(analysis.children.map(child => child.move), [2, 5, 6, 7, 8]);
  assert.equal(analysis.children.find(child => child.move === 2).score, 1);
  assert.deepEqual(board, before);
  assert.equal(evaluate(["O", "O", "O", "X", "X", null, null, null, null], "X"), -1);
  assert.deepEqual(analyze(["X", "O", "X", "X", "O", "O", "O", "X", "X"], "O"), { score: 0, children: [] });
});

test("alle erreichbaren Stellungen erfüllen die Minimax-Regel", () => {
  const visited = new Set();
  function visit(board, turn) {
    const key = `${board.map(value => value || "-").join("")}:${turn}`;
    if (visited.has(key)) return;
    visited.add(key);
    const outcome = result(board);
    const analysis = analyze(board, turn);
    if (outcome) {
      assert.equal(analysis.score, outcome.winner === "X" ? 1 : outcome.winner === "O" ? -1 : 0);
      assert.equal(analysis.children.length, 0);
      return;
    }
    assert.equal(analysis.children.length, board.filter(value => !value).length);
    for (const child of analysis.children) {
      assert.equal(board[child.move], null);
      assert.equal(child.board[child.move], turn);
      assert.equal(child.score, evaluate(child.board, turn === "X" ? "O" : "X"));
      visit(child.board, turn === "X" ? "O" : "X");
    }
    const childScores = analysis.children.map(child => child.score);
    assert.equal(analysis.score, turn === "X" ? Math.max(...childScores) : Math.min(...childScores));
  }
  visit(Array(9).fill(null), "X");
  assert.equal(visited.size, 5478);
});

for (const computer of ["X", "O"]) {
  test(`Computer ${computer} verliert gegen keine mögliche menschliche Zugfolge`, () => {
    function explore(board, turn) {
      const outcome = result(board);
      if (outcome) {
        assert.notEqual(outcome.winner, computer === "X" ? "O" : "X");
        return;
      }
      const moves = turn === computer
        ? [bestMove(board, turn)]
        : board.map((value, index) => value ? null : index).filter(index => index !== null);
      for (const move of moves) {
        assert.equal(board[move], null);
        const next = board.slice();
        next[move] = turn;
        explore(next, turn === "X" ? "O" : "X");
      }
    }
    explore(Array(9).fill(null), "X");
  });
}
