import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'

const LABELS = {
  light: 'ธีม: สว่าง (กดเพื่อสลับเป็นมืด)',
  dark: 'ธีม: มืด (กดเพื่อสลับเป็นตามระบบ)',
  system: 'ธีม: ตามระบบ (กดเพื่อสลับเป็นตรงข้ามกับที่เห็น)',
}

export default function ThemeToggle() {
  const { mode, setMode } = useTheme()

  function nextMode() {
    // กดครั้งแรกจาก "ตามระบบ": สลับไปโหมดตรงข้ามกับที่เห็นอยู่
    // (ผู้ใช้กดปุ่มธีมย่อมอยากเห็นผลทันที) แล้ววน light -> dark -> system
    if (mode === 'system') {
      const showingDark = document.documentElement.getAttribute('data-theme') === 'dark'
      return showingDark ? 'light' : 'dark'
    }
    return mode === 'light' ? 'dark' : 'system'
  }

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor

  return (
    <button
      type="button"
      className="icon-btn"
      title={LABELS[mode]}
      aria-label={LABELS[mode]}
      onClick={() => setMode(nextMode())}
    >
      <Icon size={17} strokeWidth={2} />
    </button>
  )
}
