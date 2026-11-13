import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        // Two pages: the main window, and the panel under the menu bar icon.
        input: {
          index: resolve(import.meta.dirname, 'src/renderer/index.html'),
          tray: resolve(import.meta.dirname, 'src/renderer/tray.html'),
        },
      },
    },
  },
})
