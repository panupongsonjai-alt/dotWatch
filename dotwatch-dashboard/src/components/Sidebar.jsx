import React from 'react'
import { useAlarm } from '../context/AlarmContext'

function Sidebar({ page, setPage }) {
  const menus = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'devices', label: 'Devices', icon: '📡' },
    { id: 'alarms', label: 'Alarms', icon: '🚨' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'alarm-rules', label: 'Alarm Rules', icon: '📏'}
  ]
  
  const { activeAlarmCount } = useAlarm()

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot"></span>
        <div>
          <strong>dotWatch</strong>
          <small>IoT Easy Monitoring</small>
        </div>
      </div>

      <nav className="menu">
        {menus.map((item) => (
          <button
  key={item.id}
  type="button"
  className={`menu-item ${page === item.id ? 'active' : ''}`}
  onClick={() => setPage(item.id)}
>
  <span>{item.icon}</span>
  {item.label}

  {item.id === 'alarms' && activeAlarmCount > 0 && (
    <span className="alarm-badge">{activeAlarmCount}</span>
  )}
</button>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar