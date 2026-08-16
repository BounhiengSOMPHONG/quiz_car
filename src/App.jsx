import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import QuizView from './components/QuizView'
import AdminPage from './pages/AdminPage'
import AdminQuizPage from './pages/AdminQuizPage'
import ExamPage from './pages/ExamPage'
import LoginPage from './pages/LoginPage'
import TesterPage from './pages/TesterPage'
import './App.css'

function HomeRedirect() {
  const { user, booting, homePath } = useAuth()

  if (booting) {
    return <div className="loading">กำลังโหลด...</div>
  }

  return <Navigate to={user ? homePath : '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/tester"
            element={
              <ProtectedRoute role="tester">
                <TesterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tester/exam"
            element={
              <ProtectedRoute role="tester">
                <ExamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tester/practice"
            element={
              <ProtectedRoute role="tester">
                <QuizView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/quiz"
            element={
              <ProtectedRoute role="admin">
                <AdminQuizPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
