import { compareBasket } from '../api'
import { useBasket } from '../basket'
import { useFetch } from '../hooks'
import { nice, rm, unitText } from '../format'

export function Basket({ district, onBack, onOpen, wide }) {
  const { items, remove, clear } = useBasket()
  const codes = items.map((i) => i.code)

  // Ask the API again whenever the basket or the district changes.
  const { data, error, loading } = useFetch(
    (signal) => (codes.length ? compareBasket(district, codes, signal) : Promise.resolve(null)),
    [codes.join(','), district],
  )

  const arrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  )

  return (
    <div className="detail">
      {wide ? (
        <div className="detail-head"><button className="backlink" onClick={onBack}>{arrow}Overview of {district}</button></div>
      ) : (
        <div className="bar"><button className="back" onClick={onBack} aria-label="Back">{arrow}</button><span className="ttl">My basket</span></div>
      )}

      <div className="screen">
        <section className="sec">
          <div className="sechead">
            <h2>{wide ? 'My basket' : `${items.length} item${items.length === 1 ? '' : 's'}`}</h2>
            {items.length > 0 && <button className="linkbtn" onClick={clear}>Clear all</button>}
          </div>
          {items.length === 0 ? (
            <p className="empty">Your basket is empty. Open any item and tap “Add to basket”.</p>
          ) : (
            <div className="list">
              {items.map((i) => (
                <div key={i.code} className="li">
                  <button className="t" onClick={() => onOpen(i.code)}>
                    <b>{nice(i.name)}</b><span>{unitText(i.unit)}</span>
                  </button>
                  <button className="remove" onClick={() => remove(i.code)} aria-label={`Remove ${nice(i.name)}`}>×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <p className="empty">{error}</p>}
        {loading && !data && items.length > 0 && <p className="empty">Comparing shops…</p>}
        {data && <Comparison data={data} district={district} />}
      </div>
    </div>
  )
}

function Comparison({ data, district }) {
  const best = data.shops[0]
  if (!best) return <p className="empty">No shop in {district} has recent prices for these items.</p>

  const n = data.items_requested
  const complete = data.shops.filter((s) => s.complete)
  const mixCoversAll = data.cheapest_mix_covers === n
  const mixSaving = best.complete && mixCoversAll ? best.total - data.cheapest_mix_total : 0

  return (
    <>
      <div className="winner">
        <span className="lbl">{best.complete ? 'CHEAPEST SINGLE SHOP' : 'NO SHOP HAS EVERYTHING'}</span>
        <div className="row between wrap">
          <span className="st">{nice(best.shop)}</span>
          <span className="pp">{rm(best.total)}</span>
        </div>
        <span className="sv">
          {best.complete
            ? `Has all ${n} items.`
            : `Has ${best.items_found} of ${n}. Missing: ${best.missing.map(nice).join(', ')}.`}
        </span>
      </div>

      {mixSaving >= 0.5 && (
        <p className="tip">
          Buying each item wherever it is cheapest in {district} costs <b>{rm(data.cheapest_mix_total)}</b>,
          saving <b>{rm(mixSaving)}</b> if you don't mind visiting more than one shop.
        </p>
      )}

      <section className="sec">
        <div className="sechead">
          <h2>All shops compared</h2>
          <span className="muted small">{complete.length} of {data.shops.length} shown have everything</span>
        </div>
        <div className="list">
          {data.shops.map((s, k) => (
            <div key={s.shop} className={`srow ${k === 0 ? 'best' : ''}`}>
              <span className="rank">{k + 1}</span>
              <span className="t">
                <b>{nice(s.shop)}</b>
                <span>{s.complete ? `All ${n} items` : `Missing ${s.missing.length}: ${s.missing.map(nice).join(', ')}`}</span>
              </span>
              <span className="r">
                <b>{rm(s.total)}</b>
                {s.complete && k > 0 && best.complete && <span className="dear-t">+{rm(s.total - best.total)}</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="muted small">Shops missing items are listed after complete ones, so a lower total there isn't a cheaper trip.</p>
      </section>
    </>
  )
}