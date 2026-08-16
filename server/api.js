import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import express from 'express'

// The data file lives next to the project (q_car/) and is exposed through the
// public/ symlink. Vite bundles vite.config.js into a temp file, so
// import.meta.dirname is unreliable in dev — resolve through public/ and
// realpath instead, which works for both symlinked and copied setups.
const JSON_FILENAME = 'driving_questions_I_to_XI_all_correct_added.json'

function findDataPath() {
  const candidates = [
    path.resolve(process.cwd(), 'public', JSON_FILENAME),
    path.resolve(process.cwd(), JSON_FILENAME),
    path.resolve(import.meta.dirname || process.cwd(), '..', JSON_FILENAME),
  ]
  for (const c of candidates) {
    try {
      return fs.realpathSync(c)
    } catch {
      // try next candidate
    }
  }
  return candidates[0]
}

const REAL_DATA_PATH = findDataPath()

function siblingOfData(rel) {
  return path.join(path.dirname(REAL_DATA_PATH), rel)
}

export const DATA_PATH = process.env.QUIZ_DATA_PATH || REAL_DATA_PATH
export const IMAGE_DIR =
  process.env.QUIZ_IMAGE_DIR ||
  (fs.existsSync(siblingOfData('image'))
    ? siblingOfData('image')
    : path.resolve(process.cwd(), 'public', 'image'))
export const BACKUP_DIR = process.env.QUIZ_BACKUP_DIR || siblingOfData('backup')

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const KEEP_BACKUPS = 20
const IMAGE_EXT_PATTERN =
  /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/

function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

async function readData() {
  let raw
  try {
    raw = await fsp.readFile(DATA_PATH, 'utf8')
  } catch {
    throw httpError(500, 'ไม่พบไฟล์ข้อมูล')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw httpError(500, 'ข้อมูล JSON เสียหาย')
  }
}

function backupJson(data) {
  // Timestamped backup before every write; never touches the user's own .bak.
  try {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const base = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
      d.getHours(),
    )}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    // Two saves within the same second must not overwrite each other.
    let target = path.join(BACKUP_DIR, `driving_questions_${base}.json`)
    for (let i = 2; fs.existsSync(target); i += 1) {
      target = path.join(BACKUP_DIR, `driving_questions_${base}-${i}.json`)
    }
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8')
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => /^driving_questions_\d{8}-\d{6}(-\d+)?\.json$/.test(f))
      .sort()
    for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
      fs.unlinkSync(path.join(BACKUP_DIR, f))
    }
  } catch (e) {
    // A failed backup must not block the save itself.
    console.error('backup failed:', e.message)
  }
}

