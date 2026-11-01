import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AnalysisProvider } from './lib/analysis-store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AnalysisProvider>
        <App />
      </AnalysisProvider>
    </BrowserRouter>
  </StrictMode>,
)
