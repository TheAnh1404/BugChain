import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { initSentry, SentryErrorBoundary } from './monitoring/sentry.js'

initSentry()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<div className="p-6 text-[#ffb4ab]">BugChain failed to render.</div>}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SentryErrorBoundary>
  </StrictMode>,
)
