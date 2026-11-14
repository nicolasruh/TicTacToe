"use strict";

const TicTacToe = (() => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  const moveOrder = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  const other = player => player === "X" ? "O" : "X";
  const scores = new Map();

  function result(board) {
    const line = lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
    if (line) return { winner: board[line[0]], line };
    if (board.every(Boolean)) return { winner: null, line: [] };
    return null;
  }

  function evaluate(board, turn) {
    const key = `${board.map(value => value || "-").join("")}:${turn}`;
    if (scores.has(key)) return scores.get(key);
    const outcome = result(board);
    let score;
    if (outcome) {
      score = outcome.winner === "X" ? 1 : outcome.winner === "O" ? -1 : 0;
    } else {
      const childScores = [];
      for (let index = 0; index < board.length; index++) {
        if (board[index]) continue;
        const next = board.slice();
        next[index] = turn;
        childScores.push(evaluate(next, other(turn)));
      }
      score = turn === "X" ? Math.max(...childScores) : Math.min(...childScores);
    }
    scores.set(key, score);
    return score;
  }

  function analyze(board, turn) {
    const score = evaluate(board, turn);
    const children = [];
    if (!result(board)) {
      for (let move = 0; move < board.length; move++) {
        if (board[move]) continue;
        const next = board.slice();
        next[move] = turn;
        children.push({ move, board: next, score: evaluate(next, other(turn)) });
      }
    }
    return { score, children };
  }

  function bestMove(board, player) {
    if (result(board)) return null;
    let bestScore = player === "X" ? -Infinity : Infinity;
    let best = null;
    for (const index of moveOrder) {
      if (board[index]) continue;
      const next = board.slice();
      next[index] = player;
      const score = evaluate(next, other(player));
      if (player === "X" ? score > bestScore : score < bestScore) {
        bestScore = score;
        best = index;
      }
    }
    return best;
  }

  return { result, evaluate, analyze, bestMove };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TicTacToe;
