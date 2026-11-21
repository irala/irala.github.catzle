# Fotos de los gatitos

Aquí van las fotos de BMO, Tina y compañía.

## Nombres actuales

```
bmo-1.jpg
bmo-2.jpg
tina-1 (1).jpg
tina-2.jpg
tina-3.jpg
```

## Cómo funciona

El número de fotos de esta carpeta determina **cuántos niveles tiene la partida**. Con las cinco fotos actuales hay cinco niveles.

1. Si sirves el juego con `python -m http.server` (o cualquier servidor con listado de directorios), el juego lee la carpeta automáticamente. Añade una foto, recarga y tendrás un nivel más.
2. Si lo publicas en un sitio estático sin listado, usa el manifiesto `photos.json`. Regénéralo con:

   ```bash
   node tools/update-photos.mjs
   ```

3. `CAT_PHOTOS`, al principio de `../../game.js`, es la lista de respaldo para cuando el navegador no puede listar la carpeta (por ejemplo abriendo `index.html` con `file://`).

## Consejos

- Mejor **JPG, PNG o WebP**.
- No hace falta que sean cuadradas: el juego recorta el centro en cuadrado y respeta la orientación EXIF del móvil.
- Tamaño recomendado: **~1200 px de lado**. Fotos grandes también valen: se reducen una vez a 1000 px al cargar.
- Si un archivo falta o falla, el juego dibuja un gatito en su lugar.
- Si renombras `tina-1 (1).jpg` a `tina-1.jpg`, actualiza también `CAT_PHOTOS` y `photos.json`.
