// Small display helpers shared by every screen.

// "AYAM BERSIH - STANDARD" -> "Ayam Bersih - Standard"
export const nice = (s) =>
  s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())

export const rm = (v) => `RM ${v.toFixed(2)}`

export const unitText = (u) => (u === '1kg' ? 'per kg' : u)

// "2026-09-24" -> "24 Sep"
export const shortDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })

export const pct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`

export const LABEL_CLASS = { Low: 'save', High: 'dear', Normal: 'soft' }