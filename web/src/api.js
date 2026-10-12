// All calls to the SenSen API live here, so screens never build URLs themselves.

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function get(path, params = {}, signal) {
  const url = new URL(path, API)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `API answered ${res.status}`)
  }
  return res.json()
}

export const getMeta = () => get('/meta')
export const getAreas = () => get('/areas')
export const searchItems = (q, district, signal) =>
  get('/items/search', { q, district }, signal)