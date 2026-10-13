import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Muat .env dari root repositori (satu file untuk frontend + backend).
  // Hanya variabel berawalan VITE_ yang disuntikkan ke bundle klien —
  // secret backend (JWT/Groq) tidak akan pernah ikut ke browser.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
})
