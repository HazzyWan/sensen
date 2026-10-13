import { useState } from 'react'
import { useBasket } from '../BasketContext'
import { useBasketData } from '../basketData'
import { useLang } from '../i18n'
import { nice, rm } from '../format'

// The budget, always in view while you browse: a card in the corner on a
// laptop (it can be folded into a small pill), a slim bar above the tabs on a
// phone. It updates as items are added, and briefly shows "+RM 9.49".
// Tapping it opens the budget screen. Shown once a budget is set, even
// before anything is in the basket.
export function BudgetFloat({ district, wide, onOpen }) {
  const { t } = useLang()
  const { plan, setMini } = useBasket()
  const { chosen, loading, planned, inTrolley, approx } = useBasketData(district)
  const shopName = chosen?.shop ?? plan.shopName

  const amount = plan.shopping ? inTrolley : planned
  const budget = plan.budget
  const over = amount > budget
  const pct = Math.min(100, (amount / budget) * 100)

  // Show how much the last change added or took away. Updated while
  // rendering (React's "adjust state when a value changes" pattern); the
  // first answer from the server is just remembered, not shown as a change.
  const [seen, setSeen] = useState(null)
  const [flash, setFlash] = useState(null) // { change, key }
  if (seen === null) { if (!loading) setSeen(amount) }
  else if (Math.abs(amount - seen) > 0.004) {
    setFlash({ change: amount - seen, key: (flash?.key ?? 0) + 1 })
    setSeen(amount)
  }
  const flashTag = flash && (
    <span key={flash.key} className={`bf-flash ${flash.change > 0 ? 'up' : 'down'}`} aria-hidden="true">
      {flash.change > 0 ? '+' : '−'}{rm(Math.abs(flash.change))}
    </span>
  )

  const leftText = over ? t('over', { x: rm(amount - budget) }) : t('left', { x: rm(budget - amount) })
  const ofText = t('bfOf', { a: `${approx ? '~' : ''}${rm(amount)}`, b: rm(budget) })
  const meter = (
    <div className="meter bf-meter"><div className={`meter-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} /></div>
  )

  // Phone: a slim bar above the tab bar.
  if (!wide) {
    return (
      <button className="bf-bar" onClick={onOpen} aria-label={`${t('planTitle')}: ${leftText}`}>
        {meter}
        <span className="bf-row">
          <span className="bf-tag">{plan.shopping ? t('inTrolley') : t('budget')}</span>
          <span className="bf-of">{ofText}</span>
          {flashTag}
          <b className={`bf-left ${over ? 'over' : ''}`}>{leftText}</b>
        </span>
      </button>
    )
  }

  // Laptop, folded: just what's left.
  if (plan.mini) {
    return (
      <button className={`bf-pill ${over ? 'over' : ''}`} onClick={() => setMini(false)} aria-label={t('bfShow')}>
        <span className="cta-ic" aria-hidden="true">RM</span>
        <b>{leftText}</b>
        {flashTag}
      </button>
    )
  }

  // Laptop: a card in the corner.
  return (
    <aside className="bf-card" aria-label={t('planTitle')}>
      <div className="bf-head">
        <span className="bf-tag">{plan.shopping ? t('inTrolley') : t('planTitle')}</span>
        <button className="bf-min" onClick={() => setMini(true)} aria-label={t('bfHide')} title={t('bfHide')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
      </div>
      {shopName && <span className="bf-shop">{nice(shopName)}</span>}
      <div className="bf-nums">
        <span className="bf-of">{ofText}</span>
        {flashTag}
      </div>
      {meter}
      <div className="bf-foot">
        <b className={`bf-left ${over ? 'over' : ''}`}>{leftText}</b>
        <button className="linkbtn" onClick={onOpen}>{t('bfOpen')}</button>
      </div>
    </aside>
  )
}