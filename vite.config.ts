import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' lets the built site work under any GitHub Pages repo path
export default defineConfig({ base: './', plugins: [react(), tailwindcss()] })
