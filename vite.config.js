import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite + React setup. Vercel auto-detects this and runs `vite build`,
// serving the `dist/` output. No extra configuration required.
export default defineConfig({
  plugins: [react()],
})
