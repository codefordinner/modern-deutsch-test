import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/components.css'
import './styles/import-export.css'
import './styles/features.css'
import './styles/srs-settings.css'
import './styles/layout.css'
import './styles/mobile.css'
import App from './App.tsx'
import { installEnterScrollGuard } from './utils/scrollGuard'

installEnterScrollGuard()

// Ask the browser not to evict our localStorage (settings, SRS progress) under storage pressure or after
// a long absence. Some browsers grant it silently, some ask or refuse; either way it is best effort.
try {
  void navigator.storage?.persist?.().catch(() => {})
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (see public/sw.js). Only in production builds: in dev the worker would serve stale modules.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error))
  })
}