async function writeDataAtomic(data) {
  backupJson(data)
  const tmp = `${DATA_PATH}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fsp.rename(tmp, DATA_PATH)
}

// Single-process lock: serializes all read-modify-write cycles.
let chain = Promise.resolve()
function withLock(task) {
  const run = chain.then(task, task)
  chain = run.catch(() => {})
  return run
}

function magicBytesOk(ext, buf) {
  if (ext === 'png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  if (ext === 'jpg' || ext === 'jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  if (ext === 'gif') return buf.subarray(0, 4).toString('latin1') === 'GIF8'
  if (ext === 'webp')
    return (
      buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buf.subarray(8, 12).toString('latin1') === 'WEBP'
    )
  return false
}

function decodeImage(dataUrl) {
  const m = IMAGE_EXT_PATTERN.exec(dataUrl || '')
  if (!m) throw httpError(400, 'ไฟล์รูปไม่ถูกต้อง')
  const [, ext, b64] = m
  const buf = Buffer.from(b64, 'base64')
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
    throw httpError(400, 'ไฟล์รูปใหญ่เกินไป (สูงสุด 10MB)')
  }
  if (!magicBytesOk(ext, buf)) throw httpError(400, 'ไฟล์รูปไม่ถูกต้อง')
  return { ext, buf }
}

async function removeQuestionImages(id, exceptExt) {
  await fsp.mkdir(IMAGE_DIR, { recursive: true })
  const files = await fsp.readdir(IMAGE_DIR)
  for (const f of files) {
    if (f.startsWith(`${id}.`)) {
      const ext = f.slice(id.length + 1)
      if (!exceptExt || ext !== exceptExt) {
        await fsp.unlink(path.join(IMAGE_DIR, f)).catch(() => {})
      }
    }
  }
}

// image: undefined -> leave unchanged; null -> remove; {dataUrl} -> write new file.
async function applyImageAction(id, image, saved) {
  if (image === undefined) return
  if (image === null) {
    await removeQuestionImages(id)
    delete saved.image
    delete saved.image_updated_at
    return
  }
  const { ext, buf } = decodeImage(image.dataUrl)
  await fsp.mkdir(IMAGE_DIR, { recursive: true })
  await fsp.writeFile(path.join(IMAGE_DIR, `${id}.${ext}`), buf)
  await removeQuestionImages(id, ext)
  saved.image = `${id}.${ext}`
  saved.image_updated_at = new Date().toISOString()
}

function validateQuestion(q, data) {
  if (!q || typeof q !== 'object') return 'ข้อมูลคำถามไม่ถูกต้อง'
  if (typeof q.question !== 'string' || !q.question.trim()) return 'กรุณากรอกข้อความคำถาม'
  if (!Array.isArray(q.answers) || q.answers.length < 2) return 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว'
  const ids = q.answers.map((a) => a && a.id)
  if (ids.some((x) => !x)) return 'ตัวเลือกต้องมีรหัสครบทุกข้อ'
  if (new Set(ids).size !== ids.length) return 'มีรหัสตัวเลือกซ้ำกัน'
  if (q.answers.some((a) => typeof a.text !== 'string' || !a.text.trim())) {
    return 'ตัวเลือกต้องมีข้อความครบทุกข้อ'
  }
  if (!ids.includes(q.correct_answer)) return 'คำตอบที่ถูกต้องไม่อยู่ในตัวเลือก'
  if (q.category_id && data?.categories) {
    const known = data.categories.some((c) => c.id === q.category_id)
    if (!known) return 'หมวดหมู่ไม่ถูกต้อง'
  }
  return null
}

function nextIdAndNumber(data, categoryId) {
  const maxNum = data.questions.reduce((max, q) => {
    const n = parseInt(String(q.id || '').replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  // `number` restarts per category in this dataset (see question_range),
  // so continue the selected category's own sequence.
  const pool = categoryId
    ? data.questions.filter((q) => q.category_id === categoryId)
    : data.questions
  const maxNumber = pool.reduce((max, q) => Math.max(max, Number(q.number) || 0), 0)
  return {
    id: `q${String(maxNum + 1).padStart(3, '0')}`,
    number: maxNumber + 1,
  }
}

// `question` from the client: editable fields only; image handled separately.
function buildSavedQuestion(existing, question, data, isNew, categoryId) {
  const {
    id: _id,
    number: _number,
    source: _source,
    status: _status,
    image: _image,
    image_updated_at: _iu,
    ...rest
  } = question || {}
  let saved
  if (isNew) {
    const { id, number } = nextIdAndNumber(data, categoryId)
    saved = {
      id,
      number,
      active: rest.active !== false,
      category_id: rest.category_id || (data.categories[0] && data.categories[0].id),
      difficulty: rest.difficulty || 'easy',
      ...rest,
    }
  } else {
    saved = { ...existing, ...rest }
  }
  return saved
}

export function createApiApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '15mb' }))

  app.get('/api/questions', async (req, res) => {
    try {
      const data = await readData()
      res.set('Cache-Control', 'no-store')
      res.json(data)
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'โหลดข้อมูลไม่สำเร็จ' })
    }
  })

  app.put('/api/questions/:id', async (req, res) => {
    try {
      const id = req.params.id
      const result = await withLock(async () => {
        const data = await readData()
        const index = data.questions.findIndex((q) => q.id === id)
        if (index === -1) throw httpError(404, 'ไม่พบคำถาม')
        const saved = buildSavedQuestion(data.questions[index], req.body.question, data, false)
        const invalid = validateQuestion(saved, data)
        if (invalid) throw httpError(400, invalid)
        if (req.body.image !== undefined) {
          await applyImageAction(id, req.body.image, saved)
        }
        data.questions[index] = saved
        await writeDataAtomic(data)
        return saved
      })
      res.json({ ok: true, question: result })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'บันทึกไม่สำเร็จ' })
    }
  })

  app.post('/api/questions', async (req, res) => {
    try {
      const result = await withLock(async () => {
        const data = await readData()
        const categoryId = req.body.question && req.body.question.category_id
        const saved = buildSavedQuestion(null, req.body.question, data, true, categoryId)
        const invalid = validateQuestion(saved, data)
        if (invalid) throw httpError(400, invalid)
        data.questions.push(saved)
        if (req.body.image !== undefined) {
          await applyImageAction(saved.id, req.body.image, saved)
        }
        await writeDataAtomic(data)
        return saved
      })
      res.status(201).json({ ok: true, question: result })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'บันทึกไม่สำเร็จ' })
    }
  })

  // JSON 404 for any other /api path (never HTML).
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'ไม่พบ API' })
  })

  // Body-parser / unexpected errors -> JSON, same shape in dev and prod.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 15MB)' })
      return
    }
    console.error('api error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' })
  })

  return app
}
