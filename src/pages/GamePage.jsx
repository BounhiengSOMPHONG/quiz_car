import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuestions } from '../api'
import { useAuth } from '../auth/AuthContext'
import { answersKey, attemptsKey } from '../auth/auth'
import ScoreRing from '../components/ScoreRing'
import ThemeToggle from '../components/ThemeToggle'
import { categoryTitle, imagePath, qid, resolveImageUrl, shuffleArray } from '../utils'

const MAX_WRONG = 10

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

// โหมดเกม: ตอบแล้วรู้ผลทันที จำนวนข้อไม่จำกัด — แพ้เมื่อตอบผิดเกิน MAX_WRONG ครั้ง
export default function GamePage() {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('start')
  const [order, setOrder] = useState([])
  const [pointer, setPointer] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [picked, setPicked] = useState({})
  const [result, setResult] = useState(null)
  const [imageError, setImageError] = useState(false)

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
  }, [pointer, phase])

  function startGame() {
    const active = (data?.questions || []).filter((q) => q.active !== false)
    setOrder(shuffleArray(active))
    setPointer(0)
    setChosen(null)
    setAnswered(false)
    setCorrectCount(0)
    setWrongCount(0)
    setStreak(0)
    setBestStreak(0)
    setPicked({})
    setResult(null)
    setPhase('playing')
  }

  function choose(optId) {
    if (answered) return
    const current = order[pointer]
    if (!current) return
    const isCorrect = optId === current.correct_answer
    setChosen(optId)
    setAnswered(true)
    setPicked((prev) => ({ ...prev, [qid(current)]: optId }))
    if (isCorrect) {
      setCorrectCount((c) => c + 1)
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
      setWrongCount((w) => w + 1)
      setStreak(0)
    }
  }

  function next() {
    setPointer((p) => {
      if (p + 1 >= order.length) {
        // วนครบทุกข้อแล้ว — สลับลำดับใหม่เริ่มรอบถัดไป
        setOrder(shuffleArray(order))
        return 0
      }
      return p + 1
    })
    setChosen(null)
    setAnswered(false)
  }

  function finish() {
    // เกมจบ: บันทึกเหมือนโหมดสอบ (ประวัติ + รวมคำตอบให้แดชบอร์ดแอดมิน)
    const seen = correctCount + wrongCount
    const attempt = {
      id: Date.now(),
      date: new Date().toISOString(),
      total: seen,
      score: correctCount,
      pass: false,
      mode: 'game',
      bestStreak,
    }
    saveAttempts(user.username, [attempt, ...loadAttempts(user.username)].slice(0, 20))
    const merged = { ...loadAnswers(user.username), ...picked }
    saveAnswers(user.username, merged)
    setResult({ attempt })
    setPhase('over')
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

  if (phase === 'over' && result) {
    const { attempt } = result
    const percent = Math.round((attempt.score / attempt.total) * 100)
    return (
      <div className="wrap">
        <div className="topbar">
          <div>
            <h1>จบเกม</h1>
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
          <ScoreRing percent={percent} pass={false} label="แพ้" />
          <div className="score-summary">
            <div className="score-result bad">เกมจบ — ตอบผิดเกิน {MAX_WRONG} ครั้ง</div>
            <div className="small">สถิติของคุณ</div>
            <div className="stats">
              <div className="stat">
                <span>ตอบถูก</span>
                <b>{attempt.score}</b>
              </div>
              <div className="stat">
                <span>ตอบผิด</span>
                <b>{wrongCount}</b>
              </div>
              <div className="stat">
                <span>ตอบทั้งหมด</span>
                <b>{attempt.total}</b>
              </div>
              <div className="stat">
                <span>ถูกติดต่อกันสูงสุด</span>
                <b>{attempt.bestStreak}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="exam-actions">
          <button type="button" className="primary" onClick={startGame}>
            เล่นอีกครั้ง
          </button>
          <span className="small">เริ่มเกมใหม่ — สถิติเริ่มจากศูนย์</span>
        </div>
      </div>
    )
  }

  if (phase === 'start') {
    return (
      <div className="wrap">
        <div className="topbar">
          <div>
            <h1>โหมดเกม</h1>
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
          <h2>โหมดเกม</h2>
          <ul className="exam-rules">
            <li>ตอบแล้วรู้ผลทันทีว่าถูกหรือผิด พร้อมเฉลย</li>
            <li>
              ตอบผิดเกิน <b>{MAX_WRONG} ครั้ง</b> = แพ้
            </li>
            <li>จำนวนข้อไม่จำกัด — สุ่มไปเรื่อย ๆ สะสมคำตอบถูกและสถิติติดต่อกัน</li>
          </ul>
          <button type="button" className="primary big" onClick={startGame}>
            เริ่มเกม
          </button>
        </div>
      </div>
    )
  }

  // phase === 'playing'
  const current = order[pointer]
  if (!current) {
    return (
      <div className="error">
        <p>ไม่พบคำถามสำหรับโหมดเกม</p>
      </div>
    )
  }

  const path = imagePath(current)
  const imageUrl = resolveImageUrl(path)
  const correctOpt = (current.answers || []).find((a) => a.id === current.correct_answer)
  const wasCorrect = chosen === current.correct_answer

  return (
    <div className="wrap exam-run">
      <div className="topbar">
        <div>
          <h1>โหมดเกม</h1>
          <div className="small">
            ผู้ใช้: <b>{user.displayName}</b> ({user.role}) · ตอบแล้วรู้ผลทันที · ผิดเกิน{' '}
            {MAX_WRONG} ครั้ง = แพ้
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

      <main className="panel game-main">
        <div className="game-meta">
          <span className="chip ok">ถูก {correctCount}</span>
          <span className="chip bad">
            ผิด {wrongCount}/{MAX_WRONG}
          </span>
          <span className="chip">ติดต่อกัน {streak}</span>
        </div>

        <div className="category">
          {categoryTitle(data.categories, current.category_id)} / {qid(current)}
        </div>
        <div className="question">{current.question || ''}</div>

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
            <div className={`options${answered ? ' reveal-options' : ''}`}>
              {(current.answers || []).map((opt) => {
                const classes = ['option']
                if (answered) {
                  if (opt.id === current.correct_answer) classes.push('correct')
                  // ตัวที่เลือกผิดเท่านั้นถึงจะแดง (เลือกถูกได้แค่คลาส correct)
                  if (opt.id === chosen && opt.id !== current.correct_answer) classes.push('wrong')
                }
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={classes.join(' ')}
                    onClick={() => choose(opt.id)}
                    disabled={answered}
                  >
                    <div className="badge">{opt.label || opt.id}</div>
                    <div>{opt.text || ''}</div>
                  </button>
                )
              })}
            </div>

            {answered ? (
              <>
                <div className={`result ${wasCorrect ? 'ok' : 'bad'}`}>
                  <b>{wasCorrect ? 'ถูกต้อง' : 'ผิด'}</b>
                  {!wasCorrect ? (
                    <>
                      {' '}
                      — คำตอบที่ถูก:{' '}
                      <b>
                        {correctOpt
                          ? `${correctOpt.label}. ${correctOpt.text}`
                          : current.correct_answer}
                      </b>
                    </>
                  ) : null}
                  {current.explanation ? (
                    <>
                      <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
                      {current.explanation}
                    </>
                  ) : null}
                </div>
                <div className="row">
                  {wrongCount > MAX_WRONG ? (
                    <button type="button" className="primary" onClick={finish}>
                      ดูผลลัพธ์
                    </button>
                  ) : (
                    <button type="button" className="primary" onClick={next}>
                      ข้อถัดไป
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </main>

      <nav className="exam-navbar">
        <span className="exam-meta">
          ถูก <b>{correctCount}</b> · ผิด <b>{wrongCount}</b>/{MAX_WRONG} · ติดต่อกัน{' '}
          <b>{streak}</b>
        </span>
      </nav>
    </div>
  )
}
