import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createApiApp } from './server/api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'quiz-api-dev',
      configureServer(server) {
        // Mount the Express API inside the Vite dev server so `npm run dev`
        // alone serves both UI and API (no CORS, no second process).
        server.middlewares.use(createApiApp())
      },
    },
  ],
})
