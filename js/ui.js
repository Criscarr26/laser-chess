/*
 * Laser Chess — Interfaz de usuario.
 * Renderizado del tablero, interacción, animación del láser y sonido.
 */
'use strict';

(() => {
  const LC = window.LaserChess;
  const AI = window.LaserChessAI;

  const CELL = 100; // unidades SVG por casilla

  // ---------- Estado de la partida ----------
  let state = LC.initialState();
  let past = [];        // pila de estados anteriores (para deshacer)
  let logEntries = [];  // entradas del historial en paralelo con `past`
  let selected = null;  // [r, c] de la pieza seleccionada
  let selActions = [];  // acciones legales de la pieza seleccionada
  let busy = false;     // bloquea input durante animación / turno de la IA
  let gameId = 0;       // invalida callbacks pendientes al reiniciar

  const settings = {
    mode: 'pve-red',     // pve-red | pve-blue | pvp | ai
    level: 'medio',      // facil | medio | dificil
    sound: true,
  };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem('laserchess-settings') || '{}'));
  } catch (_) { /* localStorage puede fallar en file:// — usar defaults */ }

  const saveSettings = () => {
    try { localStorage.setItem('laserchess-settings', JSON.stringify(settings)); } catch (_) {}
  };

  function humanPlayers() {
    switch (settings.mode) {
      case 'pve-red': return [LC.RED];
      case 'pve-blue': return [LC.BLUE];
      case 'pvp': return [LC.RED, LC.BLUE];
      default: return [];
    }
  }
  const isHumanTurn = () => humanPlayers().includes(state.current);

  // ---------- Elementos ----------
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const laserLayer = $('laserLayer');
  const fxLayer = $('fxLayer');
  const turnDot = $('turnDot');
  const turnLabel = $('turnLabel');
  const statusMsg = $('statusMsg');
  const historyEl = $('history');
  const thinkingEl = $('thinking');
  const rotBar = $('rotateBar');

  // ---------- Piezas en SVG ----------
  function pieceSVG(p) {
    const cls = p.owner === LC.RED ? 'p-red' : 'p-blue';
    let body = '';

    if (p.type === LC.PHARAOH) {
      body = `
        <path class="fill" d="M50 12 L88 82 L12 82 Z"/>
        <path class="line" d="M50 12 L88 82 L12 82 Z" fill="none"/>
        <circle class="eye" cx="50" cy="58" r="9"/>
        <circle class="pupil" cx="50" cy="58" r="4"/>`;
    } else if (p.type === LC.SPHINX) {
      body = `
        <g transform="rotate(${90 * p.dir} 50 50)">
          <circle class="ring" cx="50" cy="56" r="24" fill="none"/>
          <circle class="fill" cx="50" cy="56" r="16"/>
          <rect class="fill" x="43" y="6" width="14" height="34" rx="5"/>
          <rect class="hot" x="47" y="6" width="6" height="14" rx="3"/>
        </g>`;
    } else if (p.type === LC.TRIANGLE) {
      body = `
        <g transform="rotate(${90 * p.corner} 50 50)">
          <path class="fill" d="M16 16 L84 16 L16 84 Z"/>
          <path class="mirror-face" d="M84 16 L16 84" fill="none"/>
        </g>`;
    } else if (p.type === LC.BLOCK) {
      body = `
        <rect class="fill" x="18" y="18" width="64" height="64" rx="9"/>
        <rect class="line" x="18" y="18" width="64" height="64" rx="9" fill="none"/>
        <path class="line" d="M32 38 H68 M32 50 H68 M32 62 H68" fill="none"/>`;
    } else { // MIRROR
      const angle = p.form === LC.SLASH ? 45 : -45;
      body = `
        <g transform="rotate(${angle} 50 50)">
          <rect class="fill" x="42" y="6" width="16" height="88" rx="8"/>
          <rect class="mirror-face" x="46" y="12" width="3.5" height="76" rx="2"/>
          <rect class="mirror-face" x="52" y="12" width="3.5" height="76" rx="2"/>
        </g>`;
    }
    return `<svg class="piece ${cls}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  }

  // ---------- Tablero ----------
  const cells = [];
  function buildBoard() {
    for (let r = 0; r < LC.ROWS; r++) {
      for (let c = 0; c < LC.COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (((r + c) % 2) ? ' alt' : '');
        const i = LC.idx(r, c);
        if (LC.ONLY_RED.has(i)) cell.classList.add('zone-red');
        if (LC.ONLY_BLUE.has(i)) cell.classList.add('zone-blue');
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.title = `(${r},${c})`;
        cell.addEventListener('click', () => onCellClick(r, c));
        boardEl.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  function render() {
    for (let i = 0; i < cells.length; i++) {
      const p = state.board[i];
      cells[i].innerHTML = p ? pieceSVG(p) : '';
      cells[i].classList.remove('sel', 't-move', 't-swap');
    }
    if (selected) {
      cells[LC.idx(selected[0], selected[1])].classList.add('sel');
      for (const a of selActions) {
        if (a.kind === 'move') cells[LC.idx(a.to[0], a.to[1])].classList.add('t-move');
        if (a.kind === 'swap') cells[LC.idx(a.to[0], a.to[1])].classList.add('t-swap');
      }
    }
    renderStatus();
    renderRotateBar();
  }

  function renderStatus() {
    const name = LC.PLAYER_NAME[state.current];
    const isRed = state.current === LC.RED;
    turnDot.className = 'dot ' + (isRed ? 'dot-red' : 'dot-blue');
    const who = humanPlayers().includes(state.current) ? '' : ' · IA';
    turnLabel.textContent = state.winner !== null
      ? `Gana ${LC.PLAYER_NAME[state.winner]}`
      : `Turno: ${name}${who}`;
    turnLabel.className = isRed ? 'txt-red' : 'txt-blue';
    if (state.winner !== null) turnLabel.className = state.winner === LC.RED ? 'txt-red' : 'txt-blue';
    statusMsg.textContent = state.message;
  }

  function renderRotateBar() {
    const rotL = $('rotL'), rotR = $('rotR'), rotHint = $('rotHint');
    const rots = selActions.filter((a) => a.kind === 'rotate');
    rotL.disabled = !rots.some((a) => a.side === -1);
    rotR.disabled = !rots.some((a) => a.side === 1);
    if (!selected) {
      rotHint.textContent = 'Selecciona una pieza';
    } else if (rots.length === 0) {
      rotHint.textContent = 'Esta pieza no rota';
    } else {
      const p = state.board[LC.idx(selected[0], selected[1])];
      rotHint.textContent = `Rotar ${LC.TYPE_NAME[p.type]}`;
    }
    rotBar.classList.toggle('active', rots.length > 0);
  }

  // ---------- Interacción ----------
  function onCellClick(r, c) {
    if (busy || state.winner !== null || !isHumanTurn()) return;

    if (selected) {
      const action = selActions.find((a) =>
        (a.kind === 'move' || a.kind === 'swap') && a.to[0] === r && a.to[1] === c);
      if (action) { perform(action); return; }
    }

    const p = state.board[LC.idx(r, c)];
    if (p && p.owner === state.current) {
      if (selected && selected[0] === r && selected[1] === c) {
        deselect();
      } else {
        selected = [r, c];
        const all = LC.legalActions(state);
        selActions = all.filter((a) => {
          const at = a.kind === 'rotate' ? a.at : a.from;
          return at[0] === r && at[1] === c;
        });
        sfx.click();
      }
    } else {
      deselect();
    }
    render();
  }

  function deselect() {
    selected = null;
    selActions = [];
  }

  function rotateSelected(side) {
    if (busy || !selected) return;
    const action = selActions.find((a) => a.kind === 'rotate' && a.side === side);
    if (action) perform(action);
  }

  // ---------- Ejecución de jugadas ----------
  function perform(action) {
    busy = true;
    const id = gameId;
    const mover = state.current;
    const res = LC.applyAction(state, action);

    past.push(state);
    logEntries.push({ player: mover, notation: res.notation, result: res.state.message });

    deselect();
    render(); // muestra la pieza ya movida/rotada antes de disparar

    // Repinta con el estado ANTERIOR del láser: la pieza destruida debe
    // verse mientras el rayo la alcanza
    const preBoard = state.board.slice();
    if (action.kind === 'move') {
      preBoard[LC.idx(action.to[0], action.to[1])] = preBoard[LC.idx(action.from[0], action.from[1])];
      preBoard[LC.idx(action.from[0], action.from[1])] = null;
    } else if (action.kind === 'rotate') {
      const i = LC.idx(action.at[0], action.at[1]);
      preBoard[i] = LC.rotatePiece(preBoard[i], action.side);
    } else if (action.kind === 'swap') {
      const i = LC.idx(action.from[0], action.from[1]);
      const j = LC.idx(action.to[0], action.to[1]);
      const tmp = preBoard[i]; preBoard[i] = preBoard[j]; preBoard[j] = tmp;
    }
    for (let i = 0; i < cells.length; i++) {
      const p = preBoard[i];
      cells[i].innerHTML = p ? pieceSVG(p) : '';
    }

    sfx.zap();
    animateLaser(res.laser, mover, () => {
      if (id !== gameId) return;
      state = res.state;
      renderLog();
      render();

      if (state.winner !== null) {
        sfx.win();
        showWinner();
        busy = false;
        return;
      }
      busy = false;
      maybeAI();
    });
  }

  function maybeAI() {
    if (state.winner !== null || isHumanTurn()) return;
    busy = true;
    thinkingEl.classList.add('active');
    const id = gameId;
    const delay = settings.mode === 'ai' ? 650 : 320;
    setTimeout(() => {
      if (id !== gameId) return;
      const action = AI.chooseAction(state, settings.level);
      thinkingEl.classList.remove('active');
      if (!action) { busy = false; return; }
      busy = false;
      perform(action);
    }, delay);
  }

  // ---------- Animación del láser ----------
  function animateLaser(laser, shooter, done) {
    if (!laser.points || laser.points.length < 2) { done(); return; }

    const pts = laser.points
      .map(([r, c]) => `${c * CELL + CELL / 2},${r * CELL + CELL / 2}`)
      .join(' ');
    const color = shooter === LC.RED ? 'var(--red)' : 'var(--blue)';

    const mk = (cls, w) => {
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', pts);
      pl.setAttribute('class', cls);
      pl.style.stroke = color;
      pl.style.strokeWidth = w;
      laserLayer.appendChild(pl);
      return pl;
    };
    const glow = mk('beam beam-glow', 14);
    const core = mk('beam beam-core', 4);

    const len = core.getTotalLength();
    for (const pl of [glow, core]) {
      pl.style.strokeDasharray = len;
      pl.style.strokeDashoffset = len;
    }
    // forzar reflow para que la transición arranque desde offset=len
    core.getBoundingClientRect();
    const dur = Math.max(0.35, Math.min(1.1, len / 1400));
    for (const pl of [glow, core]) {
      pl.style.transition = `stroke-dashoffset ${dur}s linear`;
      pl.style.strokeDashoffset = '0';
    }

    const id = gameId;
    setTimeout(() => {
      if (id !== gameId) { laserLayer.innerHTML = ''; return; }
      const ev = laser.event;
      if (ev.type === 'destruccion' || ev.type === 'faraon') {
        explode(ev.at[0], ev.at[1], shooter);
        sfx.boom();
      }
      setTimeout(() => {
        if (id !== gameId) { laserLayer.innerHTML = ''; return; }
        for (const pl of [glow, core]) {
          pl.style.transition = 'opacity .3s';
          pl.style.opacity = '0';
        }
        setTimeout(() => {
          glow.remove(); core.remove();
          if (id === gameId) done();
        }, 300);
      }, 380);
    }, dur * 1000);
  }

  function explode(r, c, shooter) {
    const b = document.createElement('div');
    b.className = 'boom ' + (shooter === LC.RED ? 'boom-red' : 'boom-blue');
    b.style.left = `${(c + 0.5) * 10}%`;
    b.style.top = `${(r + 0.5) * 12.5}%`;
    fxLayer.appendChild(b);
    setTimeout(() => b.remove(), 700);
  }

  // ---------- Historial ----------
  function renderLog() {
    historyEl.innerHTML = '';
    logEntries.forEach((e, i) => {
      const li = document.createElement('li');
      const who = document.createElement('span');
      who.className = e.player === LC.RED ? 'txt-red' : 'txt-blue';
      who.textContent = LC.PLAYER_NAME[e.player];
      li.append(`${i + 1}. `, who, ` ${e.notation}`);
      historyEl.appendChild(li);
    });
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  // ---------- Controles ----------
  function newGame() {
    gameId++;
    state = LC.initialState();
    past = [];
    logEntries = [];
    busy = false;
    deselect();
    laserLayer.innerHTML = '';
    fxLayer.innerHTML = '';
    thinkingEl.classList.remove('active');
    $('winModal').classList.remove('open');
    renderLog();
    render();
    maybeAI();
  }

  function undo() {
    if (busy || past.length === 0) return;
    gameId++;
    const humans = humanPlayers();
    do {
      state = past.pop();
      logEntries.pop();
    } while (past.length > 0 && humans.length === 1 && !humans.includes(state.current));
    deselect();
    laserLayer.innerHTML = '';
    $('winModal').classList.remove('open');
    renderLog();
    render();
  }

  function showWinner() {
    const name = LC.PLAYER_NAME[state.winner];
    const isRed = state.winner === LC.RED;
    $('winTitle').textContent = `¡Gana ${name}!`;
    $('winTitle').className = isRed ? 'txt-red' : 'txt-blue';
    $('winDetail').textContent = `${state.message} · ${logEntries.length} jugadas`;
    $('winModal').classList.add('open');
  }

  // ---------- Sonido (WebAudio, sin archivos) ----------
  const sfx = (() => {
    let ctx = null;
    const ac = () => {
      if (!settings.sound) return null;
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const env = (c, node, t, dur, vol) => {
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      node.connect(g).connect(c.destination);
    };
    return {
      click() {
        const c = ac(); if (!c) return;
        const o = c.createOscillator();
        o.type = 'sine'; o.frequency.value = 660;
        env(c, o, c.currentTime, 0.07, 0.08);
        o.start(); o.stop(c.currentTime + 0.07);
      },
      zap() {
        const c = ac(); if (!c) return;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(950, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(160, c.currentTime + 0.22);
        env(c, o, c.currentTime, 0.24, 0.12);
        o.start(); o.stop(c.currentTime + 0.25);
      },
      boom() {
        const c = ac(); if (!c) return;
        const dur = 0.35;
        const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = c.createBufferSource();
        src.buffer = buf;
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 700;
        src.connect(f);
        env(c, f, c.currentTime, dur, 0.3);
        src.start();
      },
      win() {
        const c = ac(); if (!c) return;
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = c.createOscillator();
          o.type = 'triangle'; o.frequency.value = freq;
          const t = c.currentTime + i * 0.13;
          env(c, o, t, 0.4, 0.12);
          o.start(t); o.stop(t + 0.4);
        });
      },
    };
  })();

  // ---------- Ayuda ----------
  function buildHelp() {
    const rows = [
      [LC.piece(LC.RED, LC.PHARAOH), 'Faraón', 'El objetivo. Se mueve pero no rota. Si el láser lo alcanza, su dueño pierde.'],
      [LC.piece(LC.RED, LC.SPHINX, { dir: LC.S }), 'Esfinge', 'Dispara el láser al final de cada turno. Rota, pero no se mueve ni puede ser destruida.'],
      [LC.piece(LC.RED, LC.TRIANGLE), 'Triángulo', 'Refleja el láser con su cara espejada (la diagonal brillante). Si el rayo llega por otra cara, se destruye.'],
      [LC.piece(LC.RED, LC.BLOCK), 'Bloque', 'Absorbe el láser pero queda destruido. No rota.'],
      [LC.piece(LC.RED, LC.MIRROR), 'Espejo Doble', 'Refleja el láser por ambas caras: es indestructible. Puede intercambiar posición con un Triángulo o Bloque adyacente.'],
    ];
    const tbody = $('helpPieces');
    tbody.innerHTML = rows.map(([p, name, desc]) => `
      <tr>
        <td class="help-icon">${pieceSVG(p)}</td>
        <td><strong>${name}</strong></td>
        <td>${desc}</td>
      </tr>`).join('');
  }

  // ---------- Inicio ----------
  function bind() {
    $('newGame').addEventListener('click', () => { sfx.click(); newGame(); });
    $('undoBtn').addEventListener('click', () => { sfx.click(); undo(); });
    $('rotL').addEventListener('click', () => rotateSelected(-1));
    $('rotR').addEventListener('click', () => rotateSelected(1));

    const modeSel = $('modeSel'), levelSel = $('levelSel');
    modeSel.value = settings.mode;
    levelSel.value = settings.level;
    modeSel.addEventListener('change', () => {
      settings.mode = modeSel.value; saveSettings(); newGame();
    });
    levelSel.addEventListener('change', () => {
      settings.level = levelSel.value; saveSettings();
    });

    const soundBtn = $('soundBtn');
    const paintSound = () => { soundBtn.textContent = settings.sound ? 'Sonido: Sí' : 'Sonido: No'; };
    paintSound();
    soundBtn.addEventListener('click', () => {
      settings.sound = !settings.sound; saveSettings(); paintSound(); sfx.click();
    });

    $('helpBtn').addEventListener('click', () => $('helpModal').classList.add('open'));
    $('replayBtn').addEventListener('click', () => { sfx.click(); newGame(); });
    document.querySelectorAll('[data-close]').forEach((el) =>
      el.addEventListener('click', () => el.closest('.modal').classList.remove('open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
        deselect(); render();
      }
    });
  }

  buildBoard();
  buildHelp();
  bind();
  render();
  maybeAI();
})();
