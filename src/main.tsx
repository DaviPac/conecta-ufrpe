import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SigaaProvider } from './contexts/SigaaContext.tsx'

createRoot(document.getElementById('root')!).render(
  <SigaaProvider>
    <App />
  </SigaaProvider>
)
