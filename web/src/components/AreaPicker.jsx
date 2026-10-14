import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n'
import { useNearMe } from '../LocationContext'

const HINT_TOWNS = 3 // neighbourhoods shown in grey; search looks through all of them

// Our own dropdown instead of the browser's <select>, so each area can show
// its neighbourhoods in grey, people can type theirs ("Ampang") to find the
// area, and "Use my location" can pick the nearest area for them.
// auto: the area follows the user's location. outside: location is on, but
// the user is too far from every shop we know (outside Malaysia).
export function AreaPicker({ areas, value, onChange, auto, onAuto, outside }) {
  const { t } = useLang()
  const near = useNearMe()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef(null)
  const trigger = useRef(null)
  const input = useRef(null)
  const current = areas.find((a) => a.district === value)
  const following = auto && near.status === 'on' && !outside // area is following the location now

  const close = () => { setOpen(false); setQ(''); trigger.current?.focus() }
  const pick = (d) => { onChange(d); close() }

  // After "Use my location", close the list once the location arrives (the
  // area then changes by itself), unless the user is outside our areas.
  const [waiting, setWaiting] = useState(false)
  if (waiting && near.status === 'on' && near.coords) {
    setWaiting(false)
    if (!outside) { setOpen(false); setQ('') }
  }
  const locateMe = () => {
    if (following) return close()
    onAuto()
    setWaiting(true)
  }

  // Close when clicking anywhere outside the picker.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!box.current?.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDown)
    input.current?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const term = q.trim().toLowerCase()
  const has = (name) => name.toLowerCase().includes(term)
  const matches = areas.filter((a) => !term || has(a.district) || a.places.some(has))
  // States in A to Z order, with the user's own state first.
  const regions = [...new Set(matches.map((a) => a.region))]
    .sort((x, y) => (x === current?.region ? -1 : y === current?.region ? 1 : x.localeCompare(y)))
  // While searching "Ampang", show "Ampang" under Hulu Langat, so it is clear why it matched.
  const hint = (a) => (!term || has(a.district) ? a.towns : a.places.filter(has)).slice(0, HINT_TOWNS).join(', ')

  return (
    <div className="area" ref={box} onKeyDown={(e) => { if (e.key === 'Escape' && open) close() }}>
      <button ref={trigger} className="loc" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <PinIcon />
        <span className="loc-text">
          <span className="loc-name">{value || t('chooseDistrict')} <span aria-hidden="true">▾</span></span>
          {current && (following || current.towns.length > 0) && (
            <span className="loc-hint">
              {following && <span className="auto-tag">{t('autoTag')}</span>}
              {current.towns.slice(0, HINT_TOWNS).join(', ')}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="area-panel" role="dialog" aria-label={t('districtAria')}>
          <input
            ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t('areaSearchPh')} aria-label={t('areaSearchPh')} autoComplete="off"
            onKeyDown={(e) => {
              // Enter picks when only one area matches. preventDefault stops the same
              // Enter press from also "clicking" the area button and reopening the list.
              if (e.key === 'Enter' && matches.length === 1) { e.preventDefault(); pick(matches[0].district) }
            }}
          />
          {!term && <UseLocation auto={auto} outside={outside} onClick={locateMe} />}
          <div className="area-list">
            {matches.length === 0 && <p className="empty small">{t('areaNone', { q: q.trim() })}</p>}
            {regions.map((r) => (
              <div key={r}>
                <p className="area-region">{r}</p>
                {matches.filter((a) => a.region === r).map((a) => (
                  <button key={a.district} className={`area-opt ${a.district === value ? 'on' : ''}`}
                    onClick={() => pick(a.district)} aria-current={a.district === value}>
                    <b>{a.district}</b>
                    {hint(a) && <span>{hint(a)}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// "Use my location": one button plus a line saying what is happening.
// Also shown on the first screen, before any area is chosen.
export function UseLocation({ auto, outside, onClick, big = false }) {
  const { t } = useLang()
  const near = useNearMe()
  if (near.status === 'unsupported') return null
  const using = auto && near.status === 'on' && !outside
  const note = near.status === 'asking' ? t('nearAsking')
    : near.status === 'denied' ? t('nearDenied')
      : near.status === 'error' ? t('nearError')
        : outside ? t('autoOutside')
          : null
  return (
    <div className={`use-loc ${big ? 'big' : ''}`}>
      <button className={`use-loc-btn ${using ? 'on' : ''}`} onClick={onClick}
        disabled={near.status === 'asking'} aria-pressed={using}>
        <PinIcon />
        <span>
          <b>{using ? t('autoOn') : t('autoUse')}</b>
          <span>{t('autoSub')}</span>
        </span>
      </button>
      {note && <p className="small use-loc-note" role="status">{note}</p>}
    </div>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}