import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuestions } from '../api'
import { useAuth } from '../auth/AuthContext'
import { answersKey, fetchUsers } from '../auth/auth'
import { categoryTitle, imagePath, qid } from '../utils'

function countCorrect(questions, answers) {
  return Object.entries(answers).filter(([id, ans]) => {
    const q = questions.find((item) => qid(item) === id)
    return q && ans === q.correct_answer
  }).length
}

export default function AdminPage() {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [json, userList] = await Promise.all([fetchQuestions(), fetchUsers()])
        if (!cancelled) {
          setData(json)
          setUsers(userList)
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

  const questions = useMemo(() => {
    if (!data?.questions) return []
    return data.questions.filter((q) => q.active !== false)
  }, [data])

  const categoryStats = useMemo(() => {
    const map = new Map()
    for (const q of questions) {
      const title = categoryTitle(data?.categories, q.category_id)
      const prev = map.get(title) || { total: 0, withImage: 0 }
      prev.total += 1
      if (imagePath(q)) prev.withImage += 1
      map.set(title, prev)
    }
    return [...map.entries()]
  }, [questions, data?.categories])

  const userStats = useMemo(() => {
    return users.map((u) => {
      let answers = {}
      try {
        answers = JSON.parse(localStorage.getItem(answersKey(u.username)) || '{}')
      } catch {
        answers = {}
      }
      const answered = Object.keys(answers).length
      const correct = countCorrect(questions, answers)
      return {
        ...u,
        answered,
        correct,
        // เปอร์เซ็นต์คิดจากข้อที่ตอบแล้ว (บางคนตอบแค่ 30 ข้อของข้อสอบ)
        percent: answered ? Math.round((correct / answered) * 100) : 0,
      }
    })
  }, [users, questions])

  if (loading) {
    return <div className="loading">กำลังโหลดแดชบอร์ด...</div>
  }

  if (error || !data) {
    return (
      <div className="error">
        <p>{error || 'โหลดข้อมูลไม่สำเร็จ'}</p>
      </div>
    )
  }

  const withImages = questions.filter((q) => !!imagePath(q)).length

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="small">
            ผู้ดูแล: <b>{user.displayName}</b> · จัดการและติดตามแบบทดสอบ
          </div>
        </div>
        <div className="actions">
          <Link to="/admin/quiz" className="btn-link primary-link">
            แก้ไขคำถาม
          </Link>
          <button type="button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h2>ภาพรวมคำถาม</h2>
          <div className="stats admin-stats">
            <div className="stat">
              <span>คำถามทั้งหมด</span>
              <b>{questions.length}</b>
            </div>
            <div className="stat">
              <span>มีรูปแล้ว</span>
              <b>{withImages}</b>
            </div>
            <div className="stat">
              <span>ยังไม่มีรูป</span>
              <b>{questions.length - withImages}</b>
            </div>
            <div className="stat">
              <span>หมวดหมู่</span>
              <b>{data.categories?.length || 0}</b>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>ผู้ใช้ในระบบ</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>บทบาท</th>
                  <th>ตอบแล้ว</th>
                  <th>ถูก</th>
                  <th>คะแนน</th>
                </tr>
              </thead>
              <tbody>
                {userStats.map((u) => (
                  <tr key={u.username}>
                    <td>{u.displayName}</td>
                    <td>
                      <span className={`role-badge ${u.role}`}>{u.role}</span>
                    </td>
                    <td>{u.answered}</td>
                    <td>{u.correct}</td>
                    <td>{u.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ marginTop: '10px' }}>
            แก้ไขบัญชีได้ที่ <code>public/users.json</code>
          </p>
        </section>

        <section className="panel admin-wide">
          <h2>คำถามตามหมวด</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>หมวด</th>
                  <th>จำนวนข้อ</th>
                  <th>มีรูป</th>
                  <th>ขาดรูป</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map(([title, stat]) => (
                  <tr key={title}>
                    <td>{title}</td>
                    <td>{stat.total}</td>
                    <td>{stat.withImage}</td>
                    <td>{stat.total - stat.withImage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
