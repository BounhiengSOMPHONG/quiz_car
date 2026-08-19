import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuestions } from '../api'
import { useAuth } from '../auth/AuthContext'
import { answersKey, attemptsKey } from '../auth/auth'
import ThemeToggle from '../components/ThemeToggle'
import {
  EXAM_QUESTION_COUNT,
  categoryTitle,
  imagePath,
  qid,
  resolveImageUrl,
  shuffleArray,
} from '../utils'

function loadAttempts(username) {
  try {
    return JSON.parse(localStorage.getItem(attemptsKey(username)) || '[]')
  } catch {
    return []
  }
}

function saveAttempts(username, list) {
  localStorage.setItem(attemptsKey(username), JSON.stringify(list))
}

function loadAnswers(username) {
  try {
    return JSON.parse(localStorage.getItem(answersKey(username)) || '{}')
  } catch {
    return {}
  }
}

function saveAnswers(username, answers) {
  localStorage.setItem(answersKey(username), JSON.stringify(answers))
}

// ข้อความเกณฑ์ผ่าน: ใช้จำนวนข้อที่ผิดได้สูงสุดถ้ากำหนดไว้ (max_wrong)
// ไม่เช่นนั้นคิดเป็นเปอร์เซ็นต์เหมือนเดิม
function passRuleText(settings, total) {
  const maxWrong = settings?.max_wrong
  if (maxWrong != null) {
    return `ห้ามผิดเกิน ${maxWrong} ข้อ (ต้องได้อย่างน้อย ${total - maxWrong}/${total} ข้อ)`
  }
  const percent = settings?.pass_score_percent ?? 80
  return `${percent}% (ต้องได้อย่างน้อย ${Math.ceil((total * percent) / 100)}/${total} ข้อ)`
}

