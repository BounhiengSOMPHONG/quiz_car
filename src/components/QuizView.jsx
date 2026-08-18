import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuestions } from '../api'
import { useAuth } from '../auth/AuthContext'
import {
  categoryTitle,
  filterQuestionIndexes,
  imagePath,
  qid,
  resolveImageUrl,
} from '../utils'

export default function QuizView({ titleSuffix = '' }) {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [jumpInput, setJumpInput] = useState('')
  const [imageError, setImageError] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

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
  const navIndexes = useMemo(
    () => filterQuestionIndexes(questions, data?.categories, search),
    [questions, data?.categories, search],
  )

  useEffect(() => {
    setImageError(false)
  }, [currentIndex, currentQuestion])

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

  // แผงด้านข้าง (สถิติ + ไปข้อ + ค้นหา + ตารางเลขข้อ) ใช้ทั้งบนจอปกติ
  // และในลิ้นชักล่างบนมือถือ — onSelect ต่างกันแค่ปิดลิ้นชักด้วยหรือไม่
  const navPanel = (onSelect) => (
    <>
      <div className="small">แสดงเฉลยทุกข้อทันที — เปิดดูได้โดยไม่ต้องตอบ</div>

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
            if (n >= 1 && n <= questions.length) onSelect(n - 1)
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
          ) : (
            navIndexes.map((i) => {
              const q = questions[i]
              return (
                <button
                  key={qid(q)}
                  type="button"
                  className="search-item"
                  onClick={() => onSelect(i)}
                >
                  <b>{i + 1}.</b> {String(q.question || '').slice(0, 80)}
                </button>
              )
            })
          )}
        </div>
      ) : null}

      {!search.trim() ? (
        <>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '12px 0' }} />

          <div className="qnav">
            {navIndexes.map((i) => {
              const q = questions[i]
              const classes = ['qbtn']
              if (i === currentIndex) classes.push('active')
              if (imagePath(q)) classes.push('hasimg')

              return (
                <button
                  key={qid(q)}
                  type="button"
                  className={classes.join(' ')}
                  title={`${qid(q)}${imagePath(q) ? ' มีรูปแล้ว' : ''}`}
                  onClick={() => onSelect(i)}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </>
  )

  return (
    <div className="wrap exam-run">
      <div className="topbar">
        <div>
          <h1>
            {data.title || 'Driving Quiz'}
            {titleSuffix}
          </h1>
          <div className="small">
            ผู้ใช้: <b>{user.displayName}</b> ({user.role}) · โหมดฝึกซ้อม · ดูเฉลยทุกข้อ
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
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="grid">
        <aside className="panel exam-nav-panel">{navPanel(setCurrentIndex)}</aside>

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
              <div className="options reveal-options">
                {(currentQuestion.answers || []).map((opt) => {
                  const classes = ['option']
                  if (opt.id === currentQuestion.correct_answer) classes.push('correct')
                  return (
                    <div key={opt.id} className={classes.join(' ')}>
                      <div className="badge">{opt.label || opt.id}</div>
                      <div>{opt.text || ''}</div>
                    </div>
                  )
                })}
              </div>

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

              <div className="result ok">
                <b>เฉลย</b>
                <br />
                คำตอบที่ถูก:{' '}
                <b>
                  {correct ? `${correct.label}. ${correct.text}` : currentQuestion.correct_answer}
                </b>
                {currentQuestion.explanation ? (
                  <>
                    <hr style={{ border: 0, borderTop: '1px solid rgba(0,0,0,.12)' }} />
                    {currentQuestion.explanation}
                  </>
                ) : null}
              </div>
            </section>
          </div>
        </main>
      </div>

      <nav className="exam-navbar">
        <span className="exam-meta">
          ข้อ <b>{currentIndex + 1}</b>/{questions.length} · มีรูปแล้ว{' '}
          <b>{questions.filter((q) => !!imagePath(q)).length}</b>
        </span>
        <button type="button" className="primary" onClick={() => setNavOpen(true)}>
          เลือกข้อ / ค้นหา
        </button>
      </nav>

      {navOpen ? (
        <div className="sheet-backdrop" onClick={() => setNavOpen(false)}>
          <div
            className="exam-sheet"
            role="dialog"
            aria-label="เลือกข้อ"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-head">
              <span>เลือกข้อ / ค้นหา</span>
              <button type="button" onClick={() => setNavOpen(false)}>
                ปิด
              </button>
            </div>
            {navPanel((i) => {
              setCurrentIndex(i)
              setNavOpen(false)
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
