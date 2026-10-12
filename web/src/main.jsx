import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BasketProvider } from './BasketContext.jsx'
import { LangProvider } from './i18n.jsx'
import { LocationProvider } from './LocationContext.jsx'

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