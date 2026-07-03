/*
 * Laser Chess — IA con minimax + poda alfa-beta.
 * Evalúa material y la amenaza de ambos láseres sobre el tablero.
 */
'use strict';

const LaserChessAI = (() => {
  const LC = (typeof module !== 'undefined' && typeof require !== 'undefined')
    ? require('./engine.js')
    : window.LaserChess;

  const WIN = 100000;

  // Valor material (los espejos y esfinges son indestructibles; el Faraón
  // se maneja como estado terminal, no como material)
  const VAL = [];
  VAL[LC.TRIANGLE] = 35;
  VAL[LC.BLOCK] = 20;

  // Qué tan bueno es el disparo hipotético de `shooter` en este tablero
  function shotScore(board, shooter) {
    const { event } = LC.traceLaser(board, shooter, false);
    if (event.type === 'faraon') {
      return event.target.owner === shooter ? -2500 : 1200;
    }
    if (event.type === 'destruccion') {
      const enemy = event.target.owner !== shooter;
      if (event.target.type === LC.TRIANGLE) return enemy ? 28 : -34;
      return enemy ? 12 : -20; // Bloque
    }
    return 0;
  }

  function evaluate(state, me) {
    if (state.winner !== null) {
      return state.winner === me ? WIN : -WIN;
    }
    let score = 0;
    const board = state.board;
    for (let i = 0; i < board.length; i++) {
      const p = board[i];
      if (!p) continue;
      const v = VAL[p.type];
      if (v) score += p.owner === me ? v : -v;
    }
    score += shotScore(board, me);
    score -= shotScore(board, LC.opponent(me));
    return score;
  }

  function search(state, depth, alpha, beta, me) {
    if (state.winner !== null) {
      // Preferir ganar antes / perder después
      return state.winner === me ? WIN + depth : -(WIN + depth);
    }
    if (depth === 0) return evaluate(state, me);

    const actions = LC.legalActions(state);
    if (actions.length === 0) return evaluate(state, me);

    const maximizing = state.current === me;
    const children = actions.map((a) => LC.applyAction(state, a).state);
    children.sort((a, b) => (maximizing
      ? evaluate(b, me) - evaluate(a, me)
      : evaluate(a, me) - evaluate(b, me)));

    if (maximizing) {
      let best = -Infinity;
      for (const child of children) {
        best = Math.max(best, search(child, depth - 1, alpha, beta, me));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const child of children) {
      best = Math.min(best, search(child, depth - 1, alpha, beta, me));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  const LEVELS = {
    facil:   { depth: 1, epsilon: 30 },
    medio:   { depth: 2, epsilon: 8 },
    dificil: { depth: 3, epsilon: 0 },
  };

  /*
   * Elige una acción para el jugador actual del estado.
   * epsilon > 0 permite variedad: elige al azar entre las jugadas
   * cuyo valor esté a menos de epsilon de la mejor.
   */
  function chooseAction(state, level = 'medio') {
    const { depth, epsilon } = LEVELS[level] || LEVELS.medio;
    const me = state.current;
    const actions = LC.legalActions(state);
    if (actions.length === 0) return null;

    const scored = actions.map((a) => {
      const child = LC.applyAction(state, a).state;
      return { a, child, quick: evaluate(child, me) };
    });
    scored.sort((x, y) => y.quick - x.quick);

    let alpha = -Infinity;
    const results = [];
    for (const s of scored) {
      const v = depth <= 1 ? s.quick : search(s.child, depth - 1, alpha, Infinity, me);
      results.push({ a: s.a, v });
      alpha = Math.max(alpha, v);
    }

    const best = Math.max(...results.map((r) => r.v));
    const pool = results.filter((r) => r.v >= best - epsilon);
    return pool[Math.floor(Math.random() * pool.length)].a;
  }

  return { chooseAction, evaluate, LEVELS };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LaserChessAI;
}
if (typeof window !== 'undefined') {
  window.LaserChessAI = LaserChessAI;
}
