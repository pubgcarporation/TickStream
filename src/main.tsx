import './tracing'
import './console-capture'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { WalletProviders } from './providers/WalletProviders'
import App from './App'
import { installShareSync } from './lib/share'
import './index.css'

installShareSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProviders>
      <App />
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(18, 45, 69, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#f9faf3',
            borderRadius: '16px',
          },
        }}
      />
    </WalletProviders>
  </StrictMode>,
)
