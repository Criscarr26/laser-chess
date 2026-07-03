/*
 * Laser Chess — Motor de reglas
 * Portado de laser_chess.py (versión de consola).
 * Lógica pura: sin DOM, sin efectos. La UI y la IA consumen este módulo.
 */
'use strict';

const LaserChess = (() => {
  const ROWS = 8;
  const COLS = 10;

  // Jugadores
  const RED = 0, BLUE = 1;
  const PLAYER_NAME = ['ROJO', 'AZUL'];

  // Tipos de pieza
  const PHARAOH = 0, SPHINX = 1, TRIANGLE = 2, BLOCK = 3, MIRROR = 4;
  const TYPE_NAME = ['Faraón', 'Esfinge', 'Triángulo', 'Bloque', 'Espejo Doble'];

  // Rango para la regla de intercambio del Espejo Doble
  // (indexado por tipo: Faraón=3, Esfinge=5, Triángulo=1, Bloque=2, Espejo=4)
  const RANK = [3, 5, 1, 2, 4];

  // Direcciones (Norte, Este, Sur, Oeste) y sus deltas
  const N = 0, E = 1, S = 2, W = 3;
  const DR = [-1, 0, 1, 0];
  const DC = [0, 1, 0, -1];

  // Esquinas del Triángulo, en orden de rotación horaria: NO, NE, SE, SO
  const NW = 0, NE = 1, SE = 2, SW = 3;

  // Forma del espejo: '/' o '\'
  const SLASH = 0, BACKSLASH = 1;

  // Diagonal que corresponde a cada esquina del triángulo
  const CORNER_FORM = [SLASH, BACKSLASH, SLASH, BACKSLASH];

  // Lados espejados del triángulo: direcciones DESDE las que el láser
  // puede llegar y reflejarse (el "origen" del rayo)
  const MIRROR_ORIGINS = [
    [S, E], // NW
    [S, W], // NE
    [N, W], // SE
    [N, E], // SW
  ];

  // REFLECT[forma][dirección de viaje del láser] = nueva dirección
  const REFLECT = [
    [E, N, W, S], // '/'  : N→E, E→N, S→W, W→S
    [W, S, E, N], // '\'  : N→W, E→S, S→E, W→N
  ];

  const idx = (r, c) => r * COLS + c;
  const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const opponent = (p) => 1 - p;

  // Casillas exclusivas por color (la del color contrario no puede entrar)
  const ONLY_RED = new Set([idx(0, 8), idx(7, 8)]);
  for (let r = 1; r < 8; r++) ONLY_RED.add(idx(r, 0));
  const ONLY_BLUE = new Set([idx(0, 1), idx(7, 1)]);
  for (let r = 0; r < 7; r++) ONLY_BLUE.add(idx(r, 9));

  function piece(owner, type, opts = {}) {
    return {
      owner,
      type,
      dir: opts.dir !== undefined ? opts.dir : N,
      corner: opts.corner !== undefined ? opts.corner : NW,
      form: opts.form !== undefined ? opts.form : SLASH,
    };
  }

  const canMove = (p) => p.type !== SPHINX;
  const canRotate = (p) => p.type === SPHINX || p.type === TRIANGLE || p.type === MIRROR;

  // side: -1 = izquierda (antihorario), +1 = derecha (horario)
  function rotatePiece(p, side) {
    if (p.type === SPHINX) {
      return piece(p.owner, p.type, { dir: (p.dir + side + 4) % 4 });
    }
    if (p.type === TRIANGLE) {
      return piece(p.owner, p.type, { corner: (p.corner + side + 4) % 4 });
    }
    // Espejo doble: alterna '/' y '\' sin importar el lado
    return piece(p.owner, p.type, { form: p.form ^ 1 });
  }

  function initialState() {
    const board = new Array(ROWS * COLS).fill(null);
    const put = (r, c, p) => { board[idx(r, c)] = p; };

    // ROJO (arriba)
    put(0, 0, piece(RED, SPHINX, { dir: S }));
    put(0, 4, piece(RED, BLOCK));
    put(0, 5, piece(RED, PHARAOH));
    put(0, 6, piece(RED, BLOCK));
    put(0, 7, piece(RED, TRIANGLE, { corner: NW }));
    put(1, 2, piece(RED, TRIANGLE, { corner: NE }));
    put(3, 0, piece(RED, TRIANGLE, { corner: SW }));
    put(3, 4, piece(RED, MIRROR, { form: BACKSLASH }));
    put(3, 5, piece(RED, MIRROR, { form: SLASH }));
    put(3, 7, piece(RED, TRIANGLE, { corner: NW }));
    put(4, 0, piece(RED, TRIANGLE, { corner: NW }));
    put(4, 7, piece(RED, TRIANGLE, { corner: SW }));
    put(5, 6, piece(RED, TRIANGLE, { corner: NW }));

    // AZUL (abajo)
    put(2, 3, piece(BLUE, TRIANGLE, { corner: SE }));
    put(3, 2, piece(BLUE, TRIANGLE, { corner: NE }));
    put(3, 9, piece(BLUE, TRIANGLE, { corner: SE }));
    put(4, 2, piece(BLUE, TRIANGLE, { corner: SE }));
    put(4, 4, piece(BLUE, MIRROR, { form: SLASH }));
    put(4, 5, piece(BLUE, MIRROR, { form: BACKSLASH }));
    put(4, 9, piece(BLUE, TRIANGLE, { corner: NE }));
    put(6, 7, piece(BLUE, TRIANGLE, { corner: SW }));
    put(7, 2, piece(BLUE, TRIANGLE, { corner: SE }));
    put(7, 3, piece(BLUE, BLOCK));
    put(7, 4, piece(BLUE, PHARAOH));
    put(7, 5, piece(BLUE, BLOCK));
    put(7, 9, piece(BLUE, SPHINX, { dir: N }));

    return {
      board,
      current: RED,
      winner: null,
      message: 'Turno de ROJO — mueve, rota o intercambia una pieza',
    };
  }

  function canEnter(p, r, c) {
    const i = idx(r, c);
    if (p.owner === RED && ONLY_BLUE.has(i)) return false;
    if (p.owner === BLUE && ONLY_RED.has(i)) return false;
    return true;
  }

  function* adjacents(r, c) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (inside(nr, nc)) yield [nr, nc];
      }
    }
  }

  function legalActions(state) {
    const actions = [];
    if (state.winner !== null) return actions;
    const { board, current } = state;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[idx(r, c)];
        if (!p || p.owner !== current) continue;

        if (p.type === SPHINX) {
          // La Esfinge solo rota, y nunca puede apuntar fuera del tablero
          for (const side of [-1, 1]) {
            const nd = (p.dir + side + 4) % 4;
            if (inside(r + DR[nd], c + DC[nd])) {
              actions.push({ kind: 'rotate', at: [r, c], side });
            }
          }
          continue;
        }

        if (p.type === TRIANGLE) {
          actions.push({ kind: 'rotate', at: [r, c], side: -1 });
          actions.push({ kind: 'rotate', at: [r, c], side: 1 });
        } else if (p.type === MIRROR) {
          // Ambos lados producen el mismo resultado: una sola acción
          actions.push({ kind: 'rotate', at: [r, c], side: 1 });
        }

        for (const [nr, nc] of adjacents(r, c)) {
          const q = board[idx(nr, nc)];
          if (q === null && canEnter(p, nr, nc)) {
            actions.push({ kind: 'move', from: [r, c], to: [nr, nc] });
          }
          // Intercambio del Espejo Doble: con Triángulo o Bloque
          // (de cualquier color), nunca con Faraón ni Esfinge
          if (p.type === MIRROR && q &&
              (q.type === TRIANGLE || q.type === BLOCK) &&
              RANK[q.type] < RANK[MIRROR] &&
              canEnter(p, nr, nc) && canEnter(q, r, c)) {
            actions.push({ kind: 'swap', from: [r, c], to: [nr, nc] });
          }
        }
      }
    }
    return actions;
  }

  function findSphinx(board, owner) {
    for (let i = 0; i < board.length; i++) {
      const p = board[i];
      if (p && p.owner === owner && p.type === SPHINX) {
        return [Math.floor(i / COLS), i % COLS];
      }
    }
    return null;
  }

  /*
   * Dispara el láser de `shooter` sobre `board`.
   * Si destroy=true, elimina del tablero la pieza destruida.
   * Devuelve { points, event }:
   *  - points: vértices del rayo en coordenadas [fila, col] (pueden ser
   *    fraccionarios en el punto de salida del tablero) para la animación.
   *  - event: { type: 'sin_esfinge'|'fuera'|'absorbido'|'faraon'|'destruccion',
   *             at?, target? }
   */
  function traceLaser(board, shooter, destroy = false) {
    const start = findSphinx(board, shooter);
    if (!start) return { points: [], event: { type: 'sin_esfinge' } };

    let [r, c] = start;
    let d = board[idx(r, c)].dir;
    const points = [[r, c]];
    r += DR[d]; c += DC[d];

    let steps = 0;
    while (inside(r, c) && steps++ < 500) {
      const i = idx(r, c);
      const q = board[i];

      if (q === null) {
        r += DR[d]; c += DC[d];
        continue;
      }

      if (q.type === TRIANGLE) {
        const origin = (d + 2) % 4;
        if (MIRROR_ORIGINS[q.corner].includes(origin)) {
          points.push([r, c]);
          d = REFLECT[CORNER_FORM[q.corner]][d];
          r += DR[d]; c += DC[d];
          continue;
        }
        points.push([r, c]);
        if (destroy) board[i] = null;
        return { points, event: { type: 'destruccion', at: [r, c], target: q } };
      }

      if (q.type === MIRROR) {
        points.push([r, c]);
        d = REFLECT[q.form][d];
        r += DR[d]; c += DC[d];
        continue;
      }

      if (q.type === SPHINX) {
        points.push([r, c]);
        return { points, event: { type: 'absorbido', at: [r, c], target: q } };
      }

      if (q.type === PHARAOH) {
        points.push([r, c]);
        return { points, event: { type: 'faraon', at: [r, c], target: q } };
      }

      // BLOCK: absorbe el láser pero queda destruido
      points.push([r, c]);
      if (destroy) board[i] = null;
      return { points, event: { type: 'destruccion', at: [r, c], target: q } };
    }

    // Salió del tablero: el último punto es el borde
    points.push([r - DR[d] * 0.5, c - DC[d] * 0.5]);
    return { points, event: { type: 'fuera' } };
  }

  /*
   * Aplica una acción legal y dispara el láser del jugador actual.
   * No muta el estado recibido: devuelve { state, laser, notation }.
   *
   * Regla de victoria (corregida respecto a la versión de consola):
   * pierde el DUEÑO del Faraón alcanzado, sin importar quién disparó.
   */
  function applyAction(state, action) {
    const board = state.board.slice();
    const shooter = state.current;
    let notation;

    if (action.kind === 'move') {
      const [r, c] = action.from, [nr, nc] = action.to;
      board[idx(nr, nc)] = board[idx(r, c)];
      board[idx(r, c)] = null;
      notation = `(${r},${c})→(${nr},${nc})`;
    } else if (action.kind === 'rotate') {
      const [r, c] = action.at;
      board[idx(r, c)] = rotatePiece(board[idx(r, c)], action.side);
      notation = `R (${r},${c}) ${action.side === -1 ? 'I' : 'D'}`;
    } else if (action.kind === 'swap') {
      const [r, c] = action.from, [nr, nc] = action.to;
      const i = idx(r, c), j = idx(nr, nc);
      const tmp = board[i];
      board[i] = board[j];
      board[j] = tmp;
      notation = `I (${r},${c})↔(${nr},${nc})`;
    } else {
      throw new Error(`Acción desconocida: ${action.kind}`);
    }

    const laser = traceLaser(board, shooter, true);
    const ev = laser.event;

    let winner = null;
    let current = shooter;
    let message;

    if (ev.type === 'faraon') {
      winner = opponent(ev.target.owner);
      message = `¡Faraón de ${PLAYER_NAME[ev.target.owner]} alcanzado! — Gana ${PLAYER_NAME[winner]}`;
    } else if (ev.type === 'sin_esfinge') {
      winner = opponent(shooter);
      message = `La Esfinge fue destruida — Gana ${PLAYER_NAME[winner]}`;
    } else {
      current = opponent(shooter);
      if (ev.type === 'destruccion') {
        message = `${TYPE_NAME[ev.target.type]} de ${PLAYER_NAME[ev.target.owner]} destruido — turno de ${PLAYER_NAME[current]}`;
      } else if (ev.type === 'absorbido') {
        message = `Láser absorbido por la Esfinge — turno de ${PLAYER_NAME[current]}`;
      } else {
        message = `El láser salió del tablero — turno de ${PLAYER_NAME[current]}`;
      }
    }

    return {
      state: { board, current, winner, message },
      laser,
      notation,
    };
  }

  return {
    ROWS, COLS,
    RED, BLUE, PLAYER_NAME,
    PHARAOH, SPHINX, TRIANGLE, BLOCK, MIRROR, TYPE_NAME,
    N, E, S, W, DR, DC,
    NW, NE, SE, SW,
    SLASH, BACKSLASH,
    ONLY_RED, ONLY_BLUE,
    idx, inside, opponent, piece,
    canMove, canRotate, rotatePiece,
    initialState, canEnter, legalActions,
    findSphinx, traceLaser, applyAction,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LaserChess;
}
if (typeof window !== 'undefined') {
  window.LaserChess = LaserChess;
}
