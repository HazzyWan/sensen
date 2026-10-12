import { browseCategory, getCategories } from '../api'
import { useFetch } from '../hooks'
import { useLang } from '../i18n'
import { nice } from '../format'
import { ItemRows } from './Results'

// Browse by category: PriceCatcher's own groups (fresh food, dry goods, ...)
// and the categories inside them, with how many items have a price here.
export function Browse({ district, category, onCategory, selected, onOpen }) {
  return category
    ? <CategoryItems district={district} category={category} onCategory={onCategory} selected={selected} onOpen={onOpen} />
    : <CategoryList district={district} onCategory={onCategory} />
}

// The name in the app's language, plus the other language underneath.
function names(malay, english, lang) {
  const bm = nice(malay)
  if (!english) return [bm, null]
  return lang === 'en' ? [english, bm] : [bm, english]
}

function CategoryList({ district, onCategory }) {
  const { t, lang } = useLang()
  const { data, error, loading } = useFetch((s) => getCategories(district, s), [district])
  if (error) return <p className="empty">{error}</p>
  if (loading && !data) return <p className="empty">{t('loading')}</p>

  return (
    <div className="sec">
      <div className="sechead"><h2>{t('browseTitle')}</h2><span className="muted small">{t('inArea', { d: district })}</span></div>
      {data.map((g) => {
        const [title] = names(g.group, g.group_en, lang)
        return (
          <div key={g.group} className="group">
            <div className="group-h"><h3>{title}</h3><span className="muted small">{t('pricedOf', { p: g.priced, n: g.items })}</span></div>
            <div className="list">
              {g.categories.map((c) => {
                const [name, other] = names(c.category, c.category_en, lang)
                return (
                  <button key={c.category} className={`li ${c.priced ? '' : 'nop'}`} onClick={() => onCategory(c.category)}>
                    <span className="t"><b>{name}</b>{other && other !== name && <span>{other}</span>}</span>
                    <span className="r"><span className="muted small">{t('pricedOf', { p: c.priced, n: c.items })}</span></span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryItems({ district, category, onCategory, selected, onOpen }) {
  const { t, lang } = useLang()
  const { data, error, loading } = useFetch((s) => browseCategory(district, category, s), [district, category])

  const back = (
    <button className="backlink" onClick={() => onCategory(null)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      {t('allCategories')}
    </button>
  )
  if (error) return <div className="sec">{back}<p className="empty">{error}</p></div>
  if (loading && !data) return <div className="sec">{back}<p className="empty">{t('loading')}</p></div>

  const [title, other] = names(category, data[0]?.category_en, lang)
  const priced = data.filter((r) => r.cheapest_price != null).length
  return (
    <div className="sec">
      {back}
      <div className="sechead"><h2>{title}</h2>{other && <span className="muted small">{other}</span>}</div>
      <ItemRows rows={data} district={district} selected={selected} onOpen={onOpen} />
      <p className="muted small">{t('browseNote', { p: priced, n: data.length, d: district })}</p>
    </div>
  )
}