# GDD — Laser Chess (versión web)

## 1. Concepto

- **Elevator pitch:** ajedrez con láseres — coloca y rota espejos para que tu rayo alcance al
  Faraón enemigo antes de que el suyo alcance al tuyo.
- **Género:** estrategia por turnos / puzzle táctico, 1-2 jugadores.
- **Referencia principal:** Khet 2.0 (juego de mesa) y la versión de consola propia
  (`laser_chess.py`).

## 2. Core Gameplay Loop

**Acción** (mover / rotar / intercambiar una pieza) → **disparo automático del láser** →
**consecuencia** (reflexión, destrucción o victoria) → **turno del rival**.

Cada acción re-dibuja la geometría de los rayos: el tablero completo es un puzzle de líneas
de fuego que cambia una pieza a la vez.

## 3. Mecánicas principales

1. **Movimiento:** una casilla en cualquiera de las 8 direcciones, a casilla vacía.
2. **Rotación:** 90° por turno (izquierda o derecha).
3. **Láser:** viaja en línea recta; los espejos lo desvían 90°. Se resuelve al final de cada
   acción, disparado por la Esfinge del jugador que actuó.
4. **Intercambio:** el Espejo Doble puede permutar su posición con un Triángulo o Bloque
   adyacente (de cualquier color) — es la mecánica de tempo del juego.
5. **Zonas exclusivas:** columnas/casillas reservadas por color que limitan invasiones.

## 4. Entidades

| Pieza | Mueve | Rota | Destruible | Rol |
|---|---|---|---|---|
| Faraón | Sí | No | Sí (derrota) | Rey |
| Esfinge | No | Sí (solo hacia dentro) | No | Cañón láser |
| Triángulo | Sí | Sí | Sí (por caras no espejadas) | Espejo direccional |
| Bloque | Sí | No | Sí | Escudo sacrificable |
| Espejo Doble | Sí + intercambio | Sí (alterna / y \) | No | Espejo total / comodín |

## 5. Condiciones de fin

- **Victoria:** el láser (de cualquier jugador) alcanza al Faraón **enemigo**.
- **Derrota:** tu propio Faraón es alcanzado — incluso por tu propio láser
  (regla estándar de Khet; corrige la versión de consola).

## 6. Estados de juego

`CONFIGURACIÓN (modo/dificultad) → JUGANDO → ANIMACIÓN LÁSER → [VICTORIA] → REVANCHA`

## 7. UI / UX

- Tablero 10×8 con casillas alternadas y zonas exclusivas tintadas.
- Selección con resaltado dorado; puntos = destinos legales; ⇄ = intercambios.
- Rayo láser animado (SVG con `stroke-dashoffset`) del color del tirador, con explosión
  en el punto de impacto.
- Panel lateral: turno, mensaje de estado, historial de jugadas, controles.
- Sonido procedural con WebAudio (zap, explosión, fanfarria) — sin archivos de audio.
- Modal de reglas con las piezas renderizadas en vivo.

## 8. Estilo visual

- **Tema:** neón oscuro (azul profundo `#0b1020`, rojo `#ff4d5a`, cian `#22d3ee`, dorado de
  selección `#ffd166`).
- **Tipografías:** Orbitron (títulos), Rajdhani (interfaz).
- **Piezas:** SVG vectorial inline — el Triángulo muestra su cara espejada como una diagonal
  brillante, para que la orientación se lea de un vistazo.

## 9. Arquitectura técnica

- **Stack:** HTML + CSS + JavaScript vanilla. Sin build, sin dependencias → publicable en
  GitHub Pages tal cual.
- **Patrón:** separación estricta en 3 capas:
  - `engine.js` — reglas puras e inmutables (estado → acción → estado nuevo). Sin DOM.
  - `ai.js` — minimax + poda alfa-beta sobre el motor.
  - `ui.js` — render, input, animaciones y sonido. Única capa que toca el DOM.
- **Inmutabilidad:** el tablero se clona por acción (piezas inmutables → clonado barato con
  `slice()`), lo que da deshacer gratis y búsqueda de IA sin efectos secundarios.

## 10. IA

- Minimax con poda alfa-beta, profundidad 1-3 según dificultad.
- Evaluación: material + simulación del láser de ambos bandos (amenazas reales del tablero).
- Ordenamiento de hijos por evaluación rápida para maximizar cortes.
- `epsilon` de aleatoriedad en niveles bajos para variedad de partidas.

## 11. Roadmap

- [x] **Etapa 1 — MVP:** motor portado + tablero jugable 2 jugadores
- [x] **Etapa 2 — Mecánicas completas:** láser animado, intercambio, zonas, deshacer
- [x] **Etapa 3 — IA:** minimax 3 niveles + modo demo IA vs IA
- [x] **Etapa 4 — Pulido:** sonido, modales, responsive, historial
- [ ] **Futuro:** multijugador online (WebSockets), configuraciones de tablero alternativas
      (Classic / Imhotep / Dynasty), ranking Elo local, PWA instalable
