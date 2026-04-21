import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SystemSettingsProvider } from './contexts/SystemSettingsContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SystemSettingsProvider>
      <App />
    </SystemSettingsProvider>
  </StrictMode>,
)
