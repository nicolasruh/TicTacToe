"use strict";

const MinimaxWorksheet = (() => {
  const treeApi = typeof module !== "undefined" && module.exports ? require("./overview.js") : OverviewTree;
  const maxNodes = 29;
  const cardWidth = 68;
  const cardHeight = 78;
  const column = 76;
  const row = 102;
  const margin = 30;
  const header = 80;
  const footer = 36;

  function layout(tree) {
    const graphWidth = tree.leafCount * column;
    const graphHeight = (tree.maxDepth + 1) * row;
    function candidate(width, height) {
      return { width, height, scale: Math.min(1, (width - margin * 2 - 32) / graphWidth, (height - header - footer) / graphHeight) };
    }
    const portrait = candidate(595.28, 841.89);
    const landscape = candidate(841.89, 595.28);
    const page = portrait.scale >= landscape.scale ? portrait : landscape;
    return {
      ...page,
      x: node => margin + 32 + (page.width - margin * 2 - 32 - graphWidth * page.scale) / 2 + ((tree.starts[node] + tree.ends[node]) / 2) * column * page.scale,
      y: node => header + tree.depths[node] * row * page.scale
    };
  }

  function create(board, turn, pruning) {
    const tree = treeApi.build(board, turn, pruning, true, true);
    if (tree.nodeCount > maxNodes) throw new RangeError(`Das Aufgabenblatt ist auf ${maxNodes} Knoten begrenzt; dieser Baum hat ${tree.nodeCount}.`);
    const page = layout(tree);
    const num = n => Number(n.toFixed(3)).toString();
    const hex = text => Array.from(text, char => {
      const code = char.charCodeAt(0);
      if (code > 255) throw new Error(`Nicht unterstütztes PDF-Zeichen: ${char}`);
      return code.toString(16).padStart(2, "0");
    }).join("");
    const rgb = values => values.map(num).join(" ");

    function render(solution) {
      const commands = [];
      const s = page.scale;
      const text = (x, y, value, size, font = "F1", color = [0.12, 0.18, 0.16]) => {
        commands.push(`${rgb(color)} rg BT /${font} ${num(size)} Tf 1 0 0 1 ${num(x)} ${num(page.height - y)} Tm <${hex(value)}> Tj ET`);
      };
      const rect = (x, y, w, h, fill, stroke = null) => {
        if (fill) commands.push(`${rgb(fill)} rg`);
        if (stroke) commands.push(`${rgb(stroke)} RG ${num(0.65 * s)} w`);
        commands.push(`${num(x)} ${num(page.height - y - h)} ${num(w)} ${num(h)} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
      };
      const line = (x1, y1, x2, y2, color = [0.45, 0.51, 0.48], width = 0.8) => {
        commands.push(`${rgb(color)} RG ${num(width * s)} w ${num(x1)} ${num(page.height - y1)} m ${num(x2)} ${num(page.height - y2)} l S`);
      };
      text(margin, 30, solution ? "Minimax - Lösungsblatt" : "Minimax - Aufgabenblatt", 15, "F2");
      text(margin, 47, pruning ? "Alpha-Beta-Pruning: ein" : "Alpha-Beta-Pruning: aus", 9);
      text(margin, 61, "S = Score. Score, Alpha und Beta nach der Tiefensuche eintragen (X = MAX, O = MIN).", 8);
      for (let depth = 0; depth <= tree.maxDepth; depth++) {
        const player = depth % 2 === 0 ? tree.turn : tree.turn === "X" ? "O" : "X";
        const top = header + depth * row * s - 5 * s;
        rect(margin, top, page.width - margin * 2, row * s, player === "X" ? [0.93, 0.96, 0.98] : [1, 0.96, 0.92]);
        text(margin + 3, top + 12 * s, `${player} ${player === "X" ? "MAX" : "MIN"}`, Math.min(8, 7 * s), "F2");
      }
      for (let node = 1; node < tree.nodeCount; node++) {
        const parent = tree.parents[node];
        line(page.x(parent), page.y(parent) + cardHeight * s, page.x(node), page.y(node));
      }
      for (let node = 0; node < tree.nodeCount; node++) {
        const left = page.x(node) - cardWidth * s / 2;
        const top = page.y(node);
        const excluded = pruning && tree.prunedBy[node] !== -1;
        rect(left, top, cardWidth * s, cardHeight * s, [1, 1, 1], [0.48, 0.55, 0.51]);
        const position = treeApi.positionAt(tree, node);
        const cell = 9 * s;
        const bx = left + 4 * s;
        const by = top + 9 * s;
        for (let i = 0; i < 9; i++) {
          const x = bx + i % 3 * cell;
          const y = by + Math.floor(i / 3) * cell;
          rect(x, y, cell, cell, [1, 1, 1], [0.48, 0.55, 0.51]);
          if (position.board[i]) text(x + 2 * s, y + 7 * s, position.board[i], 7 * s, "F2", position.board[i] === "X" ? [0.15, 0.37, 0.55] : [0.66, 0.32, 0.07]);
        }
        const labels = ["S", "a", "b"];
        const values = [tree.values[node], tree.alphas[node], tree.betas[node]];
        for (let i = 0; i < 3; i++) {
          const y = top + (7 + 21 * i) * s;
          text(left + 34 * s, y + 12 * s, labels[i], 8 * s, i ? "F3" : "F2");
          rect(left + 45 * s, y, 19 * s, 19 * s, solution ? [1, 1, 1] : [0.94, 0.94, 0.94], [0.49, 0.54, 0.51]);
          if (solution && !excluded) {
            const value = values[i];
            const prefix = i === 0 && tree.bounds[node] ? tree.bounds[node] < 0 ? "<=" : ">=" : "";
            if (!Number.isFinite(value)) {
              text(left + 47 * s, y + 12 * s, value < 0 ? "-" : "+", 7 * s);
              text(left + 51 * s, y + 12 * s, "\xa5", 8 * s, "F3");
            } else {
              text(left + 46 * s, y + 12 * s, `${prefix}${value > 0 ? "+1" : value}`, 7 * s);
            }
          } else if (solution) {
            text(left + 52 * s, y + 12 * s, "-", 7 * s);
          }
        }
        if (node === 0) text(left + 4 * s, top + 70 * s, "Root", 6 * s, "F2");
        if (solution && excluded) {
          line(left + 2 * s, top + 2 * s, left + (cardWidth - 2) * s, top + (cardHeight - 2) * s, [0, 0, 0], 2);
          line(left + (cardWidth - 2) * s, top + 2 * s, left + 2 * s, top + (cardHeight - 2) * s, [0, 0, 0], 2);
        }
      }
      text(margin, page.height - 18, pruning
        ? solution ? "Durchgestrichen: nicht besucht. <= / >=: Schranken. Alpha/Beta beim Verlassen."
          : "Finde die abgeschnittenen Äste. Alpha/Beta: Grenzen beim Verlassen des Knotens."
        : "Alpha/Beta: Grenzen beim Verlassen; es werden keine Äste abgeschnitten.", 7);
      return commands.join("\n") + "\n";
    }

    const streams = [render(false), render(true)];
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] /Resources << /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >> /Contents 4 0 R >>`,
      `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}endstream`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] /Resources << /Font << /F1 7 0 R /F2 8 0 R /F3 9 0 R >> >> /Contents 6 0 R >>`,
      `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}endstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>"
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(pdf);
  }

  return { create, layout, maxNodes };
})();

if (typeof module !== "undefined" && module.exports) module.exports = MinimaxWorksheet;
