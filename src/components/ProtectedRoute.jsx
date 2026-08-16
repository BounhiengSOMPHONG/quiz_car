import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute({ children, role }) {
  const { user, booting } = useAuth()
  const location = useLocation()

  if (booting) {
    return <div className="loading">กำลังตรวจสอบสิทธิ์...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/tester'} replace />
  }

  return children
}
