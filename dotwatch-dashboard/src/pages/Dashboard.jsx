import { useEffect, useState } from 'react'
import { auth } from '../services/firebase'
import DashboardDeviceCard from '../components/DashboardDeviceCard.jsx'
import ChartWidget from '../components/ChartWidget.jsx'
import AlarmPanel from '../components/AlarmPanel.jsx'
import { getDevices, getAlarms } from '../services/api'
import { connectRealtime, disconnectRealtime } from '../services/realtime'
import { useAlarm } from '../context/AlarmContext'

function Dashboard() {
  const [devices, setDevices] = useState([])
  const [projectName, setProjectName] = useState('dotWatch')
  const [loading, setLoading] = useState(true)
  const [alarmCount, setAlarmCount] = useState(0)
  const { addAlarm } = useAlarm()

  async function loadDevices() {
    try {
      setLoading(true)
      const data = await getDevices()
      setDevices(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setDevices([])
    } finally {
      setLoading(false)
    }
  }

  async function loadAlarms() {
    try {
      const data = await getAlarms()
      const activeCount = Array.isArray(data)
        ? data.filter((alarm) => alarm.status === 'active').length
        : 0

      setAlarmCount(activeCount)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    setProjectName(localStorage.getItem('projectName') || 'dotWatch')
    loadDevices()
    loadAlarms()

    const user = auth.currentUser

    if (user) {
      connectRealtime(user.uid, (payload) => {
        if (payload.type === 'reading') {
          const reading = payload.data

          setDevices((prevDevices) =>
            prevDevices.map((device) =>
              device.id === reading.id
                ? {
                    ...device,
                    ...reading,
                  }
                : device
            )
          )
        }

        if (payload.type === 'alarm') {
          payload.data.forEach((alarm) => {
            addAlarm(alarm)
          })

          setAlarmCount((count) => count + payload.data.length)
          console.warn('ALARM', payload.data)
        }
      })
    }

    return () => {
      disconnectRealtime()
    }
  }, [addAlarm])

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const offlineCount = devices.length - onlineCount

  return (
    <div className="page">
      <section className="summary-grid">
        <div className="summary-card">
          <span>Total Devices</span>
          <strong>{loading ? '...' : devices.length}</strong>
        </div>

        <div className="summary-card">
          <span>Online</span>
          <strong>{loading ? '...' : onlineCount}</strong>
        </div>

        <div className="summary-card">
          <span>Offline</span>
          <strong>{loading ? '...' : offlineCount}</strong>
        </div>

        <div className="summary-card alarm-summary-card">
          <span>Active Alarms</span>
          <strong>{alarmCount}</strong>
        </div>

        <div className="summary-card">
          <span>Project</span>
          <strong>{projectName}</strong>
        </div>
      </section>

      <AlarmPanel />

      <ChartWidget />

      <section className="panel">
        <div className="section-title">
          <h2>Devices Overview</h2>
          <p>ข้อมูลล่าสุดจาก TimescaleDB แบบ Realtime</p>
        </div>

        {loading ? (
          <div className="empty-device">
            <h3>กำลังโหลดข้อมูล</h3>
            <p>กำลังดึงข้อมูล Device จาก Backend</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="empty-device">
            <h3>ยังไม่มี Device</h3>
            <p>เพิ่ม Device เพื่อเริ่มรับข้อมูลจาก ESP หรือ Simulator</p>
          </div>
        ) : (
          <div className="device-grid">
            {devices.map((device) => (
              <DashboardDeviceCard
                key={device.id}
                device={{
                  ...device,
                  name: device.name,
                  deviceId: device.device_code,
                  status: device.status || 'offline',
                  temperature: device.temperature,
                  humidity: device.humidity,
                  lastSeen: device.latest_time || device.last_seen_at,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard