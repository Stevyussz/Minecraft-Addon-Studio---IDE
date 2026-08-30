import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

async function bootstrap() {
  // If window.mas is not provided (running in browser dev, not Electron),
  // inject a mock so the UI can be tested without the Electron process.
  if (!window.mas) {
    const { masMock } = await import('./mock/masMock')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).mas = masMock
    console.warn('[MAS] Running in browser-only mode. Using mock window.mas API.')
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
