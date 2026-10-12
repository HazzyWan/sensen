import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// "Near me": the phone's location, kept in memory only (never saved, never
// sent to the server). We only remember THAT the user turned it on, so the
// next visit can ask the browser again without a new button press.

export const RADII = [3, 5, 10] // km choices
const ON_KEY = 'sensen.nearme'
const RADIUS_KEY = 'sensen.radius'

const load = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const save = (key, value) => {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* fine */ }
}

const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  // off | asking | on | denied | error | unsupported
  const [status, setStatus] = useState(() =>
    !supported ? 'unsupported' : load(ON_KEY) === 'on' ? 'asking' : 'off')
  const [coords, setCoords] = useState(null)
  const [radius, setRadiusState] = useState(() => {
    const r = Number(load(RADIUS_KEY))
    return RADII.includes(r) ? r : 5
  })

  // Ask the browser. The first time it shows its own "Allow location?" prompt.
  const locate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setStatus('on')
        save(ON_KEY, 'on')
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
        save(ON_KEY, null)
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  // Turned on during an earlier visit: ask again quietly.
  useEffect(() => {
    if (status === 'asking' && !coords) locate()
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    status, coords, radius,
    start: () => { if (supported) { setStatus('asking'); locate() } },
    stop: () => { setCoords(null); setStatus('off'); save(ON_KEY, null) },
    setRadius: (r) => { setRadiusState(r); save(RADIUS_KEY, String(r)) },
  }
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export const useNearMe = () => useContext(LocationContext)