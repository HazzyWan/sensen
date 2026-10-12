import { useEffect, useState } from 'react'
import { getAreas, getMeta, searchItems } from './api'
import { nice, rm, shortDate, unitText } from './format'

const DISTRICT_KEY = 'sensen.district'

// localStorage can throw (private mode, blocked storage), so every access is guarded.
const loadDistrict = () => {
  try { return localStorage.getItem(DISTRICT_KEY) ?? '' } catch { return '' }
}
const saveDistrict = (d) => {
  try { localStorage.setItem(DISTRICT_KEY, d) } catch { /* not saved, still works */ }
}

export default function App() {
  const [meta, setMeta] = useState(null)
  const [areas, setAreas] = useState([])
  const [district, setDistrict] = useState(loadDistrict)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getMeta(), getAreas()])
      .then(([m, a]) => { setMeta(m); setAreas(a) })
      .catch((e) => setError(e.message))
  }, [])

  // A saved district that no longer exists (data changed) is cleared.
  useEffect(() => {
    if (areas.length && district && !areas.some((a) => a.district === district)) setDistrict('')
  }, [areas, district])

  const pickDistrict = (d) => { setDistrict(d); saveDistrict(d) }

  return (
    <div className="app">
      <main className="screen">
        <header className="top">
          <div className="row between">
            <DistrictPicker areas={areas} value={district} onChange={pickDistrict} />
            {meta && <span className="pill soft">Week of {shortDate(meta.latest_week)}</span>}
          </div>
          <h1 className="hello">What are you buying today?</h1>
        </header>

        {error && <p className="empty">Could not reach the API: {error}</p>}

        {!error && !district && (
          <p className="empty">Pick your district above to see prices near you.</p>
        )}

        {district && <Search district={district} />}

        <p className="note">
          Prices from PriceCatcher by KPDN and DOSM (CC BY 4.0), checked in person by officers.
        </p>
      </main>
    </div>
  )
}

function DistrictPicker({ areas, value, onChange }) {
  const regions = [...new Set(areas.map((a) => a.region))]
  return (
    <label className="loc">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
      </svg>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Your district">
        <option value="">Choose district</option>
        {regions.map((r) => (
          <optgroup key={r} label={r}>
            {areas.filter((a) => a.region === r).map((a) => (
              <option key={a.district} value={a.district}>{a.district}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function Search({ district }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Wait until typing pauses (250 ms) before asking the API, and cancel the
  // previous request so a slow old answer can't overwrite a newer one.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults(null); return }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      searchItems(term, district, ctrl.signal)
        .then((r) => { setResults(r); setError(null) })
        .catch((e) => { if (e.name !== 'AbortError') setError(e.message) })
        .finally(() => setLoading(false))
    }, 250)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q, district])

  return (
    <section className="sec">
      <label className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search chicken, telur, beras…" aria-label="Search items" autoComplete="off"
        />
      </label>

      {error && <p className="empty">{error}</p>}
      {loading && !results && <p className="empty">Searching…</p>}
      {results && results.length === 0 && (
        <p className="empty">Nothing found for “{q.trim()}” in {district}. Try another word in English or BM.</p>
      )}
      {results && results.length > 0 && (
        <div className="list">
          {results.map((r) => <ResultRow key={r.item_code} r={r} />)}
        </div>
      )}
    </section>
  )
}

const LABEL_CLASS = { Low: 'save', High: 'dear', Normal: 'soft' }

function ResultRow({ r }) {
  return (
    <div className="li">
      <span className="t">
        <b>{nice(r.name)}</b>
        <span>{nice(r.cheapest_shop)} · {unitText(r.unit)} · {shortDate(r.price_date)}</span>
      </span>
      <span className="r">
        <b>{rm(r.cheapest_price)}</b>
        {r.label && (
          <span
            className={`pill ${LABEL_CLASS[r.label]}`}
            title={r.label_scope === 'region' ? 'Compared across the whole region' : 'Compared in your district'}
          >
            {r.label}
          </span>
        )}
      </span>
    </div>
  )
}