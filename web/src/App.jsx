import { useEffect, useState } from 'react'
import { getAreas, getMeta } from './api'
import { useFetch, useOnline, useRoute, useWide } from './hooks'
import { shortDate } from './format'
import { useLang } from './i18n'
import { useNearMe } from './LocationContext'
import { nearestArea } from './geo'
import { Header } from './components/Header'
import { UseLocation } from './components/AreaPicker'
import { Results } from './components/Results'
import { Deals, Movers, Stores } from './components/Dashboard'
import { DealCards, QuickTiles, Spotlight } from './components/Home'
import { ItemDetail } from './components/ItemDetail'
import { Basket } from './components/Basket'
import { Budget } from './components/Budget'
import { BudgetFloat } from './components/BudgetFloat'
import { useBasket } from './BasketContext'
import { Browse } from './components/Browse'
import { TabBar } from './components/TabBar'

const DISTRICT_KEY = 'sensen.district'
const AUTO_KEY = 'sensen.areaAuto' // "on": the area follows the user's location

// localStorage can throw (private mode, blocked storage), so every access is guarded.
const load = (key) => { try { return localStorage.getItem(key) ?? '' } catch { return '' } }
const save = (key, value) => { try { localStorage.setItem(key, value) } catch { /* still works, just not remembered */ } }

