import { createContext, useContext, useState } from 'react'

// The basket is shared by several screens (item detail, header, basket page),
// so it lives in a React "context" instead of being passed down through props.
// It also holds the budget plan: how many of each item, the budget, the shop
// the user picked, and which items are already in the trolley (shopping mode).
// All of it is saved on this device only.

const KEY = 'sensen.basket'
const PLAN_KEY = 'sensen.plan'
export const BASKET_MAX = 30 // the API accepts up to 30 items

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* still works, just not remembered */ }
}

// Items saved before quantities existed get 1 of each.
const loadItems = () => read(KEY, []).map((i) => ({ ...i, qty: i.qty ?? 1 }))
// active: the plan has been started (a shop and a budget were set and the
// user pressed "Start plan"). Until then it is being set up.
const EMPTY_PLAN = { active: false, budget: null, shop: null, shopName: null, shopping: false, ticked: [], mini: false }
const loadPlan = () => {
  const saved = read(PLAN_KEY, {})
  // Plans saved before "active" existed count as started if they were complete.
  const active = saved.active ?? (saved.budget != null && saved.shop != null)
  return { ...EMPTY_PLAN, ...saved, active }
}

// Per-kg items go up and down by half a kilo; everything else by one.
export const stepFor = (unit) => (unit === '1kg' ? 0.5 : 1)

const BasketContext = createContext(null)

export function BasketProvider({ children }) {
  const [items, setItems] = useState(loadItems) // [{ code, name, unit, qty }]
  const [plan, setPlanState] = useState(loadPlan) // { active, budget, shop, shopName, shopping, ticked, mini }

  const update = (next) => { setItems(next); write(KEY, next) }
  const setPlan = (changes) => {
    const next = { ...plan, ...changes }
    setPlanState(next)
    write(PLAN_KEY, next)
  }

  const value = {
    items,
    has: (code) => items.some((i) => i.code === code),
    add: (item) => {
      if (items.length >= BASKET_MAX || items.some((i) => i.code === item.code)) return
      update([...items, { ...item, qty: item.qty ?? 1 }])
    },
    remove: (code) => {
      const next = items.filter((i) => i.code !== code)
      update(next)
      // Nothing left to tick: shopping mode ends by itself.
      setPlan({ ticked: plan.ticked.filter((c) => c !== code), shopping: plan.shopping && next.length > 0 })
    },
    clear: () => { update([]); setPlan({ ticked: [], shopping: false }) },
    // +1 or -1 steps; never below one step (use remove for zero).
    changeQty: (code, direction) => update(items.map((i) => {
      if (i.code !== code) return i
      const step = stepFor(i.unit)
      return { ...i, qty: Math.min(100, Math.max(step, i.qty + direction * step)) }
    })),

    plan,
    setBudget: (budget) => setPlan({ budget }),
    setShop: (shop, shopName = null) => setPlan({ shop, shopName }),
    setShopping: (shopping) => setPlan({ shopping }),
    toggleTick: (code) => setPlan({
      ticked: plan.ticked.includes(code) ? plan.ticked.filter((c) => c !== code) : [...plan.ticked, code],
    }),
    resetTicks: () => setPlan({ ticked: [] }),
    setMini: (mini) => setPlan({ mini }), // floating budget card folded away (laptop)
    startPlan: () => setPlan({ active: true, mini: false }),
    // End or cancel the plan: the shop, budget and ticks go; the basket stays.
    endPlan: () => setPlan({ ...EMPTY_PLAN, mini: plan.mini }),
  }
  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}

export const useBasket = () => useContext(BasketContext)