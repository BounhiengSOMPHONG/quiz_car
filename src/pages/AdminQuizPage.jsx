import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addQuestion, fetchQuestions, saveQuestion } from '../api'
import { useAuth } from '../auth/AuthContext'
import { filterQuestionIndexes, imagePath, qid, resolveImageUrl } from '../utils'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const DIFFICULTIES = ['easy', 'medium', 'hard']
const LAO_LABELS = ['ກ', 'ຂ', 'ຄ', 'ງ', 'ຈ', 'ສ', 'ຊ', 'ຍ']
const MAX_ANSWERS = 8

function emptyForm(data) {
  return {
    question: '',
    category_id: (data?.categories?.[0] && data.categories[0].id) || '',
    difficulty: 'easy',
    active: true,
    answers: [
      { id: 'A', label: 'ກ', text: '' },
      { id: 'B', label: 'ຂ', text: '' },
    ],
    correct_answer: 'A',
    explanation: '',
    image: '',
  }
}

function formFromQuestion(q) {
  return {
    question: q.question || '',
    category_id: q.category_id || '',
    difficulty: q.difficulty || 'easy',
    active: q.active !== false,
    answers: (q.answers || []).map((a) => ({
      id: a.id,
      label: a.label || '',
      text: a.text || '',
    })),
    correct_answer: q.correct_answer || '',
    explanation: q.explanation || '',
    image: imagePath(q),
  }
}

