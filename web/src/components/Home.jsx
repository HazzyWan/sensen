import { getDeals, getStores } from '../api'
import { useFetch } from '../hooks'
import { useLang } from '../i18n'
import { Icon, ItemIcon } from '../icons'
import { nice, rm } from '../format'

// The 8 staples people check most, each opening its Browse category.
const TILES = [
  ['chicken', 'tileChicken', 'AYAM'],
  ['egg', 'tileEggs', 'TELUR'],
  ['rice', 'tileRice', 'BERAS'],
  ['fish', 'tileFish', 'BAHAN LAUT'],
  ['meat', 'tileMeat', 'DAGING'],
  ['veg', 'tileVeg', 'SAYUR-SAYURAN'],
  ['oil', 'tileOil', 'MINYAK DAN LEMAK'],
  ['milk', 'tileMilk', 'KRIMER DAN SUSU TEPUNG'],
]

export function QuickTiles({ onCategory, wide }) {
  const { t } = useLang()
  return (
    <nav className={`cats ${wide ? 'wide' : ''}`} aria-label={t('browseTitle')}>
      {TILES.map(([icon, label, category]) => (
        <button key={category} className="cat" onClick={() => onCategory(category)}>
          <Icon k={icon} />
          {t(label)}
        </button>
      ))}
    </nav>
  )
}

// The banner: the shop that is cheapest overall in the district this week.
export function Spotlight({ district, onRanking }) {
  const { t } = useLang()
  const { data } = useFetch((s) => getStores(district, s), [district])
  const best = data?.[0]
  if (!best || best.vs_district_pct >= 0) return null
  return (
    <button className="banner" onClick={onRanking}>
      <b>{t('spotTitle', { s: nice(best.shop), p: Math.abs(best.vs_district_pct).toFixed(0) })}</b>
      <span>{t('spotSub', { n: best.items_compared, d: district })}</span>
      <span className="go">{t('spotGo')}</span>
      <Icon k="bag" className="deco" />
    </button>
  )
}

// "Low this week" as cards you swipe through, for the phone's home screen.
export function DealCards({ district, onOpen }) {
  const { t } = useLang()
  const { data, error } = useFetch((s) => getDeals(district, s), [district])
  if (error) return <p className="empty">{error}</p>
  if (!data) return null
  return (
    <section className="sec">
      <div className="sechead"><h2>{t('lowTitle')}</h2><span className="muted small">{t('lowSub')}</span></div>
      {data.length === 0 ? <p className="empty">{t('lowNone')}</p> : (
        <div className="hscroll">
          {data.map((d) => (
            <button key={d.item_code} className="hot" onClick={() => onOpen(d.item_code)}>
              <ItemIcon name={d.name} className="thumb" />
              <span className="nm">{nice(d.name)}</span>
              <span className="pr">{rm(d.cheapest_price)}</span>
              <span className="pill save">{t('belowUsual', { p: d.below_usual_pct.toFixed(0) })}</span>
              <span className="at">{t('cheapestAt')} <b>{nice(d.cheapest_shop)}</b></span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}