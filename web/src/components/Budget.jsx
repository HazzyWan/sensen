import { useEffect, useState } from 'react'
import { getShopItems, getShops } from '../api'
import { BASKET_MAX, stepFor, useBasket } from '../BasketContext'
import { useBasketData } from '../basketData'
import { distanceKm, kmText } from '../geo'
import { useDebounced, useFetch } from '../hooks'
import { useLang } from '../i18n'
import { ItemIcon } from '../icons'
import { useNearMe } from '../LocationContext'
import { nice, qtyText, rm, unitText } from '../format'
import { BackBar } from './Basket'

// The budget planner, in two parts:
//   Setting up: 1. pick a shop  2. set a budget  then "Start plan" (or Cancel).
//   Running:    everything the shop sells, with "cheaper at" hints; your list
//               priced at that shop; "Start shopping" to tick items off; End plan.
// Only a started plan shows the floating budget elsewhere in the app.
export function Budget({ district, onBack, onOpen, wide }) {
  const { t } = useLang()
  const basket = useBasket()
  const { items, plan, setShop, endPlan } = basket
  const shopList = useFetch((s) => getShops(district, s), [district])
  const priced = useBasketData(district)
  const [choosing, setChoosing] = useState(false)

  const list = shopList.data ?? []
  const shop = list.find((s) => s.premise_code === plan.shop) ?? null

  // A shop picked in another area doesn't belong here: forget it.
  const stale = Boolean(shopList.data && plan.shop != null && !shop)
  useEffect(() => { if (stale) setShop(null) }, [stale, setShop])

  const pick = (s) => { setShop(s.premise_code, s.shop); setChoosing(false) }
  const cancel = () => { endPlan(); onBack() }
  const shopping = plan.shopping && items.length > 0

  let body
  if (shopList.error) body = <p className="empty">{shopList.error}</p>
  else if (!shopList.data) body = <p className="empty">{t('loading')}</p>
  else if (!shop || choosing) {
    body = (
      <ShopChooser shops={list} current={shop} basketTotals={priced.data?.shops} step={!plan.active}
        onPick={pick} onCancel={shop ? () => setChoosing(false) : cancel} cancelLabel={shop ? t('cancel') : t('cancelPlan')} />
    )
  } else if (!plan.active) {
    body = <SetUp shop={shop} onChange={() => setChoosing(true)} onCancel={cancel} />
  } else {
    body = (
      <>
        <Plan shop={shop} district={district} shopping={shopping} onChange={() => setChoosing(true)}
          amount={shopping ? priced.inTrolley : priced.planned}
          left={priced.planned - priced.inTrolley} approx={priced.approx} />
        <section className="sec">
          <div className="sechead"><h2>{t('yourList')}</h2>
            {items.length > 0 && <span className="muted small">{t('itemCount', { n: items.length })}</span>}</div>
          {items.length === 0
            ? <p className="empty small">{t('listEmptyHint')}</p>
            : <ItemList rows={priced.rows} district={district} shopping={shopping} onOpen={onOpen} />}
        </section>
        {!shopping && <Catalogue shop={shop} />}
      </>
    )
  }

  return (
    <div className="detail">
      <BackBar wide={wide} onBack={onBack} back={t('backToBasket')} title={t('planTitle')} />
      <div className="screen">
        {(wide || (shopping && plan.ticked.length > 0)) && (
          <div className="sechead">
            {wide ? <h2>{t('planTitle')}</h2> : <span />}
            {shopping && plan.ticked.length > 0 && <button className="linkbtn" onClick={basket.resetTicks}>{t('resetTicks')}</button>}
          </div>
        )}
        {body}
      </div>
    </div>
  )
}

