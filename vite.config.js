import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      // Required for SharedArrayBuffer support (needed for threaded WASM/VLC.js)
      'Cross-Origin-Opener-Policy': 'same-origin',
      // 'credentialless' allows loading cross-origin media without requiring
      // every resource to carry Cross-Origin-Resource-Policy headers, while
      // still enabling SharedArrayBuffer.
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