export default function AdminQuizPage() {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [imagePreviewError, setImagePreviewError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const json = await fetchQuestions()
        if (cancelled) return
        setData(json)
        setError('')
        if (json.questions?.length) {
          const first = json.questions[0]
          setSelectedId(qid(first))
          setForm(formFromQuestion(first))
        } else {
          setForm(emptyForm(json))
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'โหลดข้อมูลไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const questions = useMemo(() => data?.questions || [], [data])
  const navIndexes = useMemo(
    () => filterQuestionIndexes(questions, data?.categories, search),
    [questions, data?.categories, search],
  )

  function confirmDiscard() {
    if (!dirty) return true
    return window.confirm('ยังไม่ได้บันทึกการแก้ไข ต้องการออกจากข้อนี้หรือไม่?')
  }

  function openQuestion(q) {
    if (!confirmDiscard()) return
    setSelectedId(qid(q))
    setForm(formFromQuestion(q))
    resetImageState()
    setStatus(null)
    setDirty(false)
  }

  const currentPos = selectedId
    ? navIndexes.findIndex((i) => qid(questions[i]) === selectedId)
    : -1

  function goToOffset(offset) {
    const nextPos = currentPos + offset
    if (nextPos < 0 || nextPos >= navIndexes.length) return
    openQuestion(questions[navIndexes[nextPos]])
  }

  function startNew() {
    if (!confirmDiscard()) return
    setSelectedId(null)
    setForm(emptyForm(data))
    resetImageState()
    setStatus(null)
    setDirty(false)
  }

  function resetImageState() {
    setImageFile(null)
    setImageRemoved(false)
    setImagePreviewError(false)
  }

  function update(partial) {
    setForm((prev) => ({ ...prev, ...partial }))
    setDirty(true)
  }

  function updateAnswer(idx, patch) {
    setForm((prev) => ({
      ...prev,
      answers: prev.answers.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }))
    setDirty(true)
  }

  function addAnswerRow() {
    setForm((prev) => {
      if (prev.answers.length >= MAX_ANSWERS) return prev
      const id = String.fromCharCode(65 + prev.answers.length)
      return {
        ...prev,
        answers: [...prev.answers, { id, label: LAO_LABELS[prev.answers.length] || '', text: '' }],
      }
    })
    setDirty(true)
  }

  function removeAnswerRow(idx) {
    setForm((prev) => {
      if (prev.answers.length <= 2) return prev
      const answers = prev.answers.filter((_, i) => i !== idx)
      const correct = answers.some((a) => a.id === prev.correct_answer)
        ? prev.correct_answer
        : answers[0].id
      return { ...prev, answers, correct_answer: correct }
    })
    setDirty(true)
  }

  function applyImageFile(file) {
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus({ ok: false, text: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 8MB)' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageFile(reader.result)
      setImageRemoved(false)
      setImagePreviewError(false)
      setDirty(true)
      setStatus({ ok: true, text: 'ได้รูปแล้ว — กด "บันทึกการแก้ไข" เพื่อยืนยัน' })
    }
    reader.onerror = () => setStatus({ ok: false, text: 'อ่านไฟล์รูปไม่สำเร็จ' })
    reader.readAsDataURL(file)
  }

  function onPickFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (file) applyImageFile(file)
  }

  function onPasteImage(e) {
    const items = e.clipboardData && e.clipboardData.items
    if (!items) return
    const file = Array.from(items)
      .map((item) => (item.type.startsWith('image/') ? item.getAsFile() : null))
      .find(Boolean)
    if (!file) return
    e.preventDefault()
    applyImageFile(file)
  }

  function removeImage() {
    setImageRemoved(true)
    setImageFile(null)
    setImagePreviewError(false)
    setDirty(true)
  }

  async function handleSave() {
    if (saving || !form) return
    if (!form.question.trim()) return setStatus({ ok: false, text: 'กรุณากรอกข้อความคำถาม' })
    if (form.answers.length < 2) return setStatus({ ok: false, text: 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว' })
    if (form.answers.some((a) => !a.text.trim())) {
      return setStatus({ ok: false, text: 'ตัวเลือกต้องมีข้อความครบทุกข้อ' })
    }
    if (!form.answers.some((a) => a.id === form.correct_answer)) {
      return setStatus({ ok: false, text: 'คำตอบที่ถูกต้องไม่อยู่ในตัวเลือก' })
    }

    const payload = {
      question: form.question,
      category_id: form.category_id,
      difficulty: form.difficulty,
      active: form.active,
      answers: form.answers,
      correct_answer: form.correct_answer,
      explanation: form.explanation,
    }
    const image = imageFile ? { dataUrl: imageFile } : imageRemoved ? null : undefined

    setSaving(true)
    try {
      const res = selectedId
        ? await saveQuestion(selectedId, payload, image)
        : await addQuestion(payload, image)
      const fresh = await fetchQuestions()
      setData(fresh)
      const saved = res.question
      setSelectedId(qid(saved))
      setForm(formFromQuestion(saved))
      resetImageState()
      setDirty(false)
      setStatus({
        ok: true,
        text: `บันทึกแล้ว (${new Date().toLocaleTimeString('th-TH')})`,
      })
    } catch (e) {
      setStatus({ ok: false, text: e.message || 'บันทึกไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">กำลังโหลดคำถาม...</div>
  }

  if (error || !data || !form) {
    return (
      <div className="error">
        <p>{error || 'ไม่พบคำถาม'}</p>
      </div>
    )
  }

  const previewUrl = imageFile || (!imageRemoved && form.image ? resolveImageUrl(form.image) : null)

  // ช่องค้นหา + รายการคำถาม ใช้ทั้ง sidebar (จอปกติ) และลิ้นชักล่าง (มือถือ)
  const listPanel = (onPick) => (
    <>
      <div className="row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาคำถาม..."
          style={{ width: '100%' }}
        />
      </div>

      <div className="editor-list">
        {navIndexes.map((i) => {
          const q = questions[i]
          const classes = ['editor-item']
          if (qid(q) === selectedId) classes.push('active')
          if (q.active === false) classes.push('inactive')
          if (imagePath(q)) classes.push('hasimg')
          return (
            <button
              key={qid(q)}
              type="button"
              className={classes.join(' ')}
              onClick={() => {
                openQuestion(q)
                onPick()
              }}
            >
              <span className="editor-num">
                {i + 1}. {qid(q)}
              </span>
              <span className="editor-text">{q.question || '(ไม่มีคำถาม)'}</span>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div className="wrap exam-run">
      <div className="topbar">
        <div>
          <h1>แก้ไขคำถาม</h1>
          <div className="small">
            ผู้ดูแล: <b>{user.displayName}</b> · แก้ไขแล้วบันทึกลงไฟล์ข้อมูลจริง
          </div>
        </div>
        <div className="actions">
          <Link to="/admin" className="btn-link">
            แดชบอร์ด
          </Link>
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="grid">
        <aside className="panel editor-list-panel">
          <div className="small">
            ทั้งหมด {questions.length} ข้อ
          </div>

          <button type="button" className="primary" style={{ width: '100%' }} onClick={startNew}>
            + เพิ่มคำถามใหม่
          </button>

          {listPanel(() => {})}
        </aside>

        <main className="panel" onPaste={onPasteImage}>
          <div className="editor-head">
            <div className="small">
              {selectedId ? (
                <>
                  กำลังแก้ไข: <b>{selectedId}</b>
                  {currentPos >= 0 ? (
                    <span className="pos-mark"> · ข้อที่ {currentPos + 1}/{navIndexes.length}</span>
                  ) : null}
                </>
              ) : (
                <>
                  โหมด: <b>เพิ่มคำถามใหม่</b> (ระบบจะกำหนดรหัสให้อัตโนมัติ)
                </>
              )}
              {dirty ? <span className="dirty-mark"> · มีการแก้ไขที่ยังไม่บันทึก</span> : null}
            </div>
            <div className="editor-actions">
              <div className="editor-nav">
                <button
                  type="button"
                  onClick={() => goToOffset(-1)}
                  disabled={currentPos <= 0}
                  title="ข้อก่อนหน้า"
                >
                  ← ก่อนหน้า
                </button>
                <button
                  type="button"
                  onClick={() => goToOffset(1)}
                  disabled={currentPos < 0 || currentPos >= navIndexes.length - 1}
                  title="ข้อถัดไป"
                >
                  ถัดไป →
                </button>
              </div>
              <button
                type="button"
                className="primary form-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก...' : selectedId ? 'บันทึกการแก้ไข' : 'เพิ่มคำถามใหม่'}
              </button>
            </div>
          </div>

          {status ? (
            <div className={`form-status ${status.ok ? 'ok' : 'bad'}`}>{status.text}</div>
          ) : null}

          <div className="editor-form">
            <label className="form-field">
              <span>คำถาม</span>
              <textarea
                value={form.question}
                onChange={(e) => update({ question: e.target.value })}
                rows={3}
                placeholder="ข้อความคำถาม"
              />
            </label>

            <div className="form-row">
              <label className="form-field">
                <span>หมวดหมู่</span>
                <select
                  value={form.category_id}
                  onChange={(e) => update({ category_id: e.target.value })}
                >
                  {(data.categories || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>ระดับความยาก</span>
                <select
                  value={form.difficulty}
                  onChange={(e) => update({ difficulty: e.target.value })}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => update({ active: e.target.checked })}
                />
                เปิดใช้งาน (active)
              </label>
            </div>

            <div className="form-field">
              <span>ตัวเลือก (เลือกวงกลมหน้าข้อที่เป็นคำตอบที่ถูก)</span>
              {form.answers.map((a, idx) => (
                <div key={a.id} className="answer-row">
                  <span className="badge">{a.id}</span>
                  <input
                    type="text"
                    value={a.label}
                    onChange={(e) => updateAnswer(idx, { label: e.target.value })}
                    className="answer-label"
                    placeholder="ກ"
                    title="ตัวอักษรกำกับตัวเลือก"
                  />
                  <textarea
                    ref={(el) => {
                      // ขยายความสูงตามเนื้อหาให้เห็นข้อความทั้งหมด
                      if (!el) return
                      el.style.height = 'auto'
                      el.style.height = `${el.scrollHeight}px`
                    }}
                    value={a.text}
                    onChange={(e) => updateAnswer(idx, { text: e.target.value })}
                    onInput={(e) => {
                      e.currentTarget.style.height = 'auto'
                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                    }}
                    className="answer-text"
                    placeholder={`ข้อความตัวเลือก ${a.id}`}
                    rows={1}
                  />
                  <label className="radio-label" title="คำตอบที่ถูก">
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={form.correct_answer === a.id}
                      onChange={() => update({ correct_answer: a.id })}
                    />
                    ถูก
                  </label>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeAnswerRow(idx)}
                    disabled={form.answers.length <= 2}
                    title="ลบตัวเลือกนี้"
                  >
                    ลบ
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAnswerRow}
                disabled={form.answers.length >= MAX_ANSWERS}
              >
                + เพิ่มตัวเลือก
              </button>
            </div>

            <label className="form-field">
              <span>คำอธิบาย (เฉลย)</span>
              <textarea
                value={form.explanation}
                onChange={(e) => update({ explanation: e.target.value })}
                rows={3}
                placeholder="เหตุผลของคำตอบที่ถูก"
              />
            </label>

            <div className="form-field image-field">
              <span>รูปภาพ</span>
              <div className="image-edit">
                <div className="image-box small-box">
                  {previewUrl && !imagePreviewError ? (
                    <img
                      src={previewUrl}
                      alt=""
                      onError={() => setImagePreviewError(true)}
                    />
                  ) : (
                    <div className="image-note">
                      {imageRemoved
                        ? 'รูปจะถูกลบเมื่อบันทึก'
                        : imagePreviewError
                          ? 'ไม่พบไฟล์รูป'
                          : 'ยังไม่มีรูปสำหรับข้อนี้'}
                    </div>
                  )}
                </div>
                <div className="image-actions">
                  <label className="btn-link">
                    อัปโหลดรูปใหม่
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onPickFile}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button type="button" onClick={removeImage} disabled={!previewUrl && !imageRemoved}>
                    ลบรูป
                  </button>
                  <div className="small pasteHint">
                    หรือกด <b>Ctrl+V</b> เพื่อวางรูปที่ copy ไว้ (Screenshot, โปรแกรมต่าง ๆ)
                  </div>
                  <div className="small fileName">
                    {imageFile
                      ? 'รูปใหม่ (ยังไม่บันทึก)'
                      : form.image
                        ? `รูปในข้อมูล: ${form.image}`
                        : '—'}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      <nav className="exam-navbar">
        <span className="exam-meta">
          {selectedId ? (
            <>
              ข้อ <b>{currentPos >= 0 ? currentPos + 1 : '-'}</b>/{navIndexes.length}
            </>
          ) : (
            <b>ข้อใหม่</b>
          )}
        </span>
        <button type="button" className="primary" onClick={() => setNavOpen(true)}>
          เลือกข้อ
        </button>
        <button type="button" className="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </nav>

      {navOpen ? (
        <div className="sheet-backdrop" onClick={() => setNavOpen(false)}>
          <div
            className="exam-sheet"
            role="dialog"
            aria-label="เลือกคำถาม"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-head">
              <span>เลือกคำถาม · ทั้งหมด {questions.length} ข้อ</span>
              <button type="button" onClick={() => setNavOpen(false)}>
                ปิด
              </button>
            </div>
            <button
              type="button"
              className="primary"
              style={{ width: '100%' }}
              onClick={() => {
                startNew()
                setNavOpen(false)
              }}
            >
              + เพิ่มคำถามใหม่
            </button>
            {listPanel(() => setNavOpen(false))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
