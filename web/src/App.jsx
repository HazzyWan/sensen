import { useEffect, useState } from 'react'
import { getAreas, getMeta } from './api'
import { useFetch, useOnline, useRoute, useWide } from './hooks'
import { shortDate } from './format'
import { useLang } from './i18n'
import { Header } from './components/Header'
import { Results } from './components/Results'
import { Deals, Movers, Stores } from './components/Dashboard'
import { ItemDetail } from './components/ItemDetail'
import { Basket } from './components/Basket'

const DISTRICT_KEY = 'sensen.district'

// localStorage can throw (private mode, blocked storage), so every access is guarded.
const loadDistrict = () => { try { return localStorage.getItem(DISTRICT_KEY) ?? '' } catch { return '' } }
const saveDistrict = (d) => { try { localStorage.setItem(DISTRICT_KEY, d) } catch { /* still works, just not remembered */ } }

export default function App() {
  const { t, lang } = useLang()
  const wide = useWide(900)
  const meta = useFetch((s) => getMeta(s), []).data
  const { data: areas, error } = useFetch((s) => getAreas(s), [])
  const [district, setDistrict] = useState(loadDistrict)
  const [query, setQuery] = useState('')
  const [route, go] = useRoute()
  const online = useOnline()
  const item = route.view === 'item' ? route.code : null

  // A saved district that no longer exists in the data is cleared.
  useEffect(() => {
    if (areas && district && !areas.some((a) => a.district === district)) setDistrict('')
  }, [areas, district])

  const pickDistrict = (d) => { setDistrict(d); saveDistrict(d); if (route.view === 'item') go.home() }
  const shops = areas?.find((a) => a.district === district)?.shops

  const banner = !online && <div className="offline" role="status">{t('offline')}</div>
  const header = (
    <>{banner}<Header areas={areas ?? []} district={district} onDistrict={pickDistrict}
      query={query} onQuery={setQuery} meta={meta} wide={wide} onBasket={go.basket} /></>
  )
    const footer = (
    <footer className="note">
      <p>{t('footer')}</p>
      <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{t('osmCredit')}</a></p>
      <p className="version">{t('version', { v: import.meta.env.VITE_APP_VERSION, b: import.meta.env.VITE_APP_BUILD })}</p>
    </footer>
  )

  if (error) return <div className="app"><main className="screen">{header}<p className="empty">{t('apiError', { e: error })}</p></main></div>
  const choose = <p className="empty">{t('choose')}</p>

  // ---------- Laptop: list on the left, detail / basket / overview on the right ----------
  if (wide) {
    let main
    if (route.view === 'item') {
      main = <ItemDetail key={item} code={item} district={district} onClose={go.home} wide />
    } else if (route.view === 'basket') {
      main = <Basket district={district} onBack={go.home} onOpen={go.item} wide />
    } else {
      main = (
        <div className="screen">
          <div className="overview-head">
            <h1>{t('overviewTitle', { d: district })}</h1>
            <p className="muted">
              {t('overviewSub', { n: shops, w: meta ? shortDate(meta.latest_week, lang) : '…' })}
            </p>
          </div>
          <Movers district={district} onOpen={go.item} columns />
          <Stores district={district} />
        </div>
      )
    }
    return (
      <div className="desk">
        {header}
        {!district ? <main className="desk-empty">{choose}</main> : (
          <div className="desk-grid">
            <aside className="side">
              {query.trim()
                ? <Results query={query} district={district} selected={item} onOpen={go.item} />
                : <Deals district={district} selected={item} onOpen={go.item} limit={8} />}
            </aside>
            <main className="main">{main}{footer}</main>
          </div>
        )}
      </div>
    )
  }

  // ---------- Phone: one screen at a time ----------
  if (district && route.view === 'item') {
    return <div className="app"><ItemDetail key={item} code={item} district={district} onClose={go.home} /></div>
  }
  if (district && route.view === 'basket') {
    return <div className="app"><Basket district={district} onBack={go.home} onOpen={go.item} /></div>
  }
  return (
    <div className="app">
      <main className="screen">
        {header}
        {!district ? choose : query.trim()
          ? <Results query={query} district={district} onOpen={go.item} />
          : (
            <>
              <Deals district={district} onOpen={go.item} limit={5} />
              <Movers district={district} onOpen={go.item} />
              <Stores district={district} limit={5} />
            </>
          )}
        {footer}
      </main>
    </div>
  )
}