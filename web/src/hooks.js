import { useEffect, useRef, useState } from 'react'

// Load something from the API whenever `deps` change. Cancels the previous
// request so a slow old answer never overwrites a newer one.
export function useFetch(load, deps) {
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
  return state
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

// The item shown is kept in the URL (#/item/12), so the phone's back button
// works and a link to an item can be shared.
export function useItemRoute() {
  const read = () => {
    const m = window.location.hash.match(/^#\/item\/(\d+)$/)
    return m ? Number(m[1]) : null
  }
  const [code, setCode] = useState(read)
  useEffect(() => {
    const onHash = () => setCode(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const open = (c) => { window.location.hash = `/item/${c}` }
  const close = () => { window.location.hash = '' }
  return [code, open, close]
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