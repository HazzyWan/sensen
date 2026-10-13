// All calls to the SenSen API live here, so screens never build URLs themselves.

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// fetch() throws a TypeError when there is no connection at all. We turn that
// into one known code, 'NETWORK', so the screens can show a friendly message.
async function send(url, options) {
  try {
    return await fetch(url, options)
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new Error('NETWORK')
  }
}

async function readError(res) {
  const body = await res.json().catch(() => ({}))
  const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail
  return new Error(detail ?? `API answered ${res.status}`)
}

async function get(path, params = {}, signal) {
  const url = new URL(path, API)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await send(url, { signal })
  if (!res.ok) throw await readError(res)
  return res.json()
}

async function post(path, body, signal) {
  const res = await send(new URL(path, API), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw await readError(res)
  return res.json()
}

export const getMeta = (signal) => get('/meta', {}, signal)
export const getAreas = (signal) => get('/areas', {}, signal)
export const searchItems = (q, district, signal) => get('/items/search', { q, district }, signal)
export const getItem = (code, district, signal) => get(`/items/${code}`, { district }, signal)
export const getItemPrices = (code, signal) => get(`/items/${code}/prices`, {}, signal)
export const getCategories = (district, signal) => get('/categories', { district }, signal)
export const browseCategory = (district, category, signal) => get('/browse', { district, category }, signal)
export const getStores = (district, signal) => get('/stores', { district }, signal)
export const getMovers = (district, signal) => get('/movers', { district, limit: 5 }, signal)
export const getDeals = (district, signal) => get('/deals', { district, limit: 8 }, signal)
export const getShops = (district, signal) => get('/shops', { district }, signal)
export const getShopItems = (code, q, signal, limit = 60) => get(`/shops/${code}/items`, { q, limit }, signal)

// items: [{ code, qty }]. include: the shop the user picked, so it comes back
// even when it isn't one of the 10 cheapest.
export const compareBasket = (district, items, include, signal) =>
  post('/basket', {
    district, item_codes: items.map((i) => i.code), quantities: items.map((i) => i.qty), include,
  }, signal)