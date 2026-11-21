# Catzle 🐾

Un puzle de gatitos cozy, con piezas de pestañas y huecos, pensado para jugar en móvil en vertical (y también en escritorio). Es un regalo de Navidad para **Sagrario**.

Hecho con HTML5 Canvas y JavaScript moderno (ES6+), sin dependencias ni archivos de audio externos. Las fotos de los gatitos están en `assets/cats/`.

---

## Cómo abrirlo

**Opción recomendada (móvil / servidor local):**

```bash
cd catzle
python -m http.server 4173
```

Y abre `http://localhost:4173` en el navegador. Para probarlo en el móvil, conecta el móvil a la misma red y abre la IP del ordenador con el puerto `4173`.

En Android, desde Chrome puedes usar «Añadir a pantalla de inicio» para jugarlo a pantalla completa.

**Opción rápida:** abrir `index.html` con doble clic también funciona, pero el navegador no puede leer el listado de la carpeta en `file://`; en ese caso se usa la lista de respaldo `CAT_PHOTOS`.

---

## Fotos y número de niveles

El juego lee `assets/cats/` y **crea tantos niveles como fotos haya**. Ahora mismo hay cinco fotos, así que la partida tiene **5 niveles** y cada uno usa una foto distinta:

```
assets/cats/bmo-1.jpg
assets/cats/bmo-2.jpg
assets/cats/tina-1 (1).jpg
assets/cats/tina-2.jpg
assets/cats/tina-3.jpg
```

- Con el servidor local, el **listado de la carpeta es automático**: añade una foto y recarga; habrá un nivel más.
- Para publicarlo en un sitio estático sin listado de directorios, el juego usa `assets/cats/photos.json` como manifiesto. Regénéralo después de añadir fotos con:

  ```bash
  node tools/update-photos.mjs
  ```

- `CAT_PHOTOS`, al principio de `game.js`, es la lista de respaldo para cuando no se puede leer la carpeta (por ejemplo con `file://`).
- El juego recorta cada foto en un **cuadrado centrado** y respeta la orientación EXIF de las fotos del móvil.
- Las fotos grandes se reducen una sola vez a un cuadrado de 1000 px al cargar, para que el juego vaya ligero.
- Si una foto falta, tarda o falla, esa entrada muestra un **gatito dibujado** con cariño. El juego nunca se queda colgado.
- La selección es aleatoria y recorre todas las fotos antes de repetir; además evita repetir la misma justo después.

> `tina-1 (1).jpg` funciona tal cual. Si prefieres un nombre más limpio, renómbralo a `tina-1.jpg` y actualiza `CAT_PHOTOS` / `photos.json`.

---

## Niveles

`LEVELS_CONFIG`, al principio de `game.js`, guarda la progresión base:

```js
{ name: 'Bigotes', rows: 3, cols: 3, snap: 0.38, guide: 0.34, clear: 'Bigotes en su sitio' }
```

| Campo   | Qué hace |
|---------|----------|
| `name`  | Nombre que aparece en la cabecera. |
| `rows`  | Filas de piezas. |
| `cols`  | Columnas de piezas. |
| `snap`  | Tolerancia del imán al soltar (fracción del lado de la pieza). Más grande = más fácil. |
| `guide` | Opacidad de la foto de fondo. Más pequeño = guía más sutil. |
| `clear` | Frase que aparece al completar el nivel. |

Con 5 fotos, la progresión es **2×2 → 3×3 → 3×4 → 4×4 → 5×5**. Las piezas suben de 4 a 25. Si hay 6 fotos se añade el 2×3; si hay más, se añaden niveles extra (5×6, 6×6, 6×7, 7×7...). Con menos fotos se mantiene el 5×5 como final si hay al menos 4 niveles, y la progresión se acorta.

La pantalla final aparece después del **último nivel que corresponda**, no de un número fijo.

---

## Cómo se juega

- Arrastra una pieza con el dedo (o con el ratón). La pieza se eleva un poco para que el dedo no la tape.
- Al soltarla cerca de su sitio, se coloca sola con una animación y queda **bloqueada**.
- La foto de fondo, atenuada, sirve de guía relajante.
- **Ojo**: muestra u oculta la guía de la foto.
- **Ordenar**: devuelve las piezas sueltas a la bandeja.
- **Altavoz** (arriba a la derecha): silencia o activa el sonido. También con la tecla **M**. La preferencia se guarda en `localStorage`.

Estados del juego: `START`, `PLAYING`, `LEVEL_CLEAR` y `VICTORY`.

Al terminar todos los niveles aparece el mensaje navideño para Sagrario y el botón **Jugar otra vez**.

---

## Sonido

No hay archivos de audio: todo se sintetiza con la **Web Audio API**.

- Coger una pieza: burbuja corta y suave.
- Encajar: campanilla cálida con un pequeño «clic»; la nota sube suavemente a medida que avanzas en el nivel.
- Soltar sin encajar: un golpecito casi imperceptible (solo si has movido la pieza).
- Completar nivel: arpegio dulce con un pad cálido.
- Victoria final: una melodía de cascabeles muy suave y un acorde navideño.

El `AudioContext` se crea o se reanuda con el primer gesto real (toque, clic o tecla), como piden los navegadores móviles. La cadena pasa por una ganancia moderada, un filtro suave y un compresor para que no sature; la reverb es un impulso generado por código. El botón de sonido es global, respeta el safe-area y está por encima de los menús.

---

## Detalles técnicos

- Lógica en un IIFE (`game.js`) con `'use strict'`; sin librerías ni fuentes externas.
- Canvas 2D con `devicePixelRatio` limitado a **3**.
- Delta time limitado a `0.05 s`.
- `resize` con debounce; el tablero se reconstruye manteniendo las piezas ya colocadas.
- Zonas seguras con `safe-area-inset`.
- `touch-action: none` en el canvas, sin scroll ni zoom accidental.
- Piezas generadas con curvas Bézier y una arista compartida: la pestaña de una pieza es exactamente el hueco de la otra.
- Cada pieza se pre-renderiza en su propio canvas con sombra y borde suaves.
- Reparto de fotos tipo «bolsa»: todas antes de repetir, sin repetir la última.
- Fallback de gatito dibujado.
- Audio procedural con reverb sintética, compresor y preferencia de silencio persistente.

---

## Estructura

```
catzle/
├── index.html
├── styles.css
├── game.js
├── README.md
├── tools/
│   └── update-photos.mjs
└── assets/
    └── cats/
        ├── README.md
        ├── photos.json
        ├── bmo-1.jpg
        ├── bmo-2.jpg
        ├── tina-1 (1).jpg
        ├── tina-2.jpg
        └── tina-3.jpg
```

---

## Personalizar el regalo

- El título y los textos de inicio están en `showStart()`.
- El mensaje final está en `showVictory()`. Puedes cambiar el nombre, el año y el texto.
- La ilustración de los gatitos se dibuja por código en `drawCatArt()`; el gato de la pantalla final lleva gorro de Papá Noel.

Hecho con cariño para Sagrario. 🎄
