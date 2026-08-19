import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'dq-theme'
const ThemeContext = createContext(null)

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// โหมด: 'light' | 'dark' | 'system' (ตามระบบเครื่อง) — จดจำใน localStorage
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })

  useEffect(() => {
    function apply() {
      const dark = mode === 'system' ? systemPrefersDark() : mode === 'dark'
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#f4f6fb')
    }

    apply()
    localStorage.setItem(STORAGE_KEY, mode)

    // ตอบสนองทันทีถ้าโหมดตามระบบและเครื่องเปลี่ยนธีมกลางคัน
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [mode])

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
