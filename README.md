# Laser Chess

Turn-based strategy game inspired by **Khet**: move and rotate mirrors so your laser
reaches the enemy **Pharaoh**. Play against the **AI (minimax with alpha-beta pruning)**
or against a friend, right in the browser — **no dependencies, no install**.

> **Demo:** https://criscarr26.github.io/laser-chess/

![Status](https://img.shields.io/badge/status-playable-brightgreen)
![Made with](https://img.shields.io/badge/JavaScript-vanilla-yellow)
![AI](https://img.shields.io/badge/AI-minimax%20%2B%20alpha--beta-blueviolet)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## How to play

Each turn you take **one** action, and at the end **your Sphinx fires the laser automatically**:

| Action | How |
|---|---|
| **Move** | Click your piece → click an adjacent empty square (diagonals included) |
| **Rotate** | Click your piece → ⟲ / ⟳ buttons (rotates 90°) |
| **Swap** | With the Double Mirror: click it → click an adjacent Triangle or Block |

### The pieces

| Piece | Role |
|---|---|
| **Pharaoh** | The target. Moves but doesn't rotate. If a laser reaches it, its owner loses. |
| **Sphinx** | Fires the laser. Rotates (never off the board) but doesn't move or get destroyed. |
| **Triangle** | Reflects the laser with its mirrored face (the bright diagonal). Hit on another face, it's destroyed. |
| **Block** | Absorbs the laser but is destroyed. Doesn't rotate. |
| **Double Mirror** | Reflects on both faces — indestructible. Can swap position with adjacent Triangles and Blocks. |

The red/blue **tinted squares** are exclusive: only pieces of that color may enter.

### Game modes

- **Human vs AI** (as Red or Blue) with 3 difficulties
- **2 players** on the same device
- **AI vs AI** — demo mode to watch the two AIs face off

## Run locally

No build, no dependencies. Any of these options:

```bash
# Option 1: open directly
#   double-click index.html

# Option 2: local server
python -m http.server 8000
# → http://localhost:8000
```

The original **console version** in Python is also included:

```bash
python laser_chess.py
```

## The AI

The AI lives in [`js/ai.js`](js/ai.js) and uses **minimax with alpha-beta pruning**:

- **Evaluation function**: material (living triangles and blocks) + laser-threat analysis —
  it simulates both players' shots on the current board and rewards/penalizes based on what
  each beam would reach.
- **Move ordering**: children are explored from best to worst immediate evaluation,
  which maximizes pruning cutoffs.
- **Difficulties**: Easy (depth 1 + randomness), Medium (depth 2), Hard (depth 3).

## Structure

```
├── index.html          # Game page
├── css/style.css       # Neon theme, board, animations
├── js/
│   ├── engine.js       # Pure rules engine (no DOM) — testable and reusable
│   ├── ai.js           # Minimax + alpha-beta pruning
│   └── ui.js           # Rendering, interaction, laser animation, WebAudio sound
├── tests/
│   └── engine.test.js  # Engine tests (node --test)
├── docs/GDD.md         # Game Design Document
└── laser_chess.py      # Original console version (Python)
```

## Tests

With [Node.js](https://nodejs.org) installed:

```bash
node --test tests/engine.test.js
```

They cover: laser physics (reflections, destruction, absorption), movement and rotation rules,
exclusive zones, Double Mirror swapping, win conditions and AI sanity.

## Deploy to GitHub Pages

1. Push the repo to GitHub
2. **Settings → Pages → Source: Deploy from a branch → `main` / root**
3. In a minute the game is live at `https://<your-username>.github.io/<your-repo>/`

## Design notes

- **Rule fixed relative to the console version**: in `laser_chess.py`, the shooter won
  if the laser reached *any* Pharaoh (even their own). Here the standard Khet rule applies:
  **the owner of the Pharaoh that gets hit loses** — shooting yourself costs you the game.
- The Double Mirror swap works with Triangles and Blocks **of any color**
  (like the scarab in Khet 2.0).
- The engine (`engine.js`) is immutable: each action returns a new state, which makes
  "undo" and the minimax search trivial.

## License

[MIT](LICENSE)
