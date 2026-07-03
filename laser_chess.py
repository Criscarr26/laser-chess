from dataclasses import dataclass
from enum import Enum
import re
import os

FILAS = 8
COLUMNAS = 10

class Color:
    ROJO = '\033[91m'
    AZUL = '\033[96m'
    GRIS = '\033[90m'
    RESET = '\033[0m'
    BLANCO = '\033[97m'
    AMARILLO = '\033[93m'
    VERDE = '\033[92m'

class Jugador(str, Enum):
    ROJO = 'ROJO'
    AZUL = 'AZUL'
    @property
    def contrincante(self):
        return Jugador.AZUL if self == Jugador.ROJO else Jugador.ROJO
    @property
    def color(self):
        return Color.ROJO if self == Jugador.ROJO else Color.AZUL

class Direccion(int, Enum):
    NORTE = 0
    ESTE = 1
    SUR = 2
    OESTE = 3
    def gira_izq(self):
        return Direccion((int(self) - 1) % 4)
    def gira_der(self):
        return Direccion((int(self) + 1) % 4)
    @property
    def delta(self):
        return {Direccion.NORTE: (-1, 0), Direccion.ESTE: (0, 1), Direccion.SUR: (1, 0), Direccion.OESTE: (0, -1)}[self]
    @property
    def nombre(self):
        return {Direccion.NORTE: 'N', Direccion.ESTE: 'E', Direccion.SUR: 'S', Direccion.OESTE: 'O'}[self]

class Esquina(str, Enum):
    NO = 'NO'
    NE = 'NE'
    SE = 'SE'
    SO = 'SO'
    @property
    def diagonal(self):
        return '/' if self in (Esquina.NO, Esquina.SE) else '\\'
    def gira_izq(self):
        orden = [Esquina.NO, Esquina.NE, Esquina.SE, Esquina.SO]
        return orden[(orden.index(self) - 1) % 4]
    def gira_der(self):
        orden = [Esquina.NO, Esquina.NE, Esquina.SE, Esquina.SO]
        return orden[(orden.index(self) + 1) % 4]

class TipoPieza(str, Enum):
    FARAON = 'K'
    ESFINGE = 'S'
    TRIANGULO = 'T'
    BLOQUE = 'B'
    ESPEJO_DOBLE = 'M'

SYMBOLS = {
    TipoPieza.FARAON: '♛',
    TipoPieza.ESFINGE: '◉',
    TipoPieza.TRIANGULO: '▲',
    TipoPieza.BLOQUE: '█',
    TipoPieza.ESPEJO_DOBLE: '▬',
}

RANGO = {TipoPieza.TRIANGULO: 1, TipoPieza.BLOQUE: 2, TipoPieza.FARAON: 3, TipoPieza.ESPEJO_DOBLE: 4, TipoPieza.ESFINGE: 5}
CASILLAS_SOLO_ROJO = {(0, 8), (7, 8), *{(r, 0) for r in range(1, 8)}}
CASILLAS_SOLO_AZUL = {(0, 1), (7, 1), *{(r, 9) for r in range(0, 7)}}

@dataclass(frozen=True)
class Pieza:
    dueno: Jugador
    tipo: TipoPieza
    direccion: Direccion = Direccion.NORTE
    forma_espejo: str = '/'
    esquina: Esquina = Esquina.NO

    def simbolo(self):
        sym = SYMBOLS[self.tipo]
        if self.tipo == TipoPieza.ESFINGE:
            dir_arrows = {Direccion.NORTE: '⇑', Direccion.ESTE: '⇒', Direccion.SUR: '⇓', Direccion.OESTE: '⇐'}
            return dir_arrows.get(self.direccion, sym)
        if self.tipo == TipoPieza.TRIANGULO:
            esquina_arrows = {Esquina.NO: '◤', Esquina.NE: '◥', Esquina.SE: '◢', Esquina.SO: '◣'}
            return esquina_arrows.get(self.esquina, sym)
        if self.tipo == TipoPieza.ESPEJO_DOBLE:
            return '╱' if self.forma_espejo == '/' else '╲'
        return sym

    def puede_moverse(self):
        return self.tipo != TipoPieza.ESFINGE

    def puede_rotar(self):
        return self.tipo in {TipoPieza.ESFINGE, TipoPieza.TRIANGULO, TipoPieza.ESPEJO_DOBLE}

    def rota(self, lado: str):
        if lado.upper() not in {'I', 'D'}:
            raise ValueError('I o D')
        if not self.puede_rotar():
            raise ValueError('Esta pieza no puede rotar')
        if self.tipo == TipoPieza.ESFINGE:
            nueva_dir = self.direccion.gira_izq() if lado.upper() == 'I' else self.direccion.gira_der()
            return Pieza(self.dueno, self.tipo, nueva_dir, self.forma_espejo, self.esquina)
        if self.tipo == TipoPieza.TRIANGULO:
            nueva_esquina = self.esquina.gira_izq() if lado.upper() == 'I' else self.esquina.gira_der()
            return Pieza(self.dueno, self.tipo, self.direccion, nueva_esquina.diagonal, nueva_esquina)
        nueva_forma = '\\' if self.forma_espejo == '/' else '/'
        return Pieza(self.dueno, self.tipo, self.direccion, nueva_forma, self.esquina)


