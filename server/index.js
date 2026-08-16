import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { IMAGE_DIR, createApiApp } from './api.js'

const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')

const app = express()
app.disable('x-powered-by')

app.use(createApiApp())
// Serve uploaded images straight from the real folder, so new uploads
// are visible without rebuilding.
app.use('/image', express.static(IMAGE_DIR))
app.use(express.static(DIST_DIR))

// SPA fallback (Express 5: plain app.use, not app.get('*')).
app.use((req, res) => {
  if (fs.existsSync(INDEX_HTML)) {
    res.sendFile(INDEX_HTML)
  } else {
    res.status(404).send('ไม่พบไฟล์ build — รัน npm run build ก่อน')
  }
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`Quiz server: http://localhost:${port}`)
})
