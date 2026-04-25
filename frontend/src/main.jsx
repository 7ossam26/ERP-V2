import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { preloadPdfFonts } from './utils/pdfFonts.js'
import debugLog from './utils/debugLog.js'

// Globally capture errors and unhandled rejections — including throws from
// EventSource callbacks and other non-React paths that ErrorBoundary cannot
// see. Persists to localStorage["debug:errors"] so a reload after a silent
// crash still preserves the breadcrumbs.
window.addEventListener('error', (e) => {
  debugLog.error('global', e.error || e.message, {
    source: 'window.error',
    filename: e.filename,
    line: e.lineno,
    col: e.colno,
  })
})
window.addEventListener('unhandledrejection', (e) => {
  debugLog.error('global', e.reason, { source: 'unhandledrejection' })
})

debugLog.push('boot', 'main', { url: window.location.href })

void preloadPdfFonts().catch((error) => {
  debugLog.error('pdf', error, { source: 'preloadPdfFonts' })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
