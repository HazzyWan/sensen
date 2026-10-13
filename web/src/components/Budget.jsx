import { useState } from 'react'
import { stepFor, useBasket } from '../BasketContext'
import { useBasketData } from '../basketData'
import { useLang } from '../i18n'
import { nice, qtyText, rm, unitText } from '../format'
import { BackBar } from './Basket'

// The budget planner: pick a shop, set a budget, adjust quantities until it
// fits, then tick items off in the shop. Opened from the Basket screen.
export function Budget({ district, onBack, onOpen, wide }) {
  const { t } = useLang()
  const basket = useBasket()
  const { items, plan } = basket
  const { data, error, loading, shops, chosen, rows, planned, inTrolley, approx } = useBasketData(district)

  return (
    <div className="detail">
      <BackBar wide={wide} onBack={onBack} back={t('backToBasket')} title={t('planTitle')} />
      <div className="screen">
        {/* On phone the bar above already says "Budget plan". */}
        {(wide || (plan.shopping && plan.ticked.length > 0)) && (
          <div className="sechead">
            {wide ? <h2>{t('planTitle')}</h2> : <span />}
            {plan.shopping && plan.ticked.length > 0 && <button className="linkbtn" onClick={basket.resetTicks}>{t('resetTicks')}</button>}
          </div>
        )}
        {items.length === 0 && <p className="empty">{t('budgetEmpty')}</p>}

        {error && <p className="empty">{error}</p>}
        {loading && !data && items.length > 0 && <p className="empty">{t('comparing')}</p>}
        {items.length > 0 && data && !chosen && <p className="empty">{t('noShop', { d: district })}</p>}

        {items.length > 0 && chosen && (
          <>
            <Plan shops={shops} chosen={chosen} district={district}
              amount={plan.shopping ? inTrolley : planned} left={planned - inTrolley} approx={approx} />
            <ItemList rows={rows} district={district} shopping={plan.shopping} onOpen={onOpen} />
          </>
        )}
      </div>
    </div>
  )
}

// The budget box: which shop, how much to spend, and how much is left.
function Plan({ shops, chosen, district, amount, left, approx }) {
  const { t } = useLang()
  const { plan, setShop, setBudget, setShopping } = useBasket()
  const budget = plan.budget
  const over = budget != null && amount > budget
  const pct = budget ? Math.min(100, (amount / budget) * 100) : 0

  return (
    <section className={`card plan ${plan.shopping ? 'shopping' : ''}`} aria-label={t('planTitle')}>
      <div className="plan-fields">
        <label className="field">
          <span className="field-lbl">{t('shopAt')}</span>
          <select value={chosen.premise_code} onChange={(e) => setShop(Number(e.target.value))} disabled={plan.shopping}>
            {shops.map((s, k) => (
              <option key={s.premise_code} value={s.premise_code}>
                {nice(s.shop)} · {rm(s.total)}
                {s.complete ? (k === 0 ? ` · ${t('cheapestTag')}` : '') : ` · ${t('missingShort', { k: s.missing.length })}`}
              </option>
            ))}
          </select>
        </label>
        <label className="field budget">
          <span className="field-lbl">{t('budget')}</span>
          <BudgetInput value={budget} onChange={setBudget} />
        </label>
      </div>

      <div className="plan-sum">
        <div>
          <span className="field-lbl">{plan.shopping ? t('inTrolley') : t('planned')}</span>
          <b className="plan-amt">{approx ? '~' : ''}{rm(amount)}</b>
        </div>
        {budget != null && (
          <span className={`plan-left ${over ? 'over' : ''}`}>
            {over ? t('over', { x: rm(amount - budget) }) : t('left', { x: rm(budget - amount) })}
          </span>
        )}
      </div>
      {budget != null
        ? <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className={`meter-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        : <p className="muted small">{t('noBudget')}</p>}

      {plan.shopping && (left > 0.004
        ? <p className="small">{t('toBuy', { x: rm(left) })}</p>
        : <p className="small save-t">{t('allTicked')}</p>)}
      {approx && <p className="muted small">{t('estNote', { d: district })}</p>}

      <button className={`btn ${plan.shopping ? 'ghost' : ''}`} onClick={() => setShopping(!plan.shopping)}>
        {plan.shopping ? t('stopShopping') : t('startShopping', { s: nice(chosen.shop) })}
      </button>
    </section>
  )
}

// Typed as text, so "12." stays on screen while typing; saved as a number.
function BudgetInput({ value, onChange }) {
  const { t } = useLang()
  const [text, setText] = useState(value == null ? '' : String(value))
  return (
    <span className="money">
      <span aria-hidden="true">RM</span>
      <input inputMode="decimal" value={text} placeholder={t('budgetPh')} aria-label={t('budget')}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, '')
          setText(v)
          const n = parseFloat(v)
          onChange(n > 0 ? Math.round(n * 100) / 100 : null)
        }} />
    </span>
  )
}

function ItemList({ rows, district, shopping, onOpen }) {
  const { t } = useLang()
  const { changeQty, toggleTick } = useBasket()
  return (
    <div className="list">
      {rows.map((r) => {
        const name = nice(r.name)
        const sub = r.price != null ? `${rm(r.price)} · ${unitText(r.unit, t)}`
          : r.est != null ? t('notHere', { p: rm(r.est) })
            : t('notAnywhere', { d: district })
        return (
          <div key={r.code} className={`li plan-li ${shopping ? 'shopping' : ''} ${r.ticked ? 'done' : ''}`}>
            {shopping && (
              <button className={`tick ${r.ticked ? 'on' : ''}`} onClick={() => toggleTick(r.code)}
                aria-pressed={r.ticked} aria-label={t('tickAria', { x: name })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </button>
            )}
            <button className="t" onClick={() => (shopping ? toggleTick(r.code) : onOpen(r.code))}>
              <b>{name}</b><span>{sub}</span>
            </button>
            <span className="r">
              <b>{r.total == null ? '–' : `${r.est != null ? '~' : ''}${rm(r.total)}`}</b>
              {shopping
                ? <span className="muted small">{qtyText(r.qty, r.unit)}</span>
                : (
                  <span className="qty">
                    <button onClick={() => changeQty(r.code, -1)} disabled={r.qty <= stepFor(r.unit)} aria-label={t('qtyLess', { x: name })}>−</button>
                    <span>{qtyText(r.qty, r.unit)}</span>
                    <button onClick={() => changeQty(r.code, 1)} aria-label={t('qtyMore', { x: name })}>+</button>
                  </span>
                )}
            </span>
          </div>
        )
      })}
    </div>
  )
}