import { useBasket } from '../BasketContext'
import { useLang } from '../i18n'
import { shortDate } from '../format'

export function Header({ areas, district, onDistrict, query, onQuery, meta, wide, onBasket }) {
  const { t, lang } = useLang()
  const week = meta && <span className="pill soft">{t('weekOf', { w: shortDate(meta.latest_week, lang) })}</span>
  const basket = <BasketButton onClick={onBasket} />
  return (
    <header className={wide ? 'topbar' : 'top'}>
      <div className="row between">
        <div className="row brand-row">
          {wide && <span className="brand">Sen<span>Sen</span></span>}
          <DistrictPicker areas={areas} value={district} onChange={onDistrict} />
          {wide && week}
        </div>
        {!wide && <div className="row"><LangToggle />{district && basket}</div>}
      </div>
      {!wide && <div className="row between"><h1 className="hello">{t('hello')}</h1></div>}
      {!wide && week && <div>{week}</div>}
      {district && (wide
        ? <div className="row search-row"><SearchBox value={query} onChange={onQuery} /><LangToggle />{basket}</div>
        : <SearchBox value={query} onChange={onQuery} />)}
    </header>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang" role="group" aria-label="Language / Bahasa">
      <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button aria-pressed={lang === 'ms'} onClick={() => setLang('ms')}>BM</button>
    </div>
  )
}

function BasketButton({ onClick }) {
  const { items } = useBasket()
  const { t } = useLang()
  return (
    <button className="basket-btn" onClick={onClick} aria-label={t('basketAria', { n: items.length })}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 9h14l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" />
      </svg>
      {items.length > 0 && <span className="count">{items.length}</span>}
    </button>
  )
}

// Each option shows the area's main towns, so "Petaling" reads as
// "Petaling · Shah Alam, Subang Jaya" and people can find their own area.
function DistrictPicker({ areas, value, onChange }) {
  const { t } = useLang()
  const regions = [...new Set(areas.map((a) => a.region))]
  const current = areas.find((a) => a.district === value)
  return (
    <label className="loc">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
      </svg>
      {/* The real <select> is invisible and sits on top of this label, so tapping
          the label opens the phone's own picker, while the closed state stays short. */}
      <span className="loc-text">
        <span className="loc-name">{value || t('chooseDistrict')} <span aria-hidden="true">▾</span></span>
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('districtAria')}>
          <option value="">{t('chooseDistrict')}</option>
          {regions.map((r) => (
            <optgroup key={r} label={r}>
              {areas.filter((a) => a.region === r).map((a) => (
                <option key={a.district} value={a.district}>
                  {a.towns.length ? `${a.district} · ${a.towns.join(', ')}` : a.district}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {current?.towns.length > 0 && <span className="loc-hint">{current.towns.join(', ')}</span>}
      </span>
    </label>
  )
}

function SearchBox({ value, onChange }) {
  const { t } = useLang()
  return (
    <label className="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchPh')} aria-label={t('searchAria')} autoComplete="off"
      />
    </label>
  )
}