import { Link } from 'react-router-dom'
import { Gamepad2, GraduationCap } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { attemptsKey } from '../auth/auth'
import ThemeToggle from '../components/ThemeToggle'
import { EXAM_QUESTION_COUNT } from '../utils'

function loadAttempts(username) {
  try {
    return JSON.parse(localStorage.getItem(attemptsKey(username)) || '[]')
  } catch {
    return []
  }
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export default function TesterPage() {
  const { user, logout } = useAuth()
  const attempts = loadAttempts(user.username)

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>หน้าแรก</h1>
          <div className="small">
            ผู้ใช้: <b>{user.displayName}</b> ({user.role})
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="panel landing">
        <div className="landing-hero">
          <div className="landing-icon">
            <GraduationCap size={24} strokeWidth={2} />
          </div>
          <div>
            <h2>ยินดีต้อนรับ, {user.displayName}</h2>
            <p className="small">
              เลือกโหมดด้านล่าง — โหมดสอบจะสุ่มคำถาม {EXAM_QUESTION_COUNT} ข้อและตรวจคำตอบเมื่อส่งเท่านั้น
            </p>
          </div>
        </div>
        <div className="landing-actions">
          <Link to="/tester/exam" className="btn-link primary-link big-link">
            เริ่มแบบทดสอบ {EXAM_QUESTION_COUNT} ข้อ
          </Link>
          <Link to="/tester/practice" className="btn-link big-link">
            โหมดฝึกซ้อม (ดูเฉลยทันที)
          </Link>
          <Link to="/tester/game" className="btn-link big-link">
            <Gamepad2 size={18} strokeWidth={2} />
            โหมดเกม (รู้ผลทันที · ผิดเกิน 10 = แพ้)
          </Link>
        </div>
      </div>

      <section className="panel">
        <h2>ประวัติการสอบ</h2>
        {attempts.length === 0 ? (
          <p className="small">ยังไม่เคยทำข้อสอบ — กดเริ่มแบบทดสอบด้านบนเพื่อลองทำ</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ครั้งที่</th>
                  <th>วัน/เวลา</th>
                  <th>คะแนน</th>
                  <th>ผล</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a, i) => (
                  <tr key={a.id || i}>
                    <td>{attempts.length - i}</td>
                    <td>{formatDate(a.date)}</td>
                    <td>
                      {a.score}/{a.total}
                    </td>
                    <td>
                      <span className={`role-badge ${a.pass ? 'admin' : 'tester'}`}>
                        {a.pass ? 'ผ่าน' : a.mode === 'game' ? 'แพ้' : 'ไม่ผ่าน'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