// Step 1: every shop in the area with fresh prices. Nearest first when
// location is on (worked out on this device), otherwise most prices first.
function ShopChooser({ shops, current, basketTotals, step, onPick, onCancel, cancelLabel }) {
  const { t } = useLang()
  const near = useNearMe()
  const [q, setQ] = useState('')
  const here = near.status === 'on' ? near.coords : null

  const totals = new Map((basketTotals ?? []).map((s) => [s.premise_code, s]))
  let rows = shops.map((s) => ({ ...s, km: here && s.lat != null ? distanceKm(here, s) : null }))
  if (here) rows = [...rows].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
  const term = q.trim().toLowerCase()
  if (term) rows = rows.filter((s) => `${s.shop} ${s.suburb ?? ''}`.toLowerCase().includes(term))

  return (
    <section className="card shop-pick">
      {step && <span className="step">{t('step', { n: 1 })}</span>}
      <div className="sechead">
        <h2>{t('pickShop')}</h2>
        <button className="linkbtn" onClick={onCancel}>{cancelLabel}</button>
      </div>
      <p className="muted small">{t('pickShopSub')}</p>
      <div className="shop-pick-tools">
        <input className="shop-filter" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('shopFilterPh')} aria-label={t('shopFilterPh')} autoComplete="off" />
        {near.status !== 'on' && near.status !== 'unsupported' && (
          <button className="chip" onClick={near.start} disabled={near.status === 'asking'}>
            {near.status === 'asking' ? t('nearAsking') : t('sortNearest')}
          </button>
        )}
      </div>
      {(near.status === 'denied' || near.status === 'error') && (
        <p className="small muted">{near.status === 'denied' ? t('nearDenied') : t('nearError')}</p>
      )}
      {rows.length === 0 && <p className="empty small">{t('noShopMatch', { q: q.trim() })}</p>}
      <div className="list">
        {rows.map((s, k) => {
          const total = totals.get(s.premise_code)
          return (
            <button key={s.premise_code} className={`li shop-li ${current?.premise_code === s.premise_code ? 'on' : ''}`}
              onClick={() => onPick(s)}>
              <span className="t">
                <b>{nice(s.shop)}</b>
                <span>
                  {here && k === 0 && !term && s.km != null && <><span className="near-tag">{t('nearest')}</span> · </>}
                  {[s.suburb, s.km != null && `${s.location === 'address' ? '' : '~'}${kmText(s.km)}`,
                    t('itemsPriced', { n: s.items_priced })].filter(Boolean).join(' · ')}
                </span>
              </span>
              {total && (
                <span className="r">
                  <b>{rm(total.total)}</b>
                  <span className="muted small">{total.complete ? t('forYourList') : t('missingShort', { k: total.missing.length })}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// Step 2: how much to spend, then start (or cancel).
function SetUp({ shop, onChange, onCancel }) {
  const { t } = useLang()
  const { plan, setBudget, startPlan } = useBasket()
  return (
    <section className="card plan">
      <span className="step">{t('step', { n: 2 })}</span>
      <div className="sechead"><h2>{t('setBudgetTitle')}</h2></div>
      <div className="field">
        <span className="field-lbl">{t('shopAt')}</span>
        <ShopNow shop={shop} onChange={onChange} />
      </div>
      <label className="field">
        <span className="field-lbl">{t('budget')}</span>
        <BudgetInput value={plan.budget} onChange={setBudget} autoFocus />
      </label>
      <button className="btn" onClick={startPlan} disabled={plan.budget == null}>{t('startPlan')}</button>
      <button className="btn ghost-plain" onClick={onCancel}>{t('cancelPlan')}</button>
    </section>
  )
}

function ShopNow({ shop, onChange }) {
  const { t } = useLang()
  return (
    <div className="shop-now">
      <span className="t">
        <b>{nice(shop.shop)}</b>
        {shop.suburb && <span className="muted small">{shop.suburb}</span>}
      </span>
      {onChange && <button className="linkbtn" onClick={onChange}>{t('changeShop')}</button>}
    </div>
  )
}

// The running plan: the shop, how much to spend, and how much is left.
function Plan({ shop, district, shopping, onChange, amount, left, approx }) {
  const { t } = useLang()
  const { items, plan, setBudget, setShopping, endPlan } = useBasket()
  const budget = plan.budget
  const over = budget != null && amount > budget
  const pct = budget ? Math.min(100, (amount / budget) * 100) : 0

  return (
    <section className={`card plan ${shopping ? 'shopping' : ''}`} aria-label={t('planTitle')}>
      <div className="plan-fields">
        <div className="field">
          <span className="field-lbl">{t('shopAt')}</span>
          <ShopNow shop={shop} onChange={shopping ? null : onChange} />
        </div>
        <label className="field budget">
          <span className="field-lbl">{t('budget')}</span>
          <BudgetInput value={budget} onChange={setBudget} />
        </label>
      </div>

      <div className="plan-sum">
        <div>
          <span className="field-lbl">{shopping ? t('inTrolley') : t('planned')}</span>
          <b className="plan-amt">{approx ? '~' : ''}{rm(amount)}</b>
        </div>
        {budget != null && (
          <span className={`plan-left ${over ? 'over' : ''}`}>
            {over ? t('over', { x: rm(amount - budget) }) : t('left', { x: rm(budget - amount) })}
          </span>
        )}
      </div>
      {budget != null && (
        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className={`meter-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      {shopping && (left > 0.004
        ? <p className="small">{t('toBuy', { x: rm(left) })}</p>
        : <p className="small save-t">{t('allTicked')}</p>)}
      {approx && <p className="muted small">{t('estNote', { d: district })}</p>}

      {items.length > 0 && (
        <button className={`btn ${shopping ? 'ghost' : ''}`} onClick={() => setShopping(!shopping)}>
          {shopping ? t('stopShopping') : t('startShopping', { s: nice(shop.shop) })}
        </button>
      )}
      <button className="linkbtn end-plan" onClick={endPlan}>{t('endPlan')}</button>
    </section>
  )
}

// "Cheaper at Lotus's, RM 8.90, 2.1 km": the nearest shop that sells it for
// less (when location is on), otherwise the cheapest one.
function CheaperHint({ cheaper, price }) {
  const { t } = useLang()
  const near = useNearMe()
  if (!cheaper?.length) return null
  const here = near.status === 'on' ? near.coords : null
  let best = cheaper[0]
  let km = null
  if (here) {
    const located = cheaper.filter((c) => c.lat != null).map((c) => ({ ...c, km: distanceKm(here, c) }))
    if (located.length) {
      best = located.reduce((a, b) => (b.km < a.km ? b : a))
      km = best.km
    }
  }
  if (price - best.price < 0.05) return null
  return (
    <span className="cheaper">
      {t('cheaperAt', { s: nice(best.shop), p: rm(best.price) })}
      {km != null && ` · ${best.location === 'address' ? '' : '~'}${kmText(km)}`}
    </span>
  )
}

// Everything the shop sells, by category, or search results within it.
function Catalogue({ shop }) {
  const { t } = useLang()
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim(), 250)
  const all = useFetch((signal) => getShopItems(shop.premise_code, '', signal, 400), [shop.premise_code])
  const found = useFetch(
    (signal) => (term.length >= 2 ? getShopItems(shop.premise_code, term, signal) : Promise.resolve(null)),
    [shop.premise_code, term],
  )

  // Categories in the order the API sends them (alphabetical in BM).
  const groups = []
  for (const r of all.data ?? []) {
    const name = r.category_en ?? nice(r.category)
    if (groups.at(-1)?.name !== name) groups.push({ name, rows: [] })
    groups.at(-1).rows.push(r)
  }

  return (
    <section className="sec">
      <div className="sechead">
        <h2>{t('everythingAt')}</h2>
        {all.data && <span className="muted small">{t('itemsPriced', { n: all.data.length })}</span>}
      </div>
      <label className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder={t('searchShopPh', { n: shop.items_priced })} aria-label={t('findAt', { s: nice(shop.shop) })} />
      </label>

      {term.length >= 2 ? (
        found.error ? <p className="empty small">{found.error}</p>
          : found.loading && !found.data ? <p className="empty small">{t('searching')}</p>
            : !found.data?.length ? <p className="empty small">{t('notSoldHere', { q: term })}</p>
              : <ShopRows rows={found.data} />
      ) : all.error ? <p className="empty small">{all.error}</p>
        : !all.data ? <p className="empty small">{t('loading')}</p>
          : (
            <div className="cat-groups">
              {groups.map((g) => (
                <details key={g.name} className="cat-group">
                  <summary><b>{g.name}</b><span className="muted small">{g.rows.length}</span></summary>
                  <ShopRows rows={g.rows} />
                </details>
              ))}
            </div>
          )}
    </section>
  )
}

function ShopRows({ rows }) {
  const { t } = useLang()
  const { items, has, add, remove } = useBasket()
  const full = items.length >= BASKET_MAX
  return (
    <div className="list">
      {rows.map((r) => {
        const inList = has(r.item_code)
        return (
          <div key={r.item_code} className="li withic shop-item">
            <ItemIcon name={r.name} category={r.category} />
            <span className="t">
              <b>{nice(r.name)}</b>
              <span>{rm(r.price)} · {unitText(r.unit, t)}</span>
              <CheaperHint cheaper={r.cheaper} price={r.price} />
            </span>
            <button className={`add-btn ${inList ? 'on' : ''}`} disabled={!inList && full}
              onClick={() => (inList ? remove(r.item_code) : add({ code: r.item_code, name: r.name, unit: r.unit }))}
              aria-label={inList ? t('removeAria', { x: nice(r.name) }) : t('addAria', { x: nice(r.name) })}>
              {inList ? t('added') : t('addShort')}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Typed as text, so "12." stays on screen while typing; saved as a number.
function BudgetInput({ value, onChange, autoFocus }) {
  const { t } = useLang()
  const [text, setText] = useState(value == null ? '' : String(value))
  return (
    <span className="money">
      <span aria-hidden="true">RM</span>
      <input inputMode="decimal" value={text} placeholder={t('budgetPh')} aria-label={t('budget')} autoFocus={autoFocus}
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
  const { changeQty, toggleTick, remove } = useBasket()
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
                    <button onClick={() => (r.qty <= stepFor(r.unit) ? remove(r.code) : changeQty(r.code, -1))}
                      aria-label={r.qty <= stepFor(r.unit) ? t('removeAria', { x: name }) : t('qtyLess', { x: name })}>−</button>
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