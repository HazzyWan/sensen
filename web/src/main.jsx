import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BasketProvider } from './BasketContext.jsx'
import { LangProvider } from './i18n.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <BasketProvider>
        <App />
      </BasketProvider>
    </LangProvider>
  </StrictMode>,
)