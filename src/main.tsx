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
        position="bottom-center"
        theme="dark"
        duration={3500}
        visibleToasts={3}
        closeButton
        toastOptions={{
          style: {
            background: '#212121',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f1f1f1',
            borderRadius: '10px',
            fontSize: '14px',
          },
        }}
      />
    </WalletProviders>
  </StrictMode>,
)
