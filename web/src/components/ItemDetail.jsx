import { getItem } from '../api'
import { BASKET_MAX, useBasket } from '../BasketContext'
import { useFetch } from '../hooks'
import { useLang } from '../i18n'
import { LABEL_CLASS, nice, rm, shortDate, unitText } from '../format'
import { PriceChart } from './PriceChart'
import { NearMe } from './NearMe'

const SAY = { Low: 'sayLow', Normal: 'sayNormal', High: 'sayHigh' }

export function ItemDetail({ code, district, onClose, wide }) {
  const { t, lang } = useLang()
  const { data: d, error, loading } = useFetch((s) => getItem(code, district, s), [code, district])
  const basket = useBasket()

  const arrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  )
  const bar = wide ? (
    <div className="detail-head">
      <button className="backlink" onClick={onClose}>{arrow}{t('overviewOf', { d: district })}</button>
    </div>
  ) : (
    <div className="bar">
      <button className="back" onClick={onClose} aria-label={t('back')}>{arrow}</button>
      {d && <span className="ttl">{nice(d.name)}</span>}
    </div>
  )

  if (error) return <div className="detail">{bar}<p className="empty">{error}</p></div>
  if (loading && !d) return <div className="detail">{bar}<p className="empty">{t('loading')}</p></div>

  const best = d.cheapest_shops[0]
  const band = d.label ? { low: d.label.usual_low, high: d.label.usual_high } : null
  const historyWhere = d.history_scope === 'district' ? d.district : t('wholeRegion', { r: d.region })

  return (
    <div className="detail">
      {bar}
      <div className="screen">
        <div className="phero">
          <span className="crumb">{nice(d.category)} · {unitText(d.unit, t)}</span>
          <h1>{nice(d.name)}</h1>

          {best ? (
            <div className="winner">
              <span className="lbl">{t('cheapestIn', { d: d.district.toUpperCase() })}</span>
              <div className="row between wrap">
                <span className="st">{nice(best.shop)}</span>
                <span className="pp">{rm(best.price)}</span>
              </div>
              <span className="sv">{t('shopsHavePrice', { n: d.shops_with_price, p: rm(d.district_median) })}</span>
            </div>
          ) : (
            <p className="empty">{d.priced_anywhere ? t('noFresh', { d: district }) : t('notPricedLong')}</p>
          )}

            {d.priced_anywhere && <BasketToggle basket={basket} item={{ code: d.item_code, name: d.name, unit: d.unit }} />}

          {d.label && (
            <div className="verdict">
              <span className={`pill ${LABEL_CLASS[d.label.label]}`}>{t(d.label.label)}</span>
              <div>
                <b>{t(SAY[d.label.label])}</b>
                <span className="muted small">
                  {t('labelDetail', { p: rm(d.label.weekly_price), lo: rm(d.label.usual_low), hi: rm(d.label.usual_high) })}
                  {d.label.scope === 'region' ? t('comparedAcross', { r: d.region }) : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {d.priced_anywhere && <NearMe code={d.item_code} />}
        {d.history.length > 1 && (
          <section className="sec">
            <div className="sechead"><h2>{t('priceHistory')}</h2><span className="muted small">{historyWhere}</span></div>
            <div className="card"><PriceChart history={d.history} band={band} /></div>
          </section>
        )}

        {d.cheapest_shops.length > 0 && (
          <section className="sec">
            <div className="sechead"><h2>{t('cheapestShops')}</h2><span className="muted small">{t('inArea', { d: d.district })}</span></div>
            <div className="list">
              {d.cheapest_shops.map((s, k) => (
                <div key={s.shop} className={`srow ${k === 0 ? 'best' : ''}`}>
                  <span className="rank">{k + 1}</span>
                  <span className="t"><b>{nice(s.shop)}</b><span>{s.chain} · {shortDate(s.price_date, lang)}</span></span>
                  <span className="r">
                    <b>{rm(s.price)}</b>
                    <span className={k === 0 ? 'save-t' : 'dear-t'}>{k === 0 ? t('bestPrice') : `+${rm(s.more_than_cheapest)}`}</span>
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

function BasketToggle({ basket, item }) {
  const { t } = useLang()
  if (basket.has(item.code)) {
    return <button className="btn ghost" onClick={() => basket.remove(item.code)}>{t('inBasket')}</button>
  }
  const full = basket.items.length >= BASKET_MAX
  return (
    <button className="btn" onClick={() => basket.add(item)} disabled={full}>
      {full ? t('basketFull', { n: BASKET_MAX }) : t('addBasket')}
    </button>
  )
}