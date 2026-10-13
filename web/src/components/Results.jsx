import { searchItems } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { useLang } from '../i18n'
import { LABEL_CLASS, nice, rm, shortDate, unitText } from '../format'
import { ItemIcon } from '../icons'

export function Results({ query, district, selected, onOpen }) {
  const { t } = useLang()
  const term = useDebounced(query.trim()) // search once typing pauses
  const { data, error, loading } = useFetch(
    (signal) => (term.length >= 2 ? searchItems(term, district, signal) : Promise.resolve(null)),
    [term, district],
  )

  if (term.length < 2) return <p className="empty">{t('typeMore')}</p>
  if (error) return <p className="empty">{error}</p>
  if (loading && !data) return <p className="empty">{t('searching')}</p>
  if (!data?.length) return <p className="empty">{t('noResults', { q: term, d: district })}</p>

  return <ItemRows rows={data} district={district} selected={selected} onOpen={onOpen} />
}

// One row per item with its cheapest price here, or a greyed row when it has
// no recent price. Used by search results and by Browse.
export function ItemRows({ rows, district, selected, onOpen }) {
  const { t, lang } = useLang()
  return (
    <div className="list">
      {rows.map((r) => (r.cheapest_price == null ? (
        // In PriceCatcher's list, but no recent price here (or anywhere we cover).
        <button key={r.item_code} className={`li withic nop ${selected === r.item_code ? 'on' : ''}`} onClick={() => onOpen(r.item_code)}>
          <ItemIcon name={r.name} category={r.category} />
          <span className="t">
            <b>{nice(r.name)}</b>
            <span>{unitText(r.unit, t)} · {r.priced_anywhere ? t('noPriceHere', { d: district }) : t('notPriced')}</span>
          </span>
        </button>
      ) : (
        <button key={r.item_code} className={`li withic ${selected === r.item_code ? 'on' : ''}`} onClick={() => onOpen(r.item_code)}>
          <ItemIcon name={r.name} category={r.category} />
          <span className="t">
            <b>{nice(r.name)}</b>
            <span>{nice(r.cheapest_shop)} · {unitText(r.unit, t)} · {shortDate(r.price_date, lang)}</span>
          </span>
          <span className="r">
            <b>{rm(r.cheapest_price)}</b>
            {r.label && <span className={`pill ${LABEL_CLASS[r.label]}`}>{t(r.label)}</span>}
          </span>
        </button>
      )))}
    </div>
  )
}