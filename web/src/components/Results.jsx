import { useEffect, useState } from 'react'
import { searchItems } from '../api'
import { useFetch } from '../hooks'
import { useLang } from '../i18n'
import { LABEL_CLASS, nice, rm, shortDate, unitText } from '../format'

// Wait until typing pauses before searching, so "ayam" sends one request, not four.
function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setV(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return v
}

export function Results({ query, district, selected, onOpen }) {
  const { t, lang } = useLang()
  const term = useDebounced(query.trim())
  const { data, error, loading } = useFetch(
    (signal) => (term.length >= 2 ? searchItems(term, district, signal) : Promise.resolve(null)),
    [term, district],
  )

  if (term.length < 2) return <p className="empty">{t('typeMore')}</p>
  if (error) return <p className="empty">{error}</p>
  if (loading && !data) return <p className="empty">{t('searching')}</p>
  if (!data?.length) return <p className="empty">{t('noResults', { q: term, d: district })}</p>

  return (
    <div className="list">
      {data.map((r) => (
        <button key={r.item_code} className={`li ${selected === r.item_code ? 'on' : ''}`} onClick={() => onOpen(r.item_code)}>
          <span className="t">
            <b>{nice(r.name)}</b>
            <span>{nice(r.cheapest_shop)} · {unitText(r.unit, t)} · {shortDate(r.price_date, lang)}</span>
          </span>
          <span className="r">
            <b>{rm(r.cheapest_price)}</b>
            {r.label && <span className={`pill ${LABEL_CLASS[r.label]}`}>{t(r.label)}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}