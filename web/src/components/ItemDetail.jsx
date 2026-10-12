import { getItem } from '../api'
import { useFetch } from '../hooks'
import { LABEL_CLASS, nice, rm, shortDate, unitText } from '../format'
import { PriceChart } from './PriceChart'

const SENTENCE = {
  Low: 'Cheaper than usual right now. A good week to buy.',
  Normal: 'About the usual price.',
  High: 'Dearer than usual right now. Buy less or wait if you can.',
}

export function ItemDetail({ code, district, onClose, wide }) {
  const { data: d, error, loading } = useFetch((s) => getItem(code, district, s), [code, district])

  const arrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  )
  const bar = wide ? (
    <div className="detail-head">
      <button className="backlink" onClick={onClose}>{arrow}Overview of {district}</button>
    </div>
  ) : (
    <div className="bar">
      <button className="back" onClick={onClose} aria-label="Back">{arrow}</button>
      {d && <span className="ttl">{nice(d.name)}</span>}
    </div>
  )

  if (error) return <div className="detail">{bar}<p className="empty">{error}</p></div>
  if (loading && !d) return <div className="detail">{bar}<p className="empty">Loading…</p></div>

  const best = d.cheapest_shops[0]
  const band = d.label ? { low: d.label.usual_low, high: d.label.usual_high } : null
  const historyWhere = d.history_scope === 'district' ? d.district : `${d.region} (whole region)`

  return (
    <div className="detail">
      {bar}
      <div className="screen">
        <div className="phero">
          <span className="crumb">{nice(d.category)} · {unitText(d.unit)}</span>
          <h1>{nice(d.name)}</h1>

          {best ? (
            <div className="winner">
              <span className="lbl">CHEAPEST IN {d.district.toUpperCase()}</span>
              <div className="row between wrap">
                <span className="st">{nice(best.shop)}</span>
                <span className="pp">{rm(best.price)}</span>
              </div>
              <span className="sv">
                {d.shops_with_price} shops have a recent price · typical here {rm(d.district_median)}
              </span>
            </div>
          ) : (
            <p className="empty">No shop in {district} has a price from the last 2 weeks.</p>
          )}

          {d.label && (
            <div className="verdict">
              <span className={`pill ${LABEL_CLASS[d.label.label]}`}>{d.label.label}</span>
              <div>
                <b>{SENTENCE[d.label.label]}</b>
                <span className="muted small">
                  {rm(d.label.weekly_price)} this week, usually {rm(d.label.usual_low)} to {rm(d.label.usual_high)}
                  {d.label.scope === 'region' ? ` (compared across ${d.region})` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {d.history.length > 1 && (
          <section className="sec">
            <div className="sechead"><h2>Price over 6 months</h2><span className="muted small">{historyWhere}</span></div>
            <div className="card"><PriceChart history={d.history} band={band} /></div>
          </section>
        )}

        {d.cheapest_shops.length > 0 && (
          <section className="sec">
            <div className="sechead"><h2>Cheapest shops</h2><span className="muted small">in {d.district}</span></div>
            <div className="list">
              {d.cheapest_shops.map((s, k) => (
                <div key={s.shop} className={`srow ${k === 0 ? 'best' : ''}`}>
                  <span className="rank">{k + 1}</span>
                  <span className="t"><b>{nice(s.shop)}</b><span>{s.chain} · {shortDate(s.price_date)}</span></span>
                  <span className="r">
                    <b>{rm(s.price)}</b>
                    <span className={k === 0 ? 'save-t' : 'dear-t'}>{k === 0 ? 'Best price' : `+${rm(s.more_than_cheapest)}`}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}