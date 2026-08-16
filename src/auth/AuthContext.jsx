import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearSession,
  homePathForRole,
  loadSession,
  login as loginRequest,
  saveSession,
} from './auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    setUser(loadSession())
    setBooting(false)
  }, [])

  async function login(username, password) {
    const session = await loginRequest(username, password)
    setUser(session)
    return session
  }

  function logout() {
    clearSession()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      isTester: user?.role === 'tester',
      homePath: user ? homePathForRole(user.role) : '/login',
    }),
    [user, booting],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export { saveSession, loadSession }
