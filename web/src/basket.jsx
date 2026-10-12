import { createContext, useContext, useState } from 'react'

// The basket is shared by several screens (item detail, header, basket page),
// so it lives in a React "context" instead of being passed down through props.

const KEY = 'sensen.basket'
export const BASKET_MAX = 30 // the API accepts up to 30 items

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? [] } catch { return [] }
}
const save = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* still works, just not remembered */ }
}

const BasketContext = createContext(null)

export function BasketProvider({ children }) {
  const [items, setItems] = useState(load) // [{ code, name, unit }]

  const update = (next) => { setItems(next); save(next) }
  const value = {
    items,
    has: (code) => items.some((i) => i.code === code),
    add: (item) => {
      if (items.length >= BASKET_MAX || items.some((i) => i.code === item.code)) return
      update([...items, item])
    },
    remove: (code) => update(items.filter((i) => i.code !== code)),
    clear: () => update([]),
  }
  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}

export const useBasket = () => useContext(BasketContext)