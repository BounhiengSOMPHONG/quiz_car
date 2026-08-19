import { useEffect, useState } from 'react'

// ริงแสดงเปอร์เซ็นต์คะแนน พร้อมตัวเลขค่อย ๆ นับขึ้น
export default function ScoreRing({ percent, pass, label }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf
    const start = performance.now()
    const duration = 700

    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      setDisplay(Math.round(percent * p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [percent])

  const R = 52
  const C = 2 * Math.PI * R
  const filled = (display / 100) * C

  return (
    <div className={`score-ring ${pass ? 'ok' : 'bad'}`} role="img" aria-label={`${percent}%`}>
      <svg viewBox="0 0 120 120">
        <circle className="ring-track" cx="60" cy="60" r={R} />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={`${filled} ${C - filled}`}
        />
      </svg>
      <div className="ring-label">
        <b>{display}%</b>
        <span>{label ?? (pass ? 'ผ่าน' : 'ไม่ผ่าน')}</span>
      </div>
    </div>
  )
}
