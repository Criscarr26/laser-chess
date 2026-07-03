# Laser Chess

Juego de estrategia por turnos inspirado en **Khet**: mueve y rota espejos para que tu láser
alcance al **Faraón** enemigo. Juega contra la **IA (minimax con poda alfa-beta)** o contra un
amigo, directamente en el navegador — **sin dependencias ni instalación**.

> 🎮 **Demo:** publícalo con GitHub Pages y el juego queda en vivo en
> `https://<tu-usuario>.github.io/<tu-repo>/`

![Estado](https://img.shields.io/badge/estado-jugable-brightgreen)
![Hecho con](https://img.shields.io/badge/JavaScript-vanilla-yellow)
![IA](https://img.shields.io/badge/IA-minimax%20%2B%20alfa--beta-blueviolet)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)

---

## 🕹️ Cómo jugar

Cada turno haces **una** acción y al terminar **tu Esfinge dispara el láser automáticamente**:

| Acción | Cómo |
|---|---|
| **Mover** | Clic en tu pieza → clic en una casilla adyacente vacía (incluye diagonales) |
| **Rotar** | Clic en tu pieza → botones ⟲ / ⟳ (gira 90°) |
| **Intercambiar** | Con el Espejo Doble: clic en él → clic en un Triángulo o Bloque adyacente |

### Las piezas

| Pieza | Rol |
|---|---|
| **Faraón** 🔺 | El objetivo. Se mueve pero no rota. Si un láser lo alcanza, su dueño pierde. |
| **Esfinge** 🔫 | Dispara el láser. Rota (nunca hacia fuera del tablero) pero no se mueve ni se destruye. |
| **Triángulo** 📐 | Refleja el láser con su cara espejada (la diagonal brillante). Golpeado por otra cara, se destruye. |
| **Bloque** 🧱 | Absorbe el láser pero queda destruido. No rota. |
| **Espejo Doble** 🪞 | Refleja por ambas caras — indestructible. Puede intercambiar posición con Triángulos y Bloques adyacentes. |

Las **casillas tintadas** de rojo/azul son exclusivas: solo piezas de ese color pueden entrar.

### Modos de juego

- 🧍 **Humano vs IA** (como Rojo o como Azul) con 3 dificultades
- 🧑‍🤝‍🧑 **2 jugadores** en el mismo dispositivo
- 🤖 **IA vs IA** — modo demo para ver a las dos IAs enfrentarse

## 🚀 Ejecutar localmente

No hay build ni dependencias. Cualquiera de estas opciones:

```bash
# Opción 1: abrir directamente
#   doble clic en index.html

# Opción 2: servidor local
python -m http.server 8000
# → http://localhost:8000
```

También se incluye la **versión original de consola** en Python:

```bash
python laser_chess.py
```

## 🧠 La IA

La IA está en [`js/ai.js`](js/ai.js) y usa **minimax con poda alfa-beta**:

- **Función de evaluación**: material (triángulos y bloques vivos) + análisis de amenaza láser —
  simula el disparo de ambos jugadores sobre el tablero actual y premia/penaliza según qué
  alcanzaría cada rayo.
- **Ordenamiento de movimientos**: los hijos se exploran de mejor a peor evaluación inmediata,
  lo que maximiza los cortes de la poda.
- **Dificultades**: Fácil (profundidad 1 + aleatoriedad), Medio (profundidad 2), Difícil (profundidad 3).

## 📁 Estructura

```
├── index.html          # Página del juego
├── css/style.css       # Tema neón, tablero, animaciones
├── js/
│   ├── engine.js       # Motor de reglas puro (sin DOM) — testeable y reutilizable
│   ├── ai.js           # Minimax + poda alfa-beta
│   └── ui.js           # Render, interacción, animación del láser, sonido WebAudio
├── tests/
│   └── engine.test.js  # Tests del motor (node --test)
├── docs/GDD.md         # Game Design Document
└── laser_chess.py      # Versión original de consola (Python)
```

## ✅ Tests

Con [Node.js](https://nodejs.org) instalado:

```bash
node --test tests/
```

Cubren: física del láser (reflexiones, destrucción, absorción), reglas de movimiento y rotación,
zonas exclusivas, intercambio del Espejo Doble, condiciones de victoria y sanidad de la IA.

## 🌐 Publicar en GitHub Pages

1. Sube el repo a GitHub
2. **Settings → Pages → Source: Deploy from a branch → `main` / root**
3. En un minuto el juego queda en vivo en `https://<tu-usuario>.github.io/<tu-repo>/`

## 📝 Notas de diseño

- **Regla corregida respecto a la versión de consola**: en `laser_chess.py`, quien disparaba
  ganaba si el láser alcanzaba *cualquier* Faraón (incluso el propio). Aquí se aplica la regla
  estándar de Khet: **pierde el dueño del Faraón alcanzado** — dispararte a ti mismo te cuesta
  la partida.
- El intercambio del Espejo Doble funciona con Triángulos y Bloques **de cualquier color**
  (igual que el escarabajo en Khet 2.0).
- El motor (`engine.js`) es inmutable: cada acción devuelve un estado nuevo, lo que hace
  trivial el "deshacer" y la búsqueda minimax.

## 📄 Licencia

[MIT](LICENSE)
