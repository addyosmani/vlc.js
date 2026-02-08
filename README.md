# VLC.js

VLC media player ported to WebAssembly, running directly in the browser. This project aims to provide a functional web-based UI for VLC, powered by an Emscripten-compiled WASM build.

## Quickstart

Clone the repository and install dependencies:

```bash
git clone https://github.com/addyosmani/vlc.js
cd vlc.js
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Features

- **Full Player UI**: Modeled after the classic VLC interface.
- **Playlist Support**: Manage multiple files in a playlist.
- **Playback Controls**: Play, pause, stop, seek, volume, and speed control.
- **Local File Playback**: Drag and drop support for playing local video and audio files.
- **WebAssembly**: Powered by a WASM build of VLC engine.

## Known Issues

⚠️ **This project is currently very experimental and known to be very buggy.**

- **Playback Stability**: You may encounter crashes or freezes during playback or when switching files.
- **Format Support**: Not all codecs and container formats supported by the desktop VLC are supported in this WASM build.
- **Performance**: Decoding performance is limited by the browser's WASM execution speed and single-threading constraints in some areas. High-resolution videos may stutter.
- **UI Glitches**: The UI may occasionally desync from the player state.

## Acknowledgements

This project builds upon the pioneering work of others in porting VLC to the web:

- **VideoLabs**: For the original VLC.js demo and WebAssembly porting efforts. [View Demo](https://videolabs.io/communication/vlcjs-demo/vlc.html)
- **Krowemoh**: For the `vlc.js` repository which served as a foundation for the WASM integration. [GitHub Repo](https://github.com/Krowemoh/vlc.js.git)
