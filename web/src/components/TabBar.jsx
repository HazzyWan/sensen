import { useBasket } from '../BasketContext'
import { useLang } from '../i18n'

const ICONS = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  browse: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  basket: <><path d="M5 9h14l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></>,
}

// Phone only: the three main screens at the bottom, where a thumb reaches.
export function TabBar({ tab, go }) {
  const { t } = useLang()
  const { items } = useBasket()
  const tabs = [
    { id: 'home', label: t('navHome'), onClick: () => go.home() },
    { id: 'browse', label: t('navBrowse'), onClick: () => go.browse() },
    { id: 'basket', label: t('navBasket'), onClick: () => go.basket(), count: items.length },
  ]
  return (
    <nav className="tabbar" aria-label={t('navAria')}>
      {tabs.map((x) => (
        <button key={x.id} aria-current={tab === x.id ? 'page' : undefined} onClick={x.onClick}>
          <span className="ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[x.id]}</svg>
            {x.count > 0 && <span className="count">{x.count}</span>}
          </span>
          {x.label}
        </button>
      ))}
    </nav>
  )
}