class JuegoLaserChess:
    def __init__(self):
        self.tablero = [[None for _ in range(COLUMNAS)] for _ in range(FILAS)]
        self.jugador_actual = Jugador.ROJO
        self.ganador = None
        self.ultimo_mensaje = 'Turno de ROJO - Mueve o rota una pieza'
        self.historial = []
        self._setup()

    def _setup(self):
        posiciones = {
            (0, 0): Pieza(Jugador.ROJO, TipoPieza.ESFINGE, Direccion.SUR),
            (0, 4): Pieza(Jugador.ROJO, TipoPieza.BLOQUE),
            (0, 5): Pieza(Jugador.ROJO, TipoPieza.FARAON),
            (0, 6): Pieza(Jugador.ROJO, TipoPieza.BLOQUE),
            (0, 7): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.NO, forma_espejo=Esquina.NO.diagonal),
            (1, 2): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.NE, forma_espejo=Esquina.NE.diagonal),
            (3, 0): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.SO, forma_espejo=Esquina.SO.diagonal),
            (3, 4): Pieza(Jugador.ROJO, TipoPieza.ESPEJO_DOBLE, forma_espejo='\\'),
            (3, 5): Pieza(Jugador.ROJO, TipoPieza.ESPEJO_DOBLE, forma_espejo='/'),
            (3, 7): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.NO, forma_espejo=Esquina.NO.diagonal),
            (4, 0): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.NO, forma_espejo=Esquina.NO.diagonal),
            (4, 7): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.SO, forma_espejo=Esquina.SO.diagonal),
            (5, 6): Pieza(Jugador.ROJO, TipoPieza.TRIANGULO, esquina=Esquina.NO, forma_espejo=Esquina.NO.diagonal),
            (2, 3): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.SE, forma_espejo=Esquina.SE.diagonal),
            (3, 2): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.NE, forma_espejo=Esquina.NE.diagonal),
            (3, 9): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.SE, forma_espejo=Esquina.SE.diagonal),
            (4, 2): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.SE, forma_espejo=Esquina.SE.diagonal),
            (4, 4): Pieza(Jugador.AZUL, TipoPieza.ESPEJO_DOBLE, forma_espejo='/'),
            (4, 5): Pieza(Jugador.AZUL, TipoPieza.ESPEJO_DOBLE, forma_espejo='\\'),
            (4, 9): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.NE, forma_espejo=Esquina.NE.diagonal),
            (6, 7): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.SO, forma_espejo=Esquina.SO.diagonal),
            (7, 2): Pieza(Jugador.AZUL, TipoPieza.TRIANGULO, esquina=Esquina.SE, forma_espejo=Esquina.SE.diagonal),
            (7, 3): Pieza(Jugador.AZUL, TipoPieza.BLOQUE),
            (7, 4): Pieza(Jugador.AZUL, TipoPieza.FARAON),
            (7, 5): Pieza(Jugador.AZUL, TipoPieza.BLOQUE),
            (7, 9): Pieza(Jugador.AZUL, TipoPieza.ESFINGE, Direccion.NORTE),
        }
        for (f, c), p in posiciones.items():
            self.tablero[f][c] = p

    def _dentro(self, f, c):
        return 0 <= f < FILAS and 0 <= c < COLUMNAS

    def _puede_entrar(self, pieza, f, c):
        if pieza.dueno == Jugador.ROJO and (f, c) in CASILLAS_SOLO_AZUL:
            return False
        if pieza.dueno == Jugador.AZUL and (f, c) in CASILLAS_SOLO_ROJO:
            return False
        return True

    def _adyacentes(self, f, c):
        for df in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if df == 0 and dc == 0:
                    continue
                nf, nc = f + df, c + dc
                if self._dentro(nf, nc):
                    yield nf, nc

    def _es_adyacente(self, f1, c1, f2, c2):
        return abs(f1 - f2) <= 1 and abs(c1 - c2) <= 1 and (f1, c1) != (f2, c2)

    def muestra_tablero(self):
        limpiar_pantalla()
        title_width = COLUMNAS * 2 + 3
        iguales = '═' * title_width
        turno_str = f"TURNO: {self.jugador_actual.color}{self.jugador_actual.value}{Color.RESET}"
        print(f"\n{Color.BLANCO}╔{iguales}╗{Color.RESET}")
        print(f"{Color.BLANCO}║  ⚔  LASER CHESS  ⚔  {' ' * (title_width - 22)}║{Color.RESET}")
        print(f"{Color.BLANCO}║  {turno_str}{Color.BLANCO}{' ' * (title_width - 9 - len(self.jugador_actual.value))}║{Color.RESET}")
        msg = self.ultimo_mensaje[:title_width - 3]
        print(f"{Color.BLANCO}║  {msg:<{title_width - 2}} ║{Color.RESET}")
        print(f"{Color.BLANCO}╚{iguales}╝{Color.RESET}\n")

        header = f"{Color.GRIS}    " + "  ".join(str(i) for i in range(COLUMNAS)) + f"{Color.RESET}"
        print(header)
        borde = f"{Color.GRIS}   ╔" + "══" * COLUMNAS + f"╗{Color.RESET}"
        print(borde)

        for f in range(FILAS):
            fila = f"{Color.GRIS}{f} ║{Color.RESET}"
            for c in range(COLUMNAS):
                p = self.tablero[f][c]
                if p is None:
                    if (f, c) in CASILLAS_SOLO_ROJO:
                        fila += f"{Color.ROJO}▨ {Color.RESET}"
                    elif (f, c) in CASILLAS_SOLO_AZUL:
                        fila += f"{Color.AZUL}▨ {Color.RESET}"
                    else:
                        fila += f"{Color.GRIS}· {Color.RESET}"
                else:
                    fila += f"{p.dueno.color}{p.simbolo()} {Color.RESET}"
            fila += f"{Color.GRIS}║{Color.RESET}"
            print(fila)

        borde_bot = f"{Color.GRIS}   ╚" + "══" * COLUMNAS + f"╝{Color.RESET}"
        print(borde_bot)

        # Leyenda
        print(f"\n{Color.GRIS}Leyenda:{Color.RESET}")
        print(f"  {Color.ROJO}ROJO:{Color.RESET} ♛=Faraón  ⇓=Esfinge  ◤◥◣◢=Triángulo  █=Bloque  ╱╲=Espejo")
        print(f"  {Color.AZUL}AZUL:{Color.RESET} ♛=Faraón  ⇑=Esfinge  ◤◥◣◢=Triángulo  █=Bloque  ╱╲=Espejo")
        print(f"  {Color.GRIS}▨=Casilla exclusiva de color{Color.RESET}")

    def procesa_comando(self, cmd):
        cmd = cmd.strip().upper()
        if not cmd:
            raise ValueError('Comando vacío')
        if cmd == 'L':
            return self.muestra_legales()
        if cmd == 'A':
            return self.muestra_ayuda()
        if cmd == 'Q':
            raise KeyboardInterrupt()
        if cmd.startswith('I '):
            match = re.match(r"I\s+(\d+),(\d+)-(\d+),(\d+)", cmd)
            if not match:
                raise ValueError('Formato: I f,c-f,c')
            f, c, nf, nc = map(int, match.groups())
            return self.intercambiar(f, c, nf, nc)
        if cmd.startswith('R '):
            parts = cmd.split()
            if len(parts) < 3:
                raise ValueError('Formato: R f,c I/D')
            match = re.match(r"(\d+),(\d+)", parts[1])
            if not match:
                raise ValueError('Formato: R f,c I/D')
            f, c = map(int, match.groups())
            return self.rotar(f, c, parts[2])
        if '-' in cmd and ',' in cmd:
            match = re.match(r"(\d+),(\d+)-(\d+),(\d+)", cmd)
            if not match:
                raise ValueError('Formato: f,c-f,c')
            f, c, nf, nc = map(int, match.groups())
            return self.mover(f, c, nf, nc)
        raise ValueError('Comando desconocido. Escribe A para ayuda.')

    def mover(self, f, c, nf, nc):
        if self.ganador:
            raise ValueError('El juego ya terminó')
        if not self._dentro(f, c) or not self._dentro(nf, nc):
            raise ValueError('Posición fuera del tablero')
        p = self.tablero[f][c]
        if not p:
            raise ValueError(f'No hay pieza en ({f},{c})')
        if p.dueno != self.jugador_actual:
            raise ValueError(f'Esa pieza es de {p.dueno.value}, no tuya')
        if not p.puede_moverse():
            raise ValueError('La Esfinge no puede moverse')
        if self.tablero[nf][nc] is not None:
            raise ValueError('Esa casilla está ocupada')
        if not self._puede_entrar(p, nf, nc):
            raise ValueError('Casilla restringida al color contrario')
        if not self._es_adyacente(f, c, nf, nc):
            raise ValueError('Solo puedes mover a una casilla adyacente (incluye diagonal)')
        self.historial.append(f"MOVER ({f},{c})→({nf},{nc})")
        self.tablero[nf][nc] = p
        self.tablero[f][c] = None
        self._dispara_laser()

    def rotar(self, f, c, lado):
        if self.ganador:
            raise ValueError('El juego ya terminó')
        if not self._dentro(f, c):
            raise ValueError('Posición fuera del tablero')
        p = self.tablero[f][c]
        if not p:
            raise ValueError(f'No hay pieza en ({f},{c})')
        if p.dueno != self.jugador_actual:
            raise ValueError(f'Esa pieza es de {p.dueno.value}, no tuya')
        if not p.puede_rotar():
            raise ValueError('El Faraón y el Bloque no pueden rotar')
        if p.tipo == TipoPieza.ESFINGE:
            nueva_p = p.rota(lado)
            if not self._direccion_valida_esfinge(f, c, nueva_p.direccion):
                raise ValueError('La Esfinge no puede apuntar fuera del tablero')
        else:
            nueva_p = p.rota(lado)
        self.historial.append(f"ROTAR ({f},{c}) {lado}")
        self.tablero[f][c] = nueva_p
        self._dispara_laser()

    def _direccion_valida_esfinge(self, f, c, direccion):
        df, dc = direccion.delta
        return self._dentro(f + df, c + dc)

    def intercambiar(self, f, c, nf, nc):
        if self.ganador:
            raise ValueError('El juego ya terminó')
        if not self._dentro(f, c) or not self._dentro(nf, nc):
            raise ValueError('Posición fuera del tablero')
        p, q = self.tablero[f][c], self.tablero[nf][nc]
        if not p or p.dueno != self.jugador_actual:
            raise ValueError('No es tu pieza')
        if not q:
            raise ValueError('No hay pieza destino para intercambiar')
        if p.tipo != TipoPieza.ESPEJO_DOBLE:
            raise ValueError('Solo el Espejo Doble puede intercambiar')
        if q.tipo in (TipoPieza.FARAON, TipoPieza.ESFINGE):
            raise ValueError('No puedes intercambiar con Faraón o Esfinge')
        if RANGO[q.tipo] >= RANGO[p.tipo]:
            raise ValueError('Solo puedes intercambiar con una pieza de menor rango')
        if not self._puede_entrar(p, nf, nc) or not self._puede_entrar(q, f, c):
            raise ValueError('Intercambio restringido por zona de color')
        if not self._es_adyacente(f, c, nf, nc):
            raise ValueError('Solo puedes intercambiar con una pieza adyacente')
        self.historial.append(f"INTERCAMBIAR ({f},{c})↔({nf},{nc})")
        self.tablero[f][c], self.tablero[nf][nc] = q, p
        self._dispara_laser()

    def _dispara_laser(self):
        pos = self._busca_esfinge(self.jugador_actual)
        if not pos:
            self.ganador = self.jugador_actual.contrincante
            self.ultimo_mensaje = f'La Esfinge fue destruida — GANA {self.ganador.value}'
            return
        f, c = pos
        d = self.tablero[f][c].direccion
        f, c = f + d.delta[0], c + d.delta[1]
        while self._dentro(f, c):
            q = self.tablero[f][c]
            if q is None:
                f, c = f + d.delta[0], c + d.delta[1]
                continue
            if q.tipo == TipoPieza.TRIANGULO:
                if self._es_lado_espejo(d, q.esquina):
                    d = self._refleja(d, q.forma_espejo)
                else:
                    self.tablero[f][c] = None
                    self.ultimo_mensaje = f'Triángulo de {q.dueno.value} destruido — turno de {self.jugador_actual.contrincante.value}'
                    self.jugador_actual = self.jugador_actual.contrincante
                    return
                f, c = f + d.delta[0], c + d.delta[1]
                continue
            if q.tipo == TipoPieza.ESPEJO_DOBLE:
                d = self._refleja(d, q.forma_espejo)
                f, c = f + d.delta[0], c + d.delta[1]
                continue
            if q.tipo == TipoPieza.ESFINGE:
                self.ultimo_mensaje = f'Láser absorbido por la Esfinge — turno de {self.jugador_actual.contrincante.value}'
                self.jugador_actual = self.jugador_actual.contrincante
                return
            if q.tipo == TipoPieza.FARAON:
                self.ganador = self.jugador_actual
                self.ultimo_mensaje = f'¡FARAÓN DE {q.dueno.value} ALCANZADO! — GANA {self.ganador.value}'
                return
            if q.tipo == TipoPieza.BLOQUE:
                self.tablero[f][c] = None
                self.ultimo_mensaje = f'Bloque de {q.dueno.value} destruido — turno de {self.jugador_actual.contrincante.value}'
                self.jugador_actual = self.jugador_actual.contrincante
                return
        self.ultimo_mensaje = f'Láser salió del tablero — turno de {self.jugador_actual.contrincante.value}'
        self.jugador_actual = self.jugador_actual.contrincante

    def _es_lado_espejo(self, direccion_laser, esquina_triangulo):
        origen = {
            Direccion.NORTE: Direccion.SUR,
            Direccion.SUR: Direccion.NORTE,
            Direccion.ESTE: Direccion.OESTE,
            Direccion.OESTE: Direccion.ESTE
        }[direccion_laser]
        mapa_espejos = {
            Esquina.NO: {Direccion.SUR, Direccion.ESTE},
            Esquina.NE: {Direccion.SUR, Direccion.OESTE},
            Esquina.SO: {Direccion.NORTE, Direccion.ESTE},
            Esquina.SE: {Direccion.NORTE, Direccion.OESTE}
        }
        return origen in mapa_espejos[esquina_triangulo]

    def _busca_esfinge(self, jugador):
        for f in range(FILAS):
            for c in range(COLUMNAS):
                p = self.tablero[f][c]
                if p and p.dueno == jugador and p.tipo == TipoPieza.ESFINGE:
                    return f, c
        return None

    def _refleja(self, d, forma):
        if forma == '/':
            m = {Direccion.NORTE: Direccion.ESTE, Direccion.SUR: Direccion.OESTE,
                 Direccion.ESTE: Direccion.NORTE, Direccion.OESTE: Direccion.SUR}
        else:
            m = {Direccion.NORTE: Direccion.OESTE, Direccion.SUR: Direccion.ESTE,
                 Direccion.ESTE: Direccion.SUR, Direccion.OESTE: Direccion.NORTE}
        return m[d]

    def muestra_legales(self):
        acciones = []
        for f in range(FILAS):
            for c in range(COLUMNAS):
                p = self.tablero[f][c]
                if not p or p.dueno != self.jugador_actual:
                    continue
                if p.puede_rotar():
                    acciones.append(f"R {f},{c} I  — rotar {p.simbolo()} izquierda")
                    acciones.append(f"R {f},{c} D  — rotar {p.simbolo()} derecha")
                if p.puede_moverse():
                    for nf, nc in self._adyacentes(f, c):
                        q = self.tablero[nf][nc]
                        if q is None and self._puede_entrar(p, nf, nc):
                            acciones.append(f"{f},{c}-{nf},{nc}  — mover {p.simbolo()}")
                if p.tipo == TipoPieza.ESPEJO_DOBLE:
                    for nf, nc in self._adyacentes(f, c):
                        q = self.tablero[nf][nc]
                        if (q and q.dueno == self.jugador_actual
                                and RANGO[q.tipo] < RANGO[p.tipo]
                                and q.tipo not in (TipoPieza.FARAON, TipoPieza.ESFINGE)
                                and self._puede_entrar(q, f, c)
                                and self._puede_entrar(p, nf, nc)):
                            acciones.append(f"I {f},{c}-{nf},{nc}  — intercambiar {p.simbolo()}↔{q.simbolo()}")
        print(f"\n{Color.AMARILLO}MOVIMIENTOS LEGALES ({len(acciones)} disponibles):{Color.RESET}")
        for a in (acciones[:40] if acciones else ["Ninguno disponible"]):
            print(f"  {a}")
        if len(acciones) > 40:
            print(f"  ... y {len(acciones) - 40} más")
        print()

    def muestra_ayuda(self):
        print(f"""
{Color.BLANCO}╔══════════════════════════════════════════╗
║           COMANDOS DEL JUEGO             ║
╠══════════════════════════════════════════╣
║  f,c-f,c     Mover pieza (adyacente)    ║
║  R f,c I/D   Rotar pieza I=izq D=der    ║
║  I f,c-f,c   Intercambiar (espejo doble)║
║  L           Ver movimientos legales     ║
║  A           Ver esta ayuda              ║
║  Q           Salir del juego             ║
╠══════════════════════════════════════════╣
║  PIEZAS:                                 ║
║  ♛ Faraón  — objetivo, no rota          ║
║  ⇑⇓⇒⇐ Esfinge — dispara el láser       ║
║  ◤◥◣◢ Triángulo — refleja 2 caras       ║
║  █ Bloque  — absorbe el láser           ║
║  ╱╲ Espejo doble — refleja siempre      ║
╠══════════════════════════════════════════╣
║  OBJETIVO: que el láser alcance al       ║
║  Faraón enemigo                          ║
╚══════════════════════════════════════════╝{Color.RESET}
""")


