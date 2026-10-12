import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BasketProvider } from './BasketContext.jsx'
import { LangProvider } from './i18n.jsx'
import { LocationProvider } from './LocationContext.jsx'
import { registerSW } from 'virtual:pwa-register'

// Keep the installed app up to date. When a new version is deployed, the
// service worker downloads it in the background and the page reloads itself.
// Phones keep installed apps open for days, so also check whenever the app
// comes back to the screen, and every hour while it stays open.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => { if (navigator.onLine) registration.update() }
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <BasketProvider>
        <LocationProvider>
          <App />
        </LocationProvider>
      </BasketProvider>
    </LangProvider>
  </StrictMode>,
)