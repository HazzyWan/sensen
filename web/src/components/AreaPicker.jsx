import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n'

const HINT_TOWNS = 3 // towns shown in grey; search looks through all of them

// Our own dropdown instead of the browser's <select>, so each area can show
// its towns in grey, and people can type their town ("Subang") to find the area.
export function AreaPicker({ areas, value, onChange }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef(null)
  const trigger = useRef(null)
  const input = useRef(null)
  const current = areas.find((a) => a.district === value)

  const close = () => { setOpen(false); setQ(''); trigger.current?.focus() }
  const pick = (d) => { onChange(d); close() }

  // Close when clicking anywhere outside the picker.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!box.current?.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDown)
    input.current?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const term = q.trim().toLowerCase()
  const matches = areas.filter((a) =>
    !term || a.district.toLowerCase().includes(term) || a.towns.some((tw) => tw.toLowerCase().includes(term)))
  const regions = [...new Set(matches.map((a) => a.region))]

  return (
    <div className="area" ref={box} onKeyDown={(e) => { if (e.key === 'Escape' && open) close() }}>
      <button ref={trigger} className="loc" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="loc-text">
          <span className="loc-name">{value || t('chooseDistrict')} <span aria-hidden="true">▾</span></span>
          {current?.towns.length > 0 && <span className="loc-hint">{current.towns.slice(0, HINT_TOWNS).join(', ')}</span>}
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
          <div className="area-list">
            {matches.length === 0 && <p className="empty small">{t('areaNone', { q: q.trim() })}</p>}
            {regions.map((r) => (
              <div key={r}>
                <p className="area-region">{r}</p>
                {matches.filter((a) => a.region === r).map((a) => (
                  <button key={a.district} className={`area-opt ${a.district === value ? 'on' : ''}`}
                    onClick={() => pick(a.district)} aria-current={a.district === value}>
                    <b>{a.district}</b>
                    {a.towns.length > 0 && <span>{a.towns.slice(0, HINT_TOWNS).join(', ')}</span>}
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