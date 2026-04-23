import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { preloadPdfFonts } from './utils/pdfFonts.js'

void preloadPdfFonts().catch((error) => {
  console.error("[PDF] Failed to preload fonts", error)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
