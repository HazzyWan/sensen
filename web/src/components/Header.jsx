import { shortDate } from '../format'

export function Header({ areas, district, onDistrict, query, onQuery, meta, wide }) {
  return (
    <header className={wide ? 'topbar' : 'top'}>
      <div className="row between">
        <div className="row brand-row">
          {wide && <span className="brand">Sen<span>Sen</span></span>}
          <DistrictPicker areas={areas} value={district} onChange={onDistrict} />
        </div>
        {meta && <span className="pill soft">Week of {shortDate(meta.latest_week)}</span>}
      </div>
      {!wide && <h1 className="hello">What are you buying today?</h1>}
      {district && <SearchBox value={query} onChange={onQuery} />}
    </header>
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

function SearchBox({ value, onChange }) {
  return (
    <label className="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Search chicken, telur, beras…" aria-label="Search items" autoComplete="off"
      />
    </label>
  )
}