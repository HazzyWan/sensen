import { stepFor, useBasket } from '../BasketContext'
import { useBasketData } from '../basketData'
import { useLang } from '../i18n'
import { nice, qtyText, rm, unitText } from '../format'

// The basket: what you want to buy and which shop is cheapest for all of it.
// The budget planner has its own screen, opened with "Start budgeting".
export function Basket({ district, onBack, onOpen, onBudget, wide }) {
  const { t } = useLang()
  const { items, plan, clear, remove, changeQty } = useBasket()
  const { data, error, loading } = useBasketData(district)

  return (
    <div className="detail">
      <BackBar wide={wide} onBack={onBack} back={t('overviewOf', { d: district })} title={t('myBasket')} />
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
              {items.map((i) => {
                const name = nice(i.name)
                return (
                  <div key={i.code} className="li basket-li">
                    <button className="t" onClick={() => onOpen(i.code)}>
                      <b>{name}</b><span>{unitText(i.unit, t)}</span>
                    </button>
                    <span className="qty">
                      <button onClick={() => changeQty(i.code, -1)} disabled={i.qty <= stepFor(i.unit)} aria-label={t('qtyLess', { x: name })}>−</button>
                      <span>{qtyText(i.qty, i.unit)}</span>
                      <button onClick={() => changeQty(i.code, 1)} aria-label={t('qtyMore', { x: name })}>+</button>
                    </span>
                    <button className="remove" onClick={() => remove(i.code)} aria-label={t('removeAria', { x: name })}>×</button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {items.length > 0 && (
          <button className="budget-cta" onClick={onBudget}>
            <span className="cta-ic" aria-hidden="true">RM</span>
            <span className="cta-t">
              <b>{plan.shopping ? t('continueShopping') : t('startBudget')}</b>
              <span>{plan.shopping ? t('continueShoppingSub') : t('startBudgetSub')}</span>
            </span>
            <span className="cta-go" aria-hidden="true">›</span>
          </button>
        )}

        {error && <p className="empty">{error}</p>}
        {loading && !data && items.length > 0 && <p className="empty">{t('comparing')}</p>}
        {data && <Comparison data={data} district={district} />}
      </div>
    </div>
  )
}

// Back arrow and title: a link-style "back" on laptop, a bar on phone.
export function BackBar({ wide, onBack, back, title }) {
  const { t } = useLang()
  const arrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  )
  return wide
    ? <div className="detail-head"><button className="backlink" onClick={onBack}>{arrow}{back}</button></div>
    : <div className="bar"><button className="back" onClick={onBack} aria-label={t('back')}>{arrow}</button><span className="ttl">{title}</span></div>
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
            <div key={s.premise_code} className={`srow ${k === 0 ? 'best' : ''}`}>
              <span className="rank">{k + 1}</span>
              <span className="t">
                <b>{nice(s.shop)}</b>
                <span>
                  {s.complete ? t('allItems', { n }) : t('missingN', { k: s.missing.length, m: s.missing.map(nice).join(', ') })}
                </span>
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