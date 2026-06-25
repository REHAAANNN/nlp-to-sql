import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function MissingClerkKey() {
  return (
    <main className="app-surface flex min-h-screen items-center justify-center p-6 text-text">
      <div className="premium-card max-w-lg p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Clerk setup required</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Missing VITE_CLERK_PUBLISHABLE_KEY</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Add your Clerk publishable key to frontend/.env.local, then restart Vite.
        </p>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/login">
        <App />
      </ClerkProvider>
    ) : (
      <MissingClerkKey />
    )}
  </StrictMode>,
)
