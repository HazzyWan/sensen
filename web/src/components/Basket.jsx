import { compareBasket } from '../api'
import { useBasket } from '../BasketContext'
import { useFetch } from '../hooks'
import { useLang } from '../i18n'
import { nice, rm, unitText } from '../format'

export function Basket({ district, onBack, onOpen, wide }) {
  const { t } = useLang()
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
        <div className="detail-head"><button className="backlink" onClick={onBack}>{arrow}{t('overviewOf', { d: district })}</button></div>
      ) : (
        <div className="bar"><button className="back" onClick={onBack} aria-label={t('back')}>{arrow}</button><span className="ttl">{t('myBasket')}</span></div>
      )}

      <div className="screen">
        <section className="sec">
          <div className="sechead">
            <h2>{wide ? t('myBasket') : t('itemCount', { n: items.length })}</h2>
            {items.length > 0 && <button className="linkbtn" onClick={clear}>{t('clearAll')}</button>}
          </div>
          {items.length === 0 ? (
            <p className="empty">{t('basketEmpty')}</p>
          ) : (
            <div className="list">
              {items.map((i) => (
                <div key={i.code} className="li">
                  <button className="t" onClick={() => onOpen(i.code)}>
                    <b>{nice(i.name)}</b><span>{unitText(i.unit, t)}</span>
                  </button>
                  <button className="remove" onClick={() => remove(i.code)} aria-label={t('removeAria', { x: nice(i.name) })}>×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <p className="empty">{error}</p>}
        {loading && !data && items.length > 0 && <p className="empty">{t('comparing')}</p>}
        {data && <Comparison data={data} district={district} />}
      </div>
    </div>
  )
}

function Comparison({ data, district }) {
  const { t } = useLang()
  const best = data.shops[0]
  if (!best) return <p className="empty">{t('noShop', { d: district })}</p>

  const n = data.items_requested
  const complete = data.shops.filter((s) => s.complete)
  const mixCoversAll = data.cheapest_mix_covers === n
  const mixSaving = best.complete && mixCoversAll ? best.total - data.cheapest_mix_total : 0

  return (
    <>
      <div className="winner">
        <span className="lbl">{best.complete ? t('cheapestSingle') : t('noneHasAll')}</span>
        <div className="row between wrap">
          <span className="st">{nice(best.shop)}</span>
          <span className="pp">{rm(best.total)}</span>
        </div>
        <span className="sv">
          {best.complete
            ? t('hasAll', { n })
            : t('hasSome', { f: best.items_found, n, m: best.missing.map(nice).join(', ') })}
        </span>
      </div>

      {mixSaving >= 0.5 && (
        <p className="tip">{t('mixTip', { d: district, t: rm(data.cheapest_mix_total), s: rm(mixSaving) })}</p>
      )}

      <section className="sec">
        <div className="sechead">
          <h2>{t('allCompared')}</h2>
          <span className="muted small">{t('completeCount', { c: complete.length, n: data.shops.length })}</span>
        </div>
        <div className="list">
          {data.shops.map((s, k) => (
            <div key={s.shop} className={`srow ${k === 0 ? 'best' : ''}`}>
              <span className="rank">{k + 1}</span>
              <span className="t">
                <b>{nice(s.shop)}</b>
                <span>{s.complete ? t('allItems', { n }) : t('missingN', { k: s.missing.length, m: s.missing.map(nice).join(', ') })}</span>
              </span>
              <span className="r">
                <b>{rm(s.total)}</b>
                {s.complete && k > 0 && best.complete && <span className="dear-t">+{rm(s.total - best.total)}</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="muted small">{t('missingNote')}</p>
      </section>
    </>
  )
}