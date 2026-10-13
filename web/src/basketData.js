import { compareBasket } from './api'
import { useBasket } from './BasketContext'
import { useDebounced, useFetch } from './hooks'

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

// Prices for the basket, shared by the Basket screen (which shop is cheapest)
// and the Budget screen (what it costs at the shop you picked).
export function useBasketData(district) {
  const { items, plan } = useBasket()

  // Ask the API again when the items, quantities, district or picked shop
  // change, once the + / − taps have paused (one request, not five).
  const request = useDebounced(JSON.stringify(items.map((i) => ({ code: i.code, qty: i.qty }))), 350)
  const { data, error, loading } = useFetch((signal) => {
    const list = JSON.parse(request)
    return list.length ? compareBasket(district, list, plan.shop, signal) : Promise.resolve(null)
  }, [request, district, plan.shop])

  // The shop the user picked, or the cheapest one until they pick.
  const shops = data?.shops ?? []
  const chosen = shops.find((s) => s.premise_code === plan.shop) ?? shops[0] ?? null

  // One row per item, priced at the chosen shop with the quantities on screen
  // now (not the ones in the last answer), so totals move as you tap.
  // An item the shop has no price for is estimated at the cheapest price elsewhere.
  const rows = items.map((i) => {
    const price = chosen?.lines.find((l) => l.item_code === i.code)?.price ?? null
    const cheapest = data?.items.find((x) => x.item_code === i.code)?.cheapest_price ?? null
    const est = price == null ? cheapest : null
    const each = price ?? est
    return { ...i, price, est, total: each == null ? null : each * i.qty, ticked: plan.ticked.includes(i.code) }
  })

  return {
    data, error, loading, shops, chosen, rows,
    planned: sum(rows.map((r) => r.total ?? 0)),
    inTrolley: sum(rows.filter((r) => r.ticked).map((r) => r.total ?? 0)),
    approx: rows.some((r) => r.est != null),
  }
}