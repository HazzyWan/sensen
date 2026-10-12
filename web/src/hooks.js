import { useEffect, useRef, useState } from 'react'
import { useLang } from './i18n'

// Load something from the API whenever `deps` change. Cancels the previous
// request so a slow old answer never overwrites a newer one.
export function useFetch(load, deps) {
  const { t } = useLang()
  const [state, setState] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    load(ctrl.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e) => { if (e.name !== 'AbortError') setState({ data: null, error: e.message, loading: false }) })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  // 'NETWORK' (no connection) becomes a readable sentence in the current language.
  return { ...state, error: state.error === 'NETWORK' ? t('networkError') : state.error }
}

// true while the phone or laptop has a connection; updates when it changes.
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

// true when the screen is at least `px` wide; updates when the window is resized.
export function useWide(px = 900) {
  const query = `(min-width: ${px}px)`
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return wide
}

// Which screen is open is kept in the URL (#/item/12, #/basket), so the phone's
// back button works and a link to an item can be shared.
function readRoute() {
  const h = window.location.hash
  const item = h.match(/^#\/item\/(\d+)$/)
  if (item) return { view: 'item', code: Number(item[1]) }
  if (h === '#/basket') return { view: 'basket' }
  return { view: 'home' }
}

export function useRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = {
    item: (c) => { window.location.hash = `/item/${c}` },
    basket: () => { window.location.hash = '/basket' },
    home: () => { window.location.hash = '' },
  }
  return [route, go]
}

// Width of an element in pixels, for charts that draw to fit their box.
export function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}