export default function App() {
  const { t, lang } = useLang()
  const wide = useWide(900)
  const meta = useFetch((s) => getMeta(s), []).data
  const { data: areas, error } = useFetch((s) => getAreas(s), [])
  const [district, setDistrict] = useState(() => load(DISTRICT_KEY))
  const [auto, setAuto] = useState(() => load(AUTO_KEY) === 'on')
  const [query, setQuery] = useState('')
  const [route, go] = useRoute()
  const online = useOnline()
  const item = route.view === 'item' ? route.code : null

  // Which tab an item was opened from (so Back returns there), and the last
  // category open in Browse (so it is still open after viewing an item).
  // Updated while rendering when the route changes, React's pattern for
  // "adjust state when a prop changes".
  const [from, setFrom] = useState(route.view === 'item' ? 'home' : route.view)
  const [browseCat, setBrowseCat] = useState(route.view === 'browse' ? route.category : null)
  const [seenRoute, setSeenRoute] = useState(route)
  if (route !== seenRoute) {
    setSeenRoute(route)
    if (route.view !== 'item') setFrom(route.view)
    if (route.view === 'browse') setBrowseCat(route.category)
  }
  // The budget screen belongs to the Basket tab.
  const tabOf = (view) => (view === 'budget' ? 'basket' : view)
  const tab = tabOf(route.view === 'item' ? from : route.view)
  const toRanking = () => document.getElementById('stores')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const back = () => (from === 'browse' ? go.browse(browseCat) : from === 'basket' ? go.basket()
    : from === 'budget' ? go.budget() : go.home())

  // A saved district that no longer exists in the data is cleared.
  useEffect(() => {
    if (areas && district && !areas.some((a) => a.district === district)) setDistrict('')
  }, [areas, district])

  // "Auto": the area nearest the user, worked out on this device from the
  // shops around them. Used when the user chose it, or when location is
  // already on (from "near me") and no area has been picked yet.
  const near = useNearMe()
  const here = areas && near.status === 'on' && near.coords ? nearestArea(areas, near.coords) : null
  const outside = Boolean(areas && near.coords && !here)
  if (here && (auto || !district) && here.district !== district) {
    setDistrict(here.district)
    if (!auto) setAuto(true)
  }
  useEffect(() => { save(DISTRICT_KEY, district) }, [district])
  useEffect(() => { save(AUTO_KEY, auto ? 'on' : '') }, [auto])

  // The floating budget: once a budget is set, it stays in view while browsing
  // (not on the basket and budget screens, which already show it).
  const basket = useBasket()
  const floating = Boolean(district && basket.plan.budget != null && basket.items.length > 0
    && route.view !== 'basket' && route.view !== 'budget')
  const budgetFloat = floating && <BudgetFloat district={district} wide={wide} onOpen={go.budget} />

  const pickDistrict = (d) => { setDistrict(d); setAuto(false); if (route.view === 'item') go.home() }
  const autoArea = () => { setAuto(true); if (near.status !== 'on') near.start() }
  const shops = areas?.find((a) => a.district === district)?.shops

  const banner = !online && <div className="offline" role="status">{t('offline')}</div>
  const header = (
    <>{banner}<Header areas={areas ?? []} district={district} onDistrict={pickDistrict}
      auto={auto} onAuto={autoArea} outside={outside}
      query={query} onQuery={setQuery} meta={meta} wide={wide} tab={tab} go={go} /></>
  )
  const footer = (
    <footer className="note">
      <p>{t('footer')}</p>
      <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{t('osmCredit')}</a></p>
      <p className="version">{t('version', { v: import.meta.env.VITE_APP_VERSION, b: import.meta.env.VITE_APP_BUILD })}</p>
    </footer>
  )

  if (error) return <div className="app"><main className="screen">{header}<p className="empty">{t('apiError', { e: error })}</p></main></div>
  const choose = (
    <div className="choose">
      <p className="empty">{t('choose')}</p>
      {areas && <UseLocation auto={auto} outside={outside} onClick={autoArea} big />}
    </div>
  )

  // ---------- Laptop: list on the left, detail / basket / overview on the right ----------
  if (wide) {
    let main
    if (route.view === 'item') {
      main = <ItemDetail key={item} code={item} district={district} onClose={back} wide />
    } else if (route.view === 'basket') {
      main = <Basket district={district} onBack={go.home} onOpen={go.item} onBudget={go.budget} wide />
    } else if (route.view === 'budget') {
      main = <Budget district={district} onBack={go.basket} onOpen={go.item} wide />
    } else {
      main = (
        <div className="screen">
          <div className="overview-head">
            <h1>{t('overviewTitle', { d: district })}</h1>
            <p className="muted">
              {t('overviewSub', { n: shops, w: meta ? shortDate(meta.latest_week, lang) : '…' })}
            </p>
          </div>
          <QuickTiles onCategory={go.browse} wide />
          <Spotlight district={district} onRanking={toRanking} />
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
                : tab === 'browse'
                  ? <Browse district={district} category={browseCat} onCategory={go.browse} selected={item} onOpen={go.item} />
                  : <Deals district={district} selected={item} onOpen={go.item} limit={8} />}
            </aside>
            <main className="main">{main}{footer}</main>
          </div>
        )}
        {budgetFloat}
      </div>
    )
  }

  // ---------- Phone: one screen at a time, tabs at the bottom ----------
  const tabbar = district && <TabBar tab={tab} go={go} />
  if (district && route.view === 'item') {
    return <div className={`app ${floating ? 'floating' : ''}`}><ItemDetail key={item} code={item} district={district} onClose={back} />{budgetFloat}</div>
  }
  if (district && route.view === 'basket') {
    return <div className="app tabbed"><Basket district={district} onBack={go.home} onOpen={go.item} onBudget={go.budget} />{tabbar}</div>
  }
  if (district && route.view === 'budget') {
    return <div className="app tabbed"><Budget district={district} onBack={go.basket} onOpen={go.item} />{tabbar}</div>
  }
  let body
  if (!district) body = choose
  else if (query.trim()) body = <Results query={query} district={district} onOpen={go.item} />
  else if (route.view === 'browse') body = <Browse district={district} category={browseCat} onCategory={go.browse} onOpen={go.item} />
  else body = (
    <>
      <QuickTiles onCategory={go.browse} />
      <Spotlight district={district} onRanking={toRanking} />
      <DealCards district={district} onOpen={go.item} />
      <Movers district={district} onOpen={go.item} />
      <Stores district={district} limit={5} />
    </>
  )
  return (
    <div className={`app ${district ? 'tabbed' : ''} ${floating ? 'floating' : ''}`}>
      <main className="screen">
        {header}
        {body}
        {footer}
      </main>
      {budgetFloat}
      {tabbar}
    </div>
  )
}