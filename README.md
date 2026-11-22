# Pulso

Práctica de guitarra eléctrica, nota a nota, con el micrófono del Mac. El punto en el mástil indica la cuerda y el traste que debes tocar. En el traste 0, toca la cuerda al aire. Un fallo detiene el intento y **Reiniciar** te lleva a la primera nota.

## Uso

1. Coloca el amplificador en sonido limpio cerca del Mac y abre Pulso en una pestaña del navegador.
2. Elige una canción y pulsa **Empezar**. Permite que el navegador use el micrófono y guarda silencio durante la cuenta de entrada.
3. En **Con pulso**, toca cuando el punto se ilumine. Puedes bajar la velocidad. En **A tu ritmo**, el intento espera a que toques. **Escuchar** te permite seguir el mástil con el ejemplo.

**Importar tablatura** admite archivos Guitar Pro (`.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`) y MusicXML (`.musicxml`, `.xml`, `.mxl`). Si el archivo tiene varias pistas, elige la de guitarra. Toca una nota por vez. Para los acordes, Pulso indica la nota más grave. Las importaciones se guardan en el navegador y el audio se analiza en el dispositivo.

- [20 riffs descargables, incluidos AC/DC y Metallica](https://www.guitar-pro.com/blog/p/13037-free-tabs-20-legendary-riffs-to-download)
- [Riffs descargables de Guns N’ Roses](https://www.guitar-pro.com/blog/p/22230-free-tablatures-top-10-guns-n-roses-riffs)

## Ejecutar en local

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Abre [Pulso en localhost](http://localhost:8000/) y concede acceso al micrófono.

## Componentes de terceros

Pulso incluye alphaTab 1.9.0 para leer tablaturas y las fuentes Space Grotesk e IBM Plex Mono. Sus licencias están en `dist/vendor/`.

- [Código fuente de alphaTab 1.9.0](https://github.com/CoderLine/alphaTab/tree/v1.9.0)
