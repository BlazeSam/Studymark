import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite doesn't read PORT on its own. Honouring it lets a second dev server run alongside one
  // already holding 5173 — nothing here needs a fixed port (the api/* routes are same-origin).
  server: { port: Number(process.env.PORT) || 5173 },
})
