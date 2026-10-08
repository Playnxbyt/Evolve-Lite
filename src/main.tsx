import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/sora'
import '@fontsource-variable/dm-sans'
import App from './App'
import './index.css'
import { initDevice } from './lib/device'

// Must run before the first paint: marks phones so the lighter, same-looking effects tier applies from the start.
initDevice()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* offline support is optional */ })
  })
}
