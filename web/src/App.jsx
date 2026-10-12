import { useEffect, useState } from 'react'
import { getAreas, getMeta } from './api'
import { useFetch, useItemRoute, useWide } from './hooks'
import { shortDate } from './format'
import { Header } from './components/Header'
import { Results } from './components/Results'
import { Deals, Movers, Stores } from './components/Dashboard'
import { ItemDetail } from './components/ItemDetail'

const DISTRICT_KEY = 'sensen.district'

// localStorage can throw (private mode, blocked storage), so every access is guarded.
const loadDistrict = () => { try { return localStorage.getItem(DISTRICT_KEY) ?? '' } catch { return '' } }
const saveDistrict = (d) => { try { localStorage.setItem(DISTRICT_KEY, d) } catch { /* still works, just not remembered */ } }

export default function App() {
  const wide = useWide(900)
  const meta = useFetch((s) => getMeta(s), []).data
  const { data: areas, error } = useFetch((s) => getAreas(s), [])
  const [district, setDistrict] = useState(loadDistrict)
  const [query, setQuery] = useState('')
  const [item, openItem, closeItem] = useItemRoute()

  // A saved district that no longer exists in the data is cleared.
  useEffect(() => {
    if (areas && district && !areas.some((a) => a.district === district)) setDistrict('')
  }, [areas, district])

  const pickDistrict = (d) => { setDistrict(d); saveDistrict(d); closeItem() }
  const shops = areas?.find((a) => a.district === district)?.shops

  const header = (
    <Header areas={areas ?? []} district={district} onDistrict={pickDistrict}
      query={query} onQuery={setQuery} meta={meta} wide={wide} />
  )
  const footer = <p className="note">Prices from PriceCatcher by KPDN and DOSM (CC BY 4.0), checked in person by officers.</p>

  if (error) return <div className="app"><main className="screen">{header}<p className="empty">Could not reach the API: {error}</p></main></div>
  const choose = <p className="empty">Pick your district above to see prices near you.</p>

  // ---------- Laptop: list on the left, detail or overview on the right ----------
  if (wide) {
    return (
      <div className="desk">
        {header}
        {!district ? <main className="desk-empty">{choose}</main> : (
          <div className="desk-grid">
            <aside className="side">
              {query.trim()
                ? <Results query={query} district={district} selected={item} onOpen={openItem} />
                : <Deals district={district} selected={item} onOpen={openItem} limit={8} />}
            </aside>
            <main className="main">
              {item
                ? <ItemDetail key={item} code={item} district={district} onClose={closeItem} wide />
                : (
                  <div className="screen">
                    <div className="overview-head">
                      <h1>Grocery prices in {district}</h1>
                      <p className="muted">
                        {shops} shops checked{meta ? ` · week of ${shortDate(meta.latest_week)}` : ''}.
                        Search on the left, or pick an item to see its price history.
                      </p>
                    </div>
                    <Movers district={district} onOpen={openItem} columns />
                    <Stores district={district} />
                  </div>
                )}
              {footer}
            </main>
          </div>
        )}
      </div>
    )
  }

  // ---------- Phone: one screen at a time ----------
  if (item && district) {
    return <div className="app"><ItemDetail key={item} code={item} district={district} onClose={closeItem} /></div>
  }
  return (
    <div className="app">
      <main className="screen">
        {header}
        {!district ? choose : query.trim()
          ? <Results query={query} district={district} onOpen={openItem} />
          : (
            <>
              <Deals district={district} onOpen={openItem} limit={5} />
              <Movers district={district} onOpen={openItem} />
              <Stores district={district} limit={5} />
            </>
          )}
        {footer}
      </main>
    </div>
  )
}