// ริงแสดงเปอร์เซ็นต์คะแนน พร้อมตัวเลขค่อย ๆ นับขึ้น
function ScoreRing({ percent, pass }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf
    const start = performance.now()
    const duration = 700

    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      setDisplay(Math.round(percent * p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [percent])

  const R = 52
  const C = 2 * Math.PI * R
  const filled = (display / 100) * C

  return (
    <div className={`score-ring ${pass ? 'ok' : 'bad'}`} role="img" aria-label={`${percent}%`}>
      <svg viewBox="0 0 120 120">
        <circle className="ring-track" cx="60" cy="60" r={R} />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={`${filled} ${C - filled}`}
        />
      </svg>
      <div className="ring-label">
        <b>{display}%</b>
        <span>{pass ? 'ผ่าน' : 'ไม่ผ่าน'}</span>
      </div>
    </div>
  )
}

export default function ExamPage() {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('start')
  const [exam, setExam] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
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

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setImageError(false)
  }, [currentIndex, phase])

  function startExam() {
    const settings = data?.settings || {}
    let picked = (data?.questions || []).filter((q) => q.active !== false)
    if (settings.shuffle_questions) picked = shuffleArray(picked)
    picked = picked.slice(0, EXAM_QUESTION_COUNT)
    // สลับตัวเลือกครั้งเดียวตอนเริ่มสอบ เพื่อให้ปุ่ม ก่อนหน้า/ถัดไป เห็นลำดับเดิม
    const shuffled = picked.map((q) =>
      settings.shuffle_answers ? { ...q, answers: shuffleArray(q.answers || []) } : q,
    )
    setExam(shuffled)
    setAnswers({})
    setCurrentIndex(0)
    setResult(null)
    setNavOpen(false)
    setPhase('running')
  }

  function chooseAnswer(answerId) {
    const q = exam[currentIndex]
    if (!q) return
    setAnswers((prev) => ({ ...prev, [qid(q)]: answerId }))
  }

  function submitExam() {
    const total = exam.length
    const unanswered = total - Object.keys(answers).length
    if (unanswered > 0 && !window.confirm(`ยังไม่ได้ตอบ ${unanswered} ข้อ ต้องการส่งคำตอบหรือไม่?`)) {
      return
    }
    const items = exam.map((q) => {
      const chosen = answers[qid(q)] ?? null
      return { qid: qid(q), chosen, correct: q.correct_answer, isCorrect: chosen === q.correct_answer }
    })
    const score = items.filter((i) => i.isCorrect).length
    const maxWrong = data?.settings?.max_wrong
    // เกณฑ์ผ่าน: ผิดไม่เกิน max_wrong ข้อ (ถ้ากำหนดไว้) ไม่เช่นนั้นใช้เปอร์เซ็นต์
    const pass =
      maxWrong != null
        ? total - score <= maxWrong
        : score >= Math.ceil((total * (data?.settings?.pass_score_percent ?? 80)) / 100)

    const attempt = {
      id: Date.now(),
      date: new Date().toISOString(),
      total,
      score,
      pass,
      items,
    }
    saveAttempts(user.username, [attempt, ...loadAttempts(user.username)].slice(0, 20))
    // รวมคำตอบของข้อสอบเข้า answers เดิม เพื่อให้แดชบอร์ด admin นับได้
    // (คำตอบจากข้อสอบจะทับคำตอบโหมดฝึกซ้อมของข้อเดียวกัน — ตั้งใจให้เป็นแบบนี้)
    const merged = { ...loadAnswers(user.username) }
    for (const it of items) merged[it.qid] = it.chosen
    saveAnswers(user.username, merged)

    setResult({ attempt })
    setPhase('review')
  }

  if (loading) {
    return <div className="loading">กำลังโหลดคำถาม...</div>
  }

  if (error || !data) {
    return (
      <div className="error">
        <p>{error || 'ไม่พบคำถาม'}</p>
      </div>
    )
  }

  if (phase === 'start') {
    return (
      <div className="wrap">
        <div className="topbar">
          <div>
            <h1>{data.title || 'Driving Quiz'}</h1>
            <div className="small">
              ผู้ใช้: <b>{user.displayName}</b> ({user.role})
            </div>
          </div>
          <div className="actions">
            <Link to="/tester" className="btn-link">
              หน้าแรก
            </Link>
            <button type="button" onClick={logout}>
              ออกจากระบบ
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="panel exam-start">
          <h2>แบบทดสอบ {EXAM_QUESTION_COUNT} ข้อ</h2>
          <ul className="exam-rules">
            <li>ระบบสุ่มคำถามมา {EXAM_QUESTION_COUNT} ข้อจากทั้งหมด</li>
            <li>ตรวจถูก/ผิดเมื่อส่งคำตอบเท่านั้น (เหมือนสอบจริง)</li>
            <li>
              เกณฑ์ผ่าน: <b>{passRuleText(data.settings, EXAM_QUESTION_COUNT)}</b>
            </li>
          </ul>
          <button type="button" className="primary big" onClick={startExam}>
            เริ่มทำข้อสอบ
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'review' && result) {
    const { attempt } = result
    const showExplanation = data.settings?.show_explanation_after_answer
    const percent = Math.round((attempt.score / attempt.total) * 100)
    const wrong = attempt.items.filter((i) => !i.isCorrect && i.chosen !== null).length
    const unansweredCount = attempt.items.filter((i) => i.chosen === null).length

    return (
      <div className="wrap">
        <div className="topbar">
          <div>
            <h1>สรุปผลการสอบ</h1>
            <div className="small">
              ผู้ใช้: <b>{user.displayName}</b> ({user.role})
            </div>
          </div>
          <div className="actions">
            <Link to="/tester" className="btn-link">
              หน้าแรก
            </Link>
            <button type="button" onClick={logout}>
              ออกจากระบบ
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="score-card panel">
          <ScoreRing percent={percent} pass={attempt.pass} />
          <div className="score-summary">
            <div className={`score-result ${attempt.pass ? 'ok' : 'bad'}`}>
              {attempt.pass ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}
            </div>
            <div className="small">เกณฑ์ผ่าน {passRuleText(data.settings, attempt.total)}</div>
            <div className="stats">
              <div className="stat">
                <span>ถูก</span>
                <b>{attempt.score}</b>
              </div>
              <div className="stat">
                <span>ผิด</span>
                <b>{wrong}</b>
              </div>
              <div className="stat">
                <span>ไม่ตอบ</span>
                <b>{unansweredCount}</b>
              </div>
              <div className="stat">
                <span>คะแนนรวม</span>
                <b>
                  {attempt.score}/{attempt.total}
                </b>
              </div>
            </div>
          </div>
        </div>

        <div className="exam-actions">
          <button type="button" className="primary" onClick={startExam}>
            เริ่มใหม่
          </button>
          <span className="small">สุ่มชุดคำถามใหม่</span>
        </div>

        <div className="review-list">
          {exam.map((q, i) => {
            const it = attempt.items[i]
            const path = imagePath(q)
            const imageUrl = resolveImageUrl(path)
            const chosenOpt = (q.answers || []).find((a) => a.id === it.chosen)
            const correctOpt = (q.answers || []).find((a) => a.id === q.correct_answer)
            return (
              <div key={qid(q)} className={`review-item ${it.isCorrect ? 'ok' : 'bad'}`}>
                <div className="review-head">
                  <span className="review-num">
                    {i + 1}. {qid(q)}
                  </span>
                  <span className={`review-badge ${it.isCorrect ? 'ok' : 'bad'}`}>
                    {it.isCorrect ? 'ถูก' : 'ผิด'}
                  </span>
                </div>
                <div className="question">{q.question || ''}</div>

                {imageUrl ? (
                  <img
                    className="thumb"
                    src={imageUrl}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : null}

                <div className="review-answer">
                  <div>
                    คำตอบของคุณ:{' '}
                    <b>
                      {chosenOpt
                        ? `${chosenOpt.label || chosenOpt.id}. ${chosenOpt.text}`
                        : 'ไม่ได้ตอบ'}
                    </b>
                  </div>
                  {!it.isCorrect ? (
                    <div>
                      คำตอบที่ถูก:{' '}
                      <b>
                        {correctOpt ? `${correctOpt.label || correctOpt.id}. ${correctOpt.text}` : q.correct_answer}
                      </b>
                    </div>
                  ) : null}
                </div>

                {showExplanation && q.explanation ? (
                  <div className="review-explanation">{q.explanation}</div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // phase === 'running'
  const currentQuestion = exam[currentIndex]
  if (!currentQuestion) {
    return (
      <div className="error">
        <p>ไม่พบคำถามสำหรับทำข้อสอบ</p>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length
  const unanswered = exam.length - answeredCount
  const selected = answers[qid(currentQuestion)] || null
  const path = imagePath(currentQuestion)
  const imageUrl = resolveImageUrl(path)

  const renderQnav = (onSelect) =>
    exam.map((q, i) => {
      const classes = ['qbtn']
      if (i === currentIndex) classes.push('active')
      if (answers[qid(q)]) classes.push('answered')
      return (
        <button
          key={qid(q)}
          type="button"
          className={classes.join(' ')}
          onClick={() => onSelect(i)}
        >
          {i + 1}
        </button>
      )
    })

  return (
    <div className="wrap exam-run">
      <div className="topbar exam-run-topbar">
        <div>
          <h1>แบบทดสอบ</h1>
          <div className="small">
            ผู้ใช้: <b>{user.displayName}</b> ({user.role}) · ตรวจคำตอบเมื่อส่งเท่านั้น
          </div>
        </div>
        <div className="actions">
          <span className="exam-meta">
            ตอบแล้ว <b>{answeredCount}</b>/{exam.length} · ยังไม่ตอบ <b>{unanswered}</b>
          </span>
          <Link to="/tester" className="btn-link">
            หน้าแรก
          </Link>
          <button type="button" className="primary" onClick={submitExam}>
            ส่งคำตอบ
          </button>
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="grid">
        <aside className="panel exam-nav-panel">
          <div className="small">เลือกคำตอบได้ทุกข้อ และย้อนแก้ได้ก่อนส่ง</div>
          <div className="qnav">{renderQnav(setCurrentIndex)}</div>
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
                    {path ? (imageError ? 'ไม่พบไฟล์รูป' : 'กำลังโหลดรูป...') : 'ยังไม่มีรูปสำหรับข้อนี้'}
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="options">
                {(currentQuestion.answers || []).map((opt) => {
                  const classes = ['option']
                  if (selected === opt.id) classes.push('selected')
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
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(exam.length - 1, i + 1))
                  }
                  disabled={currentIndex >= exam.length - 1}
                >
                  ถัดไป
                </button>
              </div>

              {currentIndex >= exam.length - 1 ? (
                <button
                  type="button"
                  className="primary"
                  style={{ width: '100%', marginTop: '12px' }}
                  onClick={submitExam}
                >
                  ส่งคำตอบ
                </button>
              ) : null}
            </section>
          </div>
        </main>
      </div>

      <nav className="exam-navbar">
        <span className="exam-meta">
          ตอบแล้ว <b>{answeredCount}</b>/{exam.length} · ยังไม่ตอบ <b>{unanswered}</b>
        </span>
        <button type="button" className="primary" onClick={() => setNavOpen(true)}>
          เลือกข้อ
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
              <span>
                เลือกข้อ · ตอบแล้ว {answeredCount}/{exam.length}
              </span>
              <button type="button" onClick={() => setNavOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="qnav">
              {renderQnav((i) => {
                setCurrentIndex(i)
                setNavOpen(false)
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
