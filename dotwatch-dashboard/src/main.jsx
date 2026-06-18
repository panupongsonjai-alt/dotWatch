import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { AlarmProvider } from './context/AlarmContext'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AlarmProvider>
      <App />
    </AlarmProvider>
  </React.StrictMode>
)