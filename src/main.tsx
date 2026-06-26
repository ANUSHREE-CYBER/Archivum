import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SmoothCursor from './components/SmoothCursor.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SmoothCursor />
    <App />
  </StrictMode>,
)
