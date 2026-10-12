// Small display helpers shared by every screen.

// "AYAM BERSIH - STANDARD" -> "Ayam Bersih - Standard"
export const nice = (s) =>
  s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())

export const rm = (v) => `RM ${v.toFixed(2)}`

// "1kg" reads better as "per kg" / "sekilo"; other units (30 biji, 500g) stay as they are.
export const unitText = (u, t) => (u === '1kg' ? t('perKg') : u)

const LOCALE = { en: 'en-MY', ms: 'ms-MY' }

// "2026-09-24" -> "24 Sep" (English) or "24 Sep" / "24 Sept" style in BM
export const shortDate = (iso, lang = 'en') =>
  new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })

export const monthName = (iso, lang = 'en') =>
  new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE[lang], { month: 'short' })

export const pct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`

export const LABEL_CLASS = { Low: 'save', High: 'dear', Normal: 'soft' }