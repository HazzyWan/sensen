import { getItemPrices } from '../api'
import { useFetch } from '../hooks'
import { useLang } from '../i18n'
import { RADII, useNearMe } from '../LocationContext'
import { distanceKm, kmText, mapsLink } from '../geo'
import { nice, rm } from '../format'

const SHOW = 5 // shops listed

// "Cheapest near you" on the item page: every shop's price for this item,
// filtered to the chosen distance and sorted cheapest first, worked out here.
export function NearMe({ code }) {
  const { t } = useLang()
  const near = useNearMe()
  return (
    <section className="sec">
      <div className="sechead">
        <h2>{t('nearTitle')}</h2>
        {near.status === 'on' && <button className="linkbtn" onClick={near.stop}>{t('nearStop')}</button>}
      </div>
      {near.status === 'on'
        ? <NearList code={code} here={near.coords} radius={near.radius} setRadius={near.setRadius} />
        : <NearAsk near={near} />}
    </section>
  )
}

function NearAsk({ near }) {
  const { t } = useLang()
  if (near.status === 'unsupported') return <p className="empty">{t('nearUnsupported')}</p>
  const problem = near.status === 'denied' ? t('nearDenied') : near.status === 'error' ? t('nearError') : null
  return (
    <div className="card nearask">
      {problem && <p className="small">{problem}</p>}
      <button className="btn" onClick={near.start} disabled={near.status === 'asking'}>
        {near.status === 'asking' ? t('nearAsking') : t('nearAsk')}
      </button>
      <p className="muted small">{t('nearPrivacy')}</p>
    </div>
  )
}

function NearList({ code, here, radius, setRadius }) {
  const { t } = useLang()
  const { data, error, loading } = useFetch((s) => getItemPrices(code, s), [code])

  const chips = (
    <div className="chips" role="group" aria-label={t('nearRadius')}>
      {RADII.map((r) => (
        <button key={r} className="chip" aria-pressed={r === radius} onClick={() => setRadius(r)}>
          {t('nearWithin', { r })}
        </button>
      ))}
    </div>
  )

  if (error) return <p className="empty">{error}</p>
  if (loading && !data) return <>{chips}<p className="empty">{t('loading')}</p></>

  // The API sends prices cheapest first, so filtering keeps that order.
  const inRange = data
    .filter((s) => s.lat != null)
    .map((s) => ({ ...s, km: distanceKm(here, s) }))
    .filter((s) => s.km <= radius)
  if (!inRange.length) return <>{chips}<p className="empty">{t('nearNone', { r: radius })}</p></>

  const nearestKm = Math.min(...inRange.map((s) => s.km))
  const cheapest = inRange[0].price

  return (
    <>
      {chips}
      <div className="list">
        {inRange.slice(0, SHOW).map((s, k) => (
          <div key={`${s.shop}-${k}`} className={`srow ${k === 0 ? 'best' : ''}`}>
            <span className="rank">{k + 1}</span>
            <span className="t">
              <b>{nice(s.shop)}</b>
              <span>
                {s.location === 'address' ? '' : '~'}{kmText(s.km)}
                {s.km === nearestKm && <> · <span className="near-tag">{t('nearest')}</span></>}
                {' · '}<a className="maplink" href={mapsLink(s)} target="_blank" rel="noopener noreferrer">{t('openMaps')}</a>
              </span>
            </span>
            <span className="r">
              <b>{rm(s.price)}</b>
              <span className={k === 0 ? 'save-t' : 'dear-t'}>{k === 0 ? t('bestPrice') : `+${rm(s.price - cheapest)}`}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="muted small">{t('nearNote', { n: inRange.length, r: radius })}</p>
    </>
  )
}