import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SectionHeader, StatCard } from '../components/common'

const ACCENT_OPTIONS = [
  { value: 'blue', label: 'Blue', color: '#2563eb' },
  { value: 'sky', label: 'Sky', color: '#0ea5e9' },
  { value: 'cyan', label: 'Cyan', color: '#06b6d4' },
  { value: 'teal', label: 'Teal', color: '#14b8a6' },
  { value: 'emerald', label: 'Emerald', color: '#10b981' },
  { value: 'lime', label: 'Lime', color: '#84cc16' },
  { value: 'amber', label: 'Amber', color: '#f59e0b' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'red', label: 'dotWatch Red', color: '#ef4444' },
  { value: 'rose', label: 'Rose', color: '#f43f5e' },
  { value: 'pink', label: 'Pink', color: '#ec4899' },
  { value: 'violet', label: 'Violet', color: '#8b5cf6' },
  { value: 'indigo', label: 'Indigo', color: '#6366f1' },
]

const DENSITY_OPTIONS = [
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'ระยะห่างมาตรฐาน อ่านง่าย เหมาะกับการใช้งานทั่วไป',
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'ลดระยะห่าง เพื่อแสดงข้อมูลได้มากขึ้นในหน้าจอเดียว',
  },
]

function applyUiSettings({ accent, density, reduceMotion, compactCards }) {
  const root = document.documentElement

  root.setAttribute('data-accent', accent)
  root.setAttribute('data-density', density)
  root.setAttribute('data-reduce-motion', reduceMotion ? 'true' : 'false')
  root.setAttribute('data-compact-cards', compactCards ? 'true' : 'false')
}

