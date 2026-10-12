import { getDeals, getMovers, getStores } from '../api'
import { useFetch } from '../hooks'
import { nice, pct, rm, unitText } from '../format'

// "Low this week": items priced below their usual range that you can buy nearby.
export function Deals({ district, selected, onOpen, limit }) {
  const { data, error } = useFetch((s) => getDeals(district, s), [district])
  return (
    <section className="sec">
      <div className="sechead"><h2>Low this week</h2><span className="muted small">Below their usual price</span></div>
      {error && <p className="empty">{error}</p>}
      {data && data.length === 0 && <p className="empty">No items are below their usual range this week.</p>}
      {data && data.length > 0 && (
        <div className="list">
          {data.slice(0, limit).map((d) => (
            <button key={d.item_code} className={`li ${selected === d.item_code ? 'on' : ''}`} onClick={() => onOpen(d.item_code)}>
              <span className="t">
                <b>{nice(d.name)}</b>
                <span>{nice(d.cheapest_shop)} · {unitText(d.unit)}</span>
              </span>
              <span className="r">
                <b>{rm(d.cheapest_price)}</b>
                <span className="pill save">{d.below_usual_pct.toFixed(0)}% below usual</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function Movers({ district, onOpen, columns }) {
  const { data, error } = useFetch((s) => getMovers(district, s), [district])
  if (error) return <p className="empty">{error}</p>
  if (!data) return null
  const where = data.scope === 'region' ? `${data.area} (not enough data for ${district})` : data.area
  return (
    <section className="sec">
      <div className="sechead"><h2>Biggest moves this week</h2><span className="muted small">{where}</span></div>
      <div className={columns ? 'twocol' : 'sec'}>
        <MoverList title="Going up" rows={data.risers} cls="dear" onOpen={onOpen} />
        <MoverList title="Coming down" rows={data.fallers} cls="save" onOpen={onOpen} />
      </div>
    </section>
  )
}

function MoverList({ title, rows, cls, onOpen }) {
  return (
    <div className="card tight">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="muted small">Nothing moved much.</p>}
      {rows.map((m) => (
        <button key={m.item_code} className="mrow" onClick={() => onOpen(m.item_code)}>
          <span className="t"><b>{nice(m.name)}</b><span>{rm(m.price_before)} → {rm(m.price_now)} · {unitText(m.unit)}</span></span>
          <span className={`pill ${cls}`}>{cls === 'dear' ? '▲' : '▼'} {pct(m.change_pct)}</span>
        </button>
      ))}
    </div>
  )
}

// Shops ranked by how their prices compare with the district's usual price.
export function Stores({ district, limit }) {
  const { data, error } = useFetch((s) => getStores(district, s), [district])
  if (error) return <p className="empty">{error}</p>
  if (!data) return null
  const rows = limit ? data.slice(0, limit) : data
  const span = Math.max(5, ...rows.map((r) => Math.abs(r.vs_district_pct)))
  return (
    <section className="sec">
      <div className="sechead"><h2>Cheapest shops in {district}</h2><span className="muted small">vs the usual price here</span></div>
      {rows.length === 0 && <p className="empty">Not enough shops with prices here yet.</p>}
      <div className="card">
        {rows.map((s) => {
          const v = s.vs_district_pct
          const w = (Math.abs(v) / span) * 50
          return (
            <div key={s.shop} className="srank">
              <span className="t"><b>{nice(s.shop)}</b><span>{s.items_compared} items · cheapest on {s.cheapest_on}</span></span>
              <span className="dv" aria-hidden="true">
                <span className="mid" />
                <i className={v < 0 ? 'c' : 'd'} style={{ left: `${v < 0 ? 50 - w : 50}%`, width: `${w}%` }} />
              </span>
              <span className={`v ${v < 0 ? 'save-t' : v > 0 ? 'dear-t' : ''}`}>
                {v === 0 ? 'Usual' : `${Math.abs(v).toFixed(1)}% ${v < 0 ? 'cheaper' : 'dearer'}`}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}