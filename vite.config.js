import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/sarge/ — change `base` if the repo name differs.
export default defineConfig({
  plugins: [react()],
  base: '/sarge/',
})
