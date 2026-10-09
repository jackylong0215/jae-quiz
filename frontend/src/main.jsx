import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { LocaleProvider } from './i18n.jsx'

// Pages serves static files; hash routes keep refreshes on the app entry point.
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <LocaleProvider><App /></LocaleProvider>
    </Router>
  </StrictMode>,
)