def limpiar_pantalla():
    os.system('cls' if os.name == 'nt' else 'clear')


def habilitar_ansi_windows():
    """Habilita colores ANSI en la consola de Windows."""
    if os.name == 'nt':
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass


def juega():
    habilitar_ansi_windows()
    limpiar_pantalla()
    print(f"""
{Color.BLANCO}
  ██╗      █████╗ ███████╗███████╗██████╗      ██████╗██╗  ██╗███████╗███████╗███████╗
  ██║     ██╔══██╗██╔════╝██╔════╝██╔══██╗    ██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝
  ██║     ███████║███████╗█████╗  ██████╔╝    ██║     ███████║█████╗  ███████╗███████╗
  ██║     ██╔══██║╚════██║██╔══╝  ██╔══██╗    ██║     ██╔══██║██╔══╝  ╚════██║╚════██║
  ███████╗██║  ██║███████║███████╗██║  ██║    ╚██████╗██║  ██║███████╗███████║███████║
  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝     ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
{Color.RESET}
  {Color.ROJO}ROJO{Color.RESET} vs {Color.AZUL}AZUL{Color.RESET} — Alcanza al Faraón enemigo con tu láser para ganar

  Escribe {Color.AMARILLO}A{Color.RESET} para ver los comandos  |  {Color.AMARILLO}L{Color.RESET} para movimientos legales  |  {Color.AMARILLO}Q{Color.RESET} para salir
""")
    input(f"  {Color.GRIS}Presiona ENTER para comenzar...{Color.RESET}")

    juego = JuegoLaserChess()

    while not juego.ganador:
        juego.muestra_tablero()
        try:
            cmd = input(f"\n{juego.jugador_actual.color}[{juego.jugador_actual.value}]{Color.RESET} > ").strip()
            if not cmd:
                continue
            juego.procesa_comando(cmd)
        except KeyboardInterrupt:
            print(f"\n{Color.GRIS}Juego terminado. ¡Hasta pronto!{Color.RESET}\n")
            return
        except Exception as e:
            juego.muestra_tablero()
            print(f"\n{Color.ROJO}Error: {e}{Color.RESET}")
            input(f"{Color.GRIS}Presiona ENTER para continuar...{Color.RESET}")

    juego.muestra_tablero()
    ganador = juego.ganador
    print(f"\n{ganador.color}{'═' * 50}{Color.RESET}")
    print(f"{ganador.color}  🏆  ¡{ganador.value} GANA!  🏆{Color.RESET}")
    print(f"{ganador.color}{'═' * 50}{Color.RESET}\n")
    print(f"{Color.GRIS}Historial de jugadas ({len(juego.historial)} movimientos):{Color.RESET}")
    for i, mov in enumerate(juego.historial, 1):
        jugador = "ROJO" if i % 2 == 1 else "AZUL"
        print(f"  {i}. {jugador}: {mov}")
    print()
    input(f"{Color.GRIS}Presiona ENTER para salir...{Color.RESET}")


if __name__ == '__main__':
    juega()
