import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { homePathForRole } from '../auth/auth'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const target = location.state?.from || homePathForRole(user.role)
    return <Navigate to={target} replace />
  }

  async function performLogin(u, p) {
    setUsername(u)
    setPassword(p)
    setError('')
    setSubmitting(true)

    try {
      const session = await login(u, p)
      const target = location.state?.from || homePathForRole(session.role)
      navigate(target, { replace: true })
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await performLogin(username, password)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Driving Quiz</h1>
        <p className="small">เข้าสู่ระบบเพื่อทำแบบทดสอบ</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>ชื่อผู้ใช้</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tester หรือ admin"
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>รหัสผ่าน</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <div className="login-error">{error}</div> : null}

          <button type="submit" className="primary login-submit" disabled={submitting}>
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="login-quick">
          <div className="login-divider">บัญชีทดสอบ</div>
          <div className="quick-buttons">
            <button
              type="button"
              className="quick-btn tester"
              disabled={submitting}
              onClick={() => performLogin('tester', 'test123')}
            >
              <b>Tester</b>
              <span>tester / test123</span>
            </button>
            <button
              type="button"
              className="quick-btn admin"
              disabled={submitting}
              onClick={() => performLogin('admin', 'admin123')}
            >
              <b>Admin</b>
              <span>admin / admin123</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
