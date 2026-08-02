

# VLC.js

Reproductor de medios VLC portado a WebAssembly, que se ejecuta directamente en el navegador. Este proyecto tiene como objetivo proporcionar una interfaz de usuario web funcional para VLC, impulsada por una compilación WASM compilada con Emscripten.

## Inicio rápido

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/addyosmani/vlc.js
cd vlc.js
npm install
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Compila para producción:

```bash
npm run build
```

## Características

- **Interfaz de reproductor completa**: Modelada a partir de la interfaz clásica de VLC.
- **Soporte para listas de reproducción**: Gestiona múltiples archivos en una lista de reproducción.
- **Controles de reproducción**: Reproducir, pausar, detener, avanzar, controlar volumen y velocidad.
- **Reproducción de archivos locales**: Soporte para arrastrar y soltar archivos de video y audio locales.
- **WebAssembly**: Impulsado por una compilación WASM del motor de VLC.

## Problemas conocidos

⚠️ **Este proyecto es actualmente muy experimental y se sabe que presenta muchos errores.**

- **Estabilidad de reproducción**: Es posible que encuentres fallos o congelamientos durante la reproducción o al cambiar de archivo.
- **Soporte de formatos**: No todos los códecs y formatos de contenedor compatibles con VLC de escritorio están soportados en esta compilación WASM.
- **Rendimiento**: El rendimiento de decodificación está limitado por la velocidad de ejecución de WASM del navegador y las restricciones de un solo hilo en algunas áreas. Los videos de alta resolución pueden experimentar interrupciones.
- **Errores de interfaz**: La interfaz puede desincronizarse ocasionalmente con el estado del reproductor.

## Agradecimientos

Este proyecto se basa en el trabajo pionero de otros en portar VLC a la web:

- **VideoLabs**: Por la demo original de VLC.js y los esfuerzos de portabilidad a WebAssembly. [Ver Demo](https://videolabs.io/communication/vlcjs-demo/vlc.html)
- **Krowemoh**: Por el repositorio `vlc.js` que sirvió como base para la integración de WASM. [Repositorio de GitHub](https://github.com/Krowemoh/vlc.js.git)