function Settings() {
  const [showDataOverview, setShowDataOverview] = useState(true)
  const [showDeviceOverview, setShowDeviceOverview] = useState(true)
  const [showDeviceMap, setShowDeviceMap] = useState(true)
  const [showLatestActiveAlarms, setShowLatestActiveAlarms] = useState(true)
  const [accent, setAccent] = useState('blue')
  const [density, setDensity] = useState('comfortable')
  const [reduceMotion, setReduceMotion] = useState(false)
  const [compactCards, setCompactCards] = useState(false)

  useEffect(() => {
    const nextAccent = localStorage.getItem('dotwatchAccent') || 'blue'
    const nextDensity = localStorage.getItem('dotwatchDensity') || 'comfortable'
    const nextReduceMotion =
      localStorage.getItem('dotwatchReduceMotion') === 'true'

    setShowDataOverview(localStorage.getItem('showDataOverview') !== 'false')
    setShowDeviceOverview(localStorage.getItem('showDeviceOverview') !== 'false')
    setShowDeviceMap(localStorage.getItem('showDeviceMap') !== 'false')
    setShowLatestActiveAlarms(
      localStorage.getItem('showLatestActiveAlarms') !== 'false'
    )
    setAccent(nextAccent)
    setDensity(nextDensity)
    setReduceMotion(nextReduceMotion)
    setCompactCards(localStorage.getItem('dotwatchCompactCards') === 'true')

    applyUiSettings({
      accent: nextAccent,
      density: nextDensity,
      reduceMotion: nextReduceMotion,
      compactCards: localStorage.getItem('dotwatchCompactCards') === 'true',
    })
  }, [])

  const settingsSummary = useMemo(
    () => [
      {
        label: 'Accent',
        value:
          ACCENT_OPTIONS.find((item) => item.value === accent)?.label || 'Blue',
        tone: 'default',
      },
      {
        label: 'Density',
        value: density === 'compact' ? 'Compact' : 'Comfortable',
        tone: density === 'compact' ? 'warning' : 'default',
      },
      {
        label: 'Motion',
        value: reduceMotion ? 'Reduced' : 'Standard',
        tone: reduceMotion ? 'warning' : 'success',
      },
      {
        label: 'Dashboard',
        value:
          [
            showDataOverview && 'Data',
            showDeviceOverview && 'Devices',
            showDeviceMap && 'Map',
            showLatestActiveAlarms && 'Alarms',
          ]
            .filter(Boolean)
            .join(' + ') || 'Minimal',
        tone: 'success',
      },
    ],
    [
      accent,
      density,
      reduceMotion,
      showDataOverview,
      showDeviceOverview,
      showDeviceMap,
      showLatestActiveAlarms,
    ]
  )

  function handleSave() {
    localStorage.setItem('showDataOverview', String(showDataOverview))
    localStorage.setItem('showDeviceOverview', String(showDeviceOverview))
    localStorage.setItem('showDeviceMap', String(showDeviceMap))
    localStorage.setItem(
      'showLatestActiveAlarms',
      String(showLatestActiveAlarms)
    )
    localStorage.setItem('dotwatchAccent', accent)
    localStorage.setItem('dotwatchDensity', density)
    localStorage.setItem('dotwatchReduceMotion', String(reduceMotion))
    localStorage.setItem('dotwatchCompactCards', String(compactCards))

    applyUiSettings({ accent, density, reduceMotion, compactCards })

    window.dispatchEvent(new Event('dashboardSettingsChanged'))
    window.dispatchEvent(new Event('dotwatchUiSettingsChanged'))

    alert('บันทึกการตั้งค่าเรียบร้อย')
  }

  return (
    <div className="page app-page settings-page settings-v3-page">
      <PageHeader
        eyebrow="System Settings"
        title="Settings"
        description="ตั้งค่าการแสดงผล Dashboard, Accent Color และพฤติกรรมของระบบ dotWatch"
        actions={
          <button type="button" className="primary-button" onClick={handleSave}>
            Save Settings
          </button>
        }
      />

      <section className="settings-v3-stat-grid">
        {settingsSummary.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            tone={item.tone}
            compact
          />
        ))}
      </section>

      <section className="settings-v3-layout">
        <div className="settings-v3-main">
          <section className="app-card settings-v3-card">
            <SectionHeader
              title="Interface Preferences"
              description="เลือกสีหลักของระบบ dotWatch Dashboard โดยไม่กระทบปุ่ม Dark / Light Theme ด้านบน"
            />

            <div className="settings-v3-accent-grid">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-v3-accent settings-v3-accent-option ${
                    accent === option.value ? 'active' : ''
                  }`}
                  onClick={() => setAccent(option.value)}
                >
                  <span
                    className="settings-v3-accent-dot"
                    style={{ background: option.color }}
                  />
                  <strong>{option.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="app-card settings-v3-card">
            <SectionHeader
              title="Dashboard Display"
              description="เลือกส่วนที่ต้องการให้แสดงบนหน้า Dashboard"
            />

            <div className="settings-v3-toggle-list dashboard-display-toggle-list">
              <label className="settings-v3-toggle-item">
                <div>
                  <strong>Data Overview</strong>
                  <span>แสดงค่าล่าสุดของ Metric ที่เปิด Visible ใน Dashboard</span>
                </div>
                <input
                  type="checkbox"
                  checked={showDataOverview}
                  onChange={(event) =>
                    setShowDataOverview(event.target.checked)
                  }
                />
              </label>

              <label className="settings-v3-toggle-item">
                <div>
                  <strong>Devices Overview</strong>
                  <span>แสดงภาพรวมสถานะอุปกรณ์ทั้งหมดใน Dashboard</span>
                </div>
                <input
                  type="checkbox"
                  checked={showDeviceOverview}
                  onChange={(event) =>
                    setShowDeviceOverview(event.target.checked)
                  }
                />
              </label>

              <label className="settings-v3-toggle-item">
                <div>
                  <strong>Device Map</strong>
                  <span>แสดงตำแหน่ง Device และสถานะล่าสุดบนแผนที่</span>
                </div>
                <input
                  type="checkbox"
                  checked={showDeviceMap}
                  onChange={(event) => setShowDeviceMap(event.target.checked)}
                />
              </label>

              <label className="settings-v3-toggle-item">
                <div>
                  <strong>Latest Active Alarms</strong>
                  <span>แสดงรายการ Alarm ที่ยัง Active อยู่ล่าสุด</span>
                </div>
                <input
                  type="checkbox"
                  checked={showLatestActiveAlarms}
                  onChange={(event) =>
                    setShowLatestActiveAlarms(event.target.checked)
                  }
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="settings-v3-side">
          <section className="app-card settings-v3-card">
            <SectionHeader
              title="Interface Density"
              description="เลือกความแน่นของ UI ให้เหมาะกับหน้าจอ"
            />

            <div className="settings-v3-option-grid">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-v3-density ${
                    density === option.value ? 'active' : ''
                  }`}
                  onClick={() => setDensity(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="app-card settings-v3-card">
            <SectionHeader title="Product UX" description="ตั้งค่าการใช้งานเพิ่มเติม" />

            <div className="settings-v3-toggle-list compact">
              <label className="settings-v3-toggle-item">
                <div>
                  <strong>Compact Stat Cards</strong>
                  <span>ลดความสูงของ StatCard ในหน้าหลัก</span>
                </div>
                <input
                  type="checkbox"
                  checked={compactCards}
                  onChange={(event) => setCompactCards(event.target.checked)}
                />
              </label>

              <label className="settings-v3-toggle-item">
                <div>
                  <strong>Reduce Motion</strong>
                  <span>ลด Animation สำหรับเครื่องที่ต้องการประหยัดทรัพยากร</span>
                </div>
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(event) => setReduceMotion(event.target.checked)}
                />
              </label>
            </div>
          </section>

          <section className="app-card settings-v3-card settings-v3-system-card">
            <SectionHeader title="System" description="ข้อมูลระบบปัจจุบัน" />

            <div className="settings-v3-system-list">
              <div>
                <span>Platform</span>
                <strong>dotWatch Dashboard</strong>
              </div>
              <div>
                <span>UI Version</span>
                <strong>Phase 21</strong>
              </div>
              <div>
                <span>Theme Control</span>
                <strong>Top Header Toggle</strong>
              </div>
              <div>
                <span>Storage</span>
                <strong>Local Preferences</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}

export default Settings
