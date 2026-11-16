"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const OverviewTree = require("./overview.js");
const Worksheet = require("./worksheet.js");

const board = ["X", "O", "X", "X", "O", "O", null, null, null];
const text = bytes => Buffer.from(bytes).toString("ascii");

function streams(pdf) {
  return [...pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g)].map(match => {
    assert.equal(match[2].length, Number(match[1]));
    return match[2];
  });
}

function textAt(stream, x, y, pageHeight) {
  const expectedX = Number(x.toFixed(3));
  const expectedY = Number((pageHeight - y).toFixed(3));
  const entries = [...stream.matchAll(/BT \/(F[123]) [\d.]+ Tf 1 0 0 1 ([\d.]+) ([\d.]+) Tm <([0-9a-f]+)> Tj ET/g)];
  const entry = entries.find(match => Number(match[2]) === expectedX && Number(match[3]) === expectedY);
  return entry ? Buffer.from(entry[4], "hex").toString("latin1") : null;
}

test("PDF enthält zwei gleich grosse A4-Seiten mit leeren Feldern und korrekten Lösungen für alle besuchten Knoten", () => {
  for (const pruning of [false, true]) {
    const tree = OverviewTree.build(board, "X", pruning, true, true);
    const page = Worksheet.layout(tree);
    const pdf = text(Worksheet.create(board, "X", pruning));
    const pages = streams(pdf);
    assert.equal(pages.length, 2);
    assert.match(pdf, /\/Count 2/);
    assert.equal((pdf.match(/\/Type \/Page \/Parent/g) || []).length, 2);
    const xref = Number(pdf.match(/startxref\n(\d+)\n/)[1]);
    assert.equal(pdf.slice(xref, xref + 4), "xref");
    const offsets = pdf.slice(xref).split("\n").slice(3, 12);
    offsets.forEach((offset, index) => assert.equal(pdf.slice(Number(offset.slice(0, 10)), Number(offset.slice(0, 10)) + 7), `${index + 1} 0 obj`));
    for (let node = 0; node < tree.nodeCount; node++) {
      const left = page.x(node) - 34 * page.scale;
      const top = page.y(node);
      for (let i = 0; i < 3; i++) {
        const x = left + 46 * page.scale;
        const y = top + (19 + 21 * i) * page.scale;
        assert.equal(textAt(pages[0], x, y, page.height), null, "Aufgabenfeld enthält keinen Lösungswert");
        const excluded = pruning && tree.prunedBy[node] !== -1;
        const value = [tree.values[node], tree.alphas[node], tree.betas[node]][i];
        if (excluded) {
          assert.equal(textAt(pages[1], left + 52 * page.scale, y, page.height), "-");
        } else if (!Number.isFinite(value)) {
          assert.equal(textAt(pages[1], left + 47 * page.scale, y, page.height), value < 0 ? "-" : "+");
          assert.equal(textAt(pages[1], left + 51 * page.scale, y, page.height), "\xa5");
        } else {
          const bound = i === 0 && tree.bounds[node] ? tree.bounds[node] < 0 ? "<=" : ">=" : "";
          assert.equal(textAt(pages[1], x, y, page.height), `${bound}${value > 0 ? "+1" : value}`);
        }
      }
    }
    assert.equal((pages[0].match(/ re B/g) || []).length, tree.nodeCount * 13);
    assert.equal((pages[1].match(/ re B/g) || []).length, tree.nodeCount * 13);
  }
});

test("Ausrichtung und Massstab halten alle Felder des maximal grossen Baums auf einer A4-Seite", () => {
  const board = ["X", "O", null, null, "X", null, "X", "O", null];
  const tree = OverviewTree.build(board, "O", false, true, true);
  assert.equal(tree.nodeCount, 29);
  const page = Worksheet.layout(tree);
  assert.ok(page.scale >= 0.5);
  assert.ok(page.width > page.height);
  for (let node = 0; node < tree.nodeCount; node++) {
    assert.ok(page.x(node) - 34 * page.scale >= 30);
    assert.ok(page.x(node) + 34 * page.scale <= page.width - 30);
    assert.ok(page.y(node) >= 80);
    assert.ok(page.y(node) + 78 * page.scale <= page.height - 36);
  }
  assert.ok(Worksheet.create(board, "O", false).length > 1000);
  const single = OverviewTree.build(["X", "X", "X", "O", "O", null, null, null, null], "O");
  assert.ok(Worksheet.layout(single).height > Worksheet.layout(single).width);
  assert.throws(() => Worksheet.create(["X", "X", "O", "X", "O", null, null, null, null], "O", false), /30/);
});

test("Das Aufgabenblatt verrät kein Pruning; nur die Lösung streicht nicht besuchte Knoten schwarz durch", () => {
  const tree = OverviewTree.build(board, "X", true, true, true);
  const excluded = Array.from(tree.prunedBy).filter(index => index !== -1).length;
  assert.ok(excluded > 0);
  const [exercise, solution] = streams(text(Worksheet.create(board, "X", true)));
  const [unprunedExercise, unprunedSolution] = streams(text(Worksheet.create(board, "X", false)));
  assert.deepEqual(exercise.split("\n").slice(3, -2), unprunedExercise.split("\n").slice(3, -2));
  assert.equal((exercise.match(/^0 0 0 RG .* m .* l S$/gm) || []).length, 0);
  assert.equal((unprunedSolution.match(/^0 0 0 RG .* m .* l S$/gm) || []).length, 0);
  assert.equal((solution.match(/^0 0 0 RG .* m .* l S$/gm) || []).length, 2 * excluded);
});

test("Ohne Pruning stimmen die gespeicherten Grenzen mit den rekursiven Ein- und Austrittswerten überein", () => {
  const tree = OverviewTree.build(["X", "O", null, null, "X", null, "X", "O", null], "O", false, true, true);
  function visit(node, alpha, beta) {
    assert.equal(tree.entryAlphas[node], alpha);
    assert.equal(tree.entryBetas[node], beta);
    const player = OverviewTree.positionAt(tree, node).turn;
    let best = player === "X" ? -Infinity : Infinity;
    for (const child of OverviewTree.children(tree, node)) {
      const value = visit(child, alpha, beta);
      best = player === "X" ? Math.max(best, value) : Math.min(best, value);
      if (player === "X") alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
    }
    assert.equal(tree.alphas[node], alpha);
    assert.equal(tree.betas[node], beta);
    return tree.values[node];
  }
  visit(0, -Infinity, Infinity);
});
