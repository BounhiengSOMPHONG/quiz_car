export const AUTH_SESSION_KEY = 'driving_quiz_session'
export const USERS_URL = '/users.json'

export function answersKey(username) {
  return `driving_quiz_answers_${username}`
}

export function attemptsKey(username) {
  return `driving_quiz_attempts_${username}`
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(user) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY)
}

export async function fetchUsers() {
  const res = await fetch(USERS_URL)
  if (!res.ok) {
    throw new Error(`โหลด users.json ไม่สำเร็จ (${res.status})`)
  }
  const data = await res.json()
  return data.users || []
}

export async function login(username, password) {
  const users = await fetchUsers()
  const found = users.find(
    (u) => u.username === username.trim() && u.password === password,
  )
  if (!found) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }

  const session = {
    username: found.username,
    role: found.role,
    displayName: found.displayName || found.username,
  }
  saveSession(session)
  return session
}

export function homePathForRole(role) {
  return role === 'admin' ? '/admin' : '/tester'
}
