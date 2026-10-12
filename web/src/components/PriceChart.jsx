import { useState } from 'react'
import { useWidth } from '../hooks'
import { rm, shortDate } from '../format'

const H = 200
const PAD = { top: 14, right: 14, bottom: 26, left: 46 }

// Round tick steps (0.5, 1, 2, 5 ...) so the axis reads RM 8.00, 8.50, 9.00.
function ticks(lo, hi, count = 4) {
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const out = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(2))
  return out
}

/** Weekly price line, with the item's usual range shaded behind it. */
export function PriceChart({ history, band }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const values = history.map((h) => h.price).concat(band ? [band.low, band.high] : [])
  const min = Math.min(...values), max = Math.max(...values)
  const pad = (max - min || 1) * 0.12
  const lo = min - pad, hi = max + pad

  const innerW = Math.max(0, width - PAD.left - PAD.right)
  const innerH = H - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (history.length > 1 ? (i / (history.length - 1)) * innerW : innerW / 2)
  const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH

  const path = history.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.price).toFixed(1)}`).join('')
  // One label per month, on the first week that falls in it.
  const months = history
    .map((h, i) => ({ i, m: h.week.slice(0, 7) }))
    .filter((d, k, arr) => k === 0 || d.m !== arr[k - 1].m)

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    const i = Math.round(((px - PAD.left) / innerW) * (history.length - 1))
    setHover(Math.min(history.length - 1, Math.max(0, i)))
  }

  const last = history.length - 1
  const shown = hover ?? last
  const summary = `Weekly price from ${shortDate(history[0].week)} to ${shortDate(history[last].week)}, ` +
    `now ${rm(history[last].price)}` + (band ? `, usual range ${rm(band.low)} to ${rm(band.high)}` : '')

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={summary}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks(lo, hi).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="axis">{t.toFixed(2)}</text>
            </g>
          ))}
          {months.map(({ i, m }) => (
            <text key={m} x={x(i)} y={H - 6} textAnchor="middle" className="axis">
              {new Date(m + '-01T00:00:00').toLocaleDateString('en-MY', { month: 'short' })}
            </text>
          ))}
          {band && (
            <g>
              <rect x={PAD.left} width={innerW} y={y(band.high)} height={Math.max(1, y(band.low) - y(band.high))} className="band" />
              <text x={width - PAD.right - 4} y={y(band.high) - 5} textAnchor="end" className="axis">usual range</text>
            </g>
          )}
          <path d={path} className="line" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="cross" />}
          <circle cx={x(shown)} cy={y(history[shown].price)} r="4.5" className="dot" />
        </svg>
      )}
      <p className="chart-read">
        <b>{rm(history[shown].price)}</b> week of {shortDate(history[shown].week)} · {history[shown].shops} shops
      </p>
    </div>
  )
}