import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuestions } from '../api'
import { useAuth } from '../auth/AuthContext'
import { answersKey } from '../auth/auth'
import {
  categoryTitle,
  filterQuestionIndexes,
  imagePath,
  qid,
  resolveImageUrl,
} from '../utils'

function loadUserAnswers(username) {
  try {
    return JSON.parse(localStorage.getItem(answersKey(username)) || '{}')
  } catch {
    return {}
  }
}

function saveUserAnswers(username, answers) {
  localStorage.setItem(answersKey(username), JSON.stringify(answers))
}

export default function QuizView({ titleSuffix = '' }) {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState(() => loadUserAnswers(user.username))
  const [search, setSearch] = useState('')
  const [jumpInput, setJumpInput] = useState('')
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const json = await fetchQuestions()
        if (!cancelled) {
          setData(json)
          setError('')
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

    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const questions = useMemo(() => {
    if (!data?.questions) return []
    return data.questions.filter((q) => q.active !== false)
  }, [data])

  const currentQuestion = questions[currentIndex]
  const selectedAnswer = currentQuestion ? answers[qid(currentQuestion)] || null : null
  const checked = selectedAnswer !== null
  const navIndexes = useMemo(
    () => filterQuestionIndexes(questions, data?.categories, search),
    [questions, data?.categories, search],
  )

  useEffect(() => {
    setImageError(false)
  }, [currentIndex, currentQuestion])

  function chooseAnswer(answerId) {
    if (!currentQuestion) return
    const id = qid(currentQuestion)
    const next = { ...answers, [id]: answerId }
    setAnswers(next)
    saveUserAnswers(user.username, next)
  }

  function resetProgress() {
    if (!confirm('ล้างคำตอบที่บันทึกไว้ทั้งหมด?')) return
    setAnswers({})
    localStorage.removeItem(answersKey(user.username))
  }

  if (loading) {
    return <div className="loading">กำลังโหลดคำถาม...</div>
  }

  if (error || !data || !currentQuestion) {
    return (
      <div className="error">
        <p>{error || 'ไม่พบคำถาม'}</p>
      </div>
    )
  }

  const path = imagePath(currentQuestion)
  const imageUrl = resolveImageUrl(path)
  const correct = (currentQuestion.answers || []).find(
    (a) => a.id === currentQuestion.correct_answer,
  )
  const isCorrect = selectedAnswer === currentQuestion.correct_answer
  const score = Object.entries(answers).filter(([id, ans]) => {
    const q = questions.find((item) => qid(item) === id)
    return q && ans === q.correct_answer
  }).length

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>
            {data.title || 'Driving Quiz'}
            {titleSuffix}
          </h1>
          <div className="small">
            ผู้ใช้: <b>{user.displayName}</b> ({user.role}) · โหมดฝึกซ้อม
          </div>
        </div>
        <div className="actions">
          {user.role === 'admin' ? (
            <Link to="/admin" className="btn-link">
              แดชบอร์ด
            </Link>
          ) : (
            <Link to="/tester" className="btn-link">
              หน้าแรก
            </Link>
          )}
          <button type="button" className="primary" onClick={resetProgress}>
            ล้างคำตอบ
          </button>
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="grid">
        <aside className="panel">
          <div className="small">เลือกคำตอบแล้วระบบจะตรวจถูก/ผิดทันที</div>

          <div className="stats">
            <div className="stat">
              <span>ทั้งหมด</span>
              <b>{questions.length}</b>
            </div>
            <div className="stat">
              <span>มีรูปแล้ว</span>
              <b>{questions.filter((q) => !!imagePath(q)).length}</b>
            </div>
            <div className="stat">
              <span>ตอบแล้ว</span>
              <b>{Object.keys(answers).length}</b>
            </div>
            <div className="stat">
              <span>ถูก</span>
              <b>{score}</b>
            </div>
            <div className="stat">
              <span>ข้อปัจจุบัน</span>
              <b>{currentIndex + 1}</b>
            </div>
          </div>

          <div className="row">
            <input
              type="number"
              min="1"
              max={questions.length}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder="เลขข้อ"
              style={{ width: '105px' }}
            />
            <button
              type="button"
              onClick={() => {
                const n = parseInt(jumpInput, 10)
                if (n >= 1 && n <= questions.length) setCurrentIndex(n - 1)
              }}
            >
              ไปข้อ
            </button>
          </div>

          <div className="row">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาคำถาม... (ข้อความ/เลขข้อ)"
              style={{ width: '100%' }}
            />
          </div>

          {search.trim() ? (
            <div className="search-results">
              {navIndexes.length === 0 ? (
                <div className="small">ไม่พบคำถามที่ตรงกับ "{search.trim()}"</div>
              ) : null}
              {navIndexes.slice(0, 8).map((i) => {
                const q = questions[i]
                return (
                  <button
                    key={qid(q)}
                    type="button"
                    className="search-item"
                    onClick={() => setCurrentIndex(i)}
                  >
                    <b>{i + 1}.</b> {String(q.question || '').slice(0, 80)}
                  </button>
                )
              })}
              {navIndexes.length > 8 ? (
                <div className="small">
                  และอีก {navIndexes.length - 8} ข้อ — เลือกจากเลขด้านล่างได้
                </div>
              ) : null}
            </div>
          ) : null}

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '12px 0' }} />

          <div className="qnav">
            {navIndexes.map((i) => {
              const q = questions[i]
              const classes = ['qbtn']
              if (i === currentIndex) classes.push('active')
              if (answers[qid(q)]) classes.push('answered')
              if (imagePath(q)) classes.push('hasimg')

              return (
                <button
                  key={qid(q)}
                  type="button"
                  className={classes.join(' ')}
                  title={`${qid(q)}${imagePath(q) ? ' มีรูปแล้ว' : ''}`}
                  onClick={() => setCurrentIndex(i)}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </aside>

        <main className="panel">
          <div className="category">
            {categoryTitle(data.categories, currentQuestion.category_id)} / {qid(currentQuestion)}
          </div>
          <div className="question">
            {currentIndex + 1}. {currentQuestion.question || ''}
          </div>

          <div className="main">
            <section>
              <div className="image-box">
                {path && imageUrl && !imageError ? (
                  <img src={imageUrl} alt="" onError={() => setImageError(true)} />
                ) : (
                  <div className="image-note">
                    {path
                      ? imageError
                        ? `ไม่พบไฟล์รูป: ${path}`
                        : 'กำลังโหลดรูป...'
                      : 'ยังไม่มีรูปสำหรับข้อนี้'}
                  </div>
                )}
              </div>
              {path ? <div className="fileName">รูปใน JSON: {path}</div> : null}
            </section>

            <section>
              <div className="options">
                {(currentQuestion.answers || []).map((opt) => {
                  const classes = ['option']
                  if (selectedAnswer === opt.id) classes.push('selected')
                  if (checked) {
                    if (opt.id === currentQuestion.correct_answer) classes.push('correct')
                    if (
                      selectedAnswer === opt.id &&
                      selectedAnswer !== currentQuestion.correct_answer
                    ) {
                      classes.push('wrong')
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={classes.join(' ')}
                      onClick={() => chooseAnswer(opt.id)}
                    >
                      <div className="badge">{opt.label || opt.id}</div>
                      <div>{opt.text || ''}</div>
                    </button>
                  )
                })}
              </div>

              <div className="small" style={{ marginTop: '12px' }}>
                กดเลือกคำตอบแล้วระบบจะตรวจถูก/ผิดทันที
              </div>

              {!checked ? (
                <div className="row">
                  <button
                    type="button"
                    onClick={() => chooseAnswer(currentQuestion.correct_answer)}
                  >
                    ดูคำตอบ
                  </button>
                  <span className="small">แสดงเฉลยเลยโดยไม่ต้องตอบเอง</span>
                </div>
              ) : null}

              <div className="row">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                >
                  ก่อนหน้า
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  disabled={currentIndex >= questions.length - 1}
                >
                  ถัดไป
                </button>
              </div>

              {checked ? (
                <div className={`result ${isCorrect ? 'ok' : 'bad'}`}>
                  <b>{isCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก'}</b>
                  <br />
                  คำตอบที่ถูก:{' '}
                  <b>
                    {correct
                      ? `${correct.label}. ${correct.text}`
                      : currentQuestion.correct_answer}
                  </b>
                  {currentQuestion.explanation ? (
                    <>
                      <hr style={{ border: 0, borderTop: '1px solid rgba(0,0,0,.12)' }} />
                      {currentQuestion.explanation}
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
