/*
 * Tests del motor de Laser Chess.
 * Ejecutar con: node --test tests/
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const LC = require('../js/engine.js');
const AI = require('../js/ai.js');

const countPieces = (board) => board.filter(Boolean).length;

function emptyState(current = LC.RED) {
  return {
    board: new Array(LC.ROWS * LC.COLS).fill(null),
    current,
    winner: null,
    message: '',
  };
}

test('estado inicial: 26 piezas, 13 por bando, empieza ROJO', () => {
  const s = LC.initialState();
  assert.strictEqual(countPieces(s.board), 26);
  const reds = s.board.filter((p) => p && p.owner === LC.RED).length;
  const blues = s.board.filter((p) => p && p.owner === LC.BLUE).length;
  assert.strictEqual(reds, 13);
  assert.strictEqual(blues, 13);
  assert.strictEqual(s.current, LC.RED);
  assert.strictEqual(s.winner, null);
});

test('apertura: el láser rojo rebota en 4 espejos y sale del tablero', () => {
  const s = LC.initialState();
  // Mover el triángulo rojo (5,6) a (5,5) no interfiere con el rayo
  const res = LC.applyAction(s, { kind: 'move', from: [5, 6], to: [5, 5] });
  assert.strictEqual(res.laser.event.type, 'fuera');
  assert.strictEqual(countPieces(res.state.board), 26);
  assert.strictEqual(res.state.current, LC.BLUE);
  assert.strictEqual(res.state.winner, null);
  // Rebotes esperados: (3,0) → (3,2) → (4,2) → (4,0) → sale por el sur
  const bounces = res.laser.points.slice(1, -1);
  assert.deepStrictEqual(bounces, [[3, 0], [3, 2], [4, 2], [4, 0]]);
});

test('applyAction no muta el estado original', () => {
  const s = LC.initialState();
  const before = countPieces(s.board);
  LC.applyAction(s, { kind: 'move', from: [5, 6], to: [5, 5] });
  assert.strictEqual(countPieces(s.board), before);
  assert.strictEqual(s.current, LC.RED);
});

test('la Esfinge no se mueve y solo rota hacia dentro del tablero', () => {
  const s = LC.initialState();
  const acts = LC.legalActions(s).filter((a) => {
    const at = a.kind === 'rotate' ? a.at : a.from;
    return at[0] === 0 && at[1] === 0;
  });
  assert.ok(acts.every((a) => a.kind === 'rotate'), 'la Esfinge no debe tener movimientos');
  // En (0,0) mirando al Sur: girar izquierda (→ Este) es válido,
  // girar derecha (→ Oeste) apuntaría fuera del tablero
  assert.deepStrictEqual(acts.map((a) => a.side), [-1]);
});

test('el láser que alcanza al Faraón enemigo da la victoria', () => {
  const s = emptyState(LC.RED);
  s.board[LC.idx(0, 0)] = LC.piece(LC.RED, LC.SPHINX, { dir: LC.S });
  s.board[LC.idx(3, 0)] = LC.piece(LC.BLUE, LC.PHARAOH);
  s.board[LC.idx(5, 5)] = LC.piece(LC.RED, LC.TRIANGLE);
  const res = LC.applyAction(s, { kind: 'move', from: [5, 5], to: [5, 6] });
  assert.strictEqual(res.laser.event.type, 'faraon');
  assert.strictEqual(res.state.winner, LC.RED);
});

test('alcanzar a tu PROPIO Faraón te hace perder (regla corregida)', () => {
  const s = emptyState(LC.RED);
  s.board[LC.idx(0, 0)] = LC.piece(LC.RED, LC.SPHINX, { dir: LC.S });
  s.board[LC.idx(3, 0)] = LC.piece(LC.RED, LC.PHARAOH);
  s.board[LC.idx(5, 5)] = LC.piece(LC.RED, LC.TRIANGLE);
  const res = LC.applyAction(s, { kind: 'move', from: [5, 5], to: [5, 6] });
  assert.strictEqual(res.laser.event.type, 'faraon');
  assert.strictEqual(res.state.winner, LC.BLUE);
});

test('el Bloque absorbe el láser pero queda destruido', () => {
  const s = emptyState(LC.RED);
  s.board[LC.idx(0, 0)] = LC.piece(LC.RED, LC.SPHINX, { dir: LC.S });
  s.board[LC.idx(4, 0)] = LC.piece(LC.BLUE, LC.BLOCK);
  s.board[LC.idx(5, 5)] = LC.piece(LC.RED, LC.TRIANGLE);
  const res = LC.applyAction(s, { kind: 'move', from: [5, 5], to: [5, 6] });
  assert.strictEqual(res.laser.event.type, 'destruccion');
  assert.strictEqual(res.laser.event.target.type, LC.BLOCK);
  assert.strictEqual(res.state.board[LC.idx(4, 0)], null);
  assert.strictEqual(res.state.current, LC.BLUE);
});

test('el Triángulo golpeado por una cara sin espejo se destruye', () => {
  const s = emptyState(LC.RED);
  s.board[LC.idx(0, 0)] = LC.piece(LC.RED, LC.SPHINX, { dir: LC.S });
  // Esquina NO: caras espejadas hacia S y E; el rayo llega desde el Norte
  s.board[LC.idx(4, 0)] = LC.piece(LC.BLUE, LC.TRIANGLE, { corner: LC.NW });
  s.board[LC.idx(5, 5)] = LC.piece(LC.RED, LC.TRIANGLE);
  const res = LC.applyAction(s, { kind: 'move', from: [5, 5], to: [5, 6] });
  assert.strictEqual(res.laser.event.type, 'destruccion');
  assert.strictEqual(res.laser.event.target.type, LC.TRIANGLE);
  assert.strictEqual(res.state.board[LC.idx(4, 0)], null);
});

test('zonas exclusivas: AZUL no puede entrar en casillas solo-ROJO', () => {
  const s = emptyState(LC.BLUE);
  s.board[LC.idx(3, 1)] = LC.piece(LC.BLUE, LC.TRIANGLE);
  const moves = LC.legalActions(s).filter((a) => a.kind === 'move');
  const intoCol0 = moves.filter((a) => a.to[1] === 0);
  assert.strictEqual(intoCol0.length, 0, 'AZUL no debe poder entrar a la columna 0');
  assert.ok(moves.length > 0, 'debe tener otros movimientos');
});

test('el Espejo Doble intercambia con Triángulo/Bloque pero no con el Faraón', () => {
  const s = emptyState(LC.RED);
  s.board[LC.idx(2, 2)] = LC.piece(LC.RED, LC.MIRROR);
  s.board[LC.idx(2, 3)] = LC.piece(LC.RED, LC.TRIANGLE);
  s.board[LC.idx(3, 2)] = LC.piece(LC.BLUE, LC.BLOCK);
  s.board[LC.idx(1, 1)] = LC.piece(LC.RED, LC.PHARAOH);
  const swaps = LC.legalActions(s).filter((a) => a.kind === 'swap');
  const targets = swaps.map((a) => `${a.to[0]},${a.to[1]}`).sort();
  assert.deepStrictEqual(targets, ['2,3', '3,2']);
});

test('rotar un Triángulo gira su esquina en el orden NO→NE→SE→SO', () => {
  const p = LC.piece(LC.RED, LC.TRIANGLE, { corner: LC.NW });
  assert.strictEqual(LC.rotatePiece(p, 1).corner, LC.NE);
  assert.strictEqual(LC.rotatePiece(p, -1).corner, LC.SW);
});

test('la IA encuentra la jugada ganadora inmediata', () => {
  const s = emptyState(LC.RED);
  // La Esfinge mira al Este; rotarla a la derecha (→ Sur) alcanza al Faraón azul
  s.board[LC.idx(0, 0)] = LC.piece(LC.RED, LC.SPHINX, { dir: LC.E });
  s.board[LC.idx(5, 0)] = LC.piece(LC.BLUE, LC.PHARAOH);
  s.board[LC.idx(2, 5)] = LC.piece(LC.RED, LC.TRIANGLE);
  s.board[LC.idx(7, 9)] = LC.piece(LC.BLUE, LC.SPHINX, { dir: LC.N });
  const action = AI.chooseAction(s, 'facil');
  const res = LC.applyAction(s, action);
  assert.strictEqual(res.state.winner, LC.RED, `la IA eligió ${JSON.stringify(action)}`);
});

test('la IA devuelve siempre una acción legal en el estado inicial', () => {
  const s = LC.initialState();
  const legal = LC.legalActions(s);
  const action = AI.chooseAction(s, 'medio');
  assert.ok(legal.some((a) => JSON.stringify(a) === JSON.stringify(action)));
});
