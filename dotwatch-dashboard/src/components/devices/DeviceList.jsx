import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import {
  getDeviceDisplayName,
  getLastSeen,
  getModelLabel,
  getStatus,
  getStatusIcon,
  getStatusLabel,
} from './deviceUtils.jsx'

function DeviceList({
  devices,
  loading,
  selectedDevice,
  saving,
  onCreate,
  onSelect,
}) {
  const [searchText, setSearchText] = useState('')

  const filteredDevices = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return devices

    return devices.filter((device) => {
      const values = [
        getDeviceDisplayName(device),
        device.device_code,
        device.model_name,
        device.group_name,
        getStatus(device),
      ]

      return values.filter(Boolean).join(' ').toLowerCase().includes(keyword)
    })
  }, [devices, searchText])

  function renderList() {
    if (loading) {
      return (
        <div className="app-empty-state compact-empty-state">
          <h3>กำลังโหลด</h3>
          <p>กำลังดึงข้อมูล Device</p>
        </div>
      )
    }

    if (!devices.length) {
      return (
        <div className="app-empty-state compact-empty-state">
          <h3>ยังไม่มี Device</h3>
          <p>กด Create เพื่อเริ่มต้น</p>
        </div>
      )
    }

    if (!filteredDevices.length) {
      return (
        <div className="app-empty-state compact-empty-state">
          <h3>ไม่พบ Device</h3>
          <p>ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง</p>
        </div>
      )
    }

    return filteredDevices.map((device) => {
      const status = getStatus(device)
      const active = String(selectedDevice?.id) === String(device.id)

      return (
        <button
          type="button"
          key={device.id}
          className={`devices-v2-item devices-v3-item ${active ? 'active' : ''}`}
          onClick={() => onSelect(device.id)}
        >
          <div className="devices-v2-item-head devices-v3-item-top">
            <div>
              <div className="devices-v2-item-name devices-v3-item-name">
                {getDeviceDisplayName(device)}
              </div>

              <div className="devices-v2-item-code devices-v3-item-code">
                {device.device_code}
              </div>
            </div>

            <span className={`status ${status}`}>
              {getStatusIcon(status)}
              {getStatusLabel(status)}
            </span>
          </div>

          <div className="devices-v2-item-foot devices-v3-item-footer">
            <span className="device-model-badge">{getModelLabel(device)}</span>
            <small>{getLastSeen(device)}</small>
          </div>
        </button>
      )
    })
  }

  return (
    <aside className="devices-v2-list">
      <div className="app-card devices-v2-list-card devices-v3-list-card">
        <div className="app-section-title devices-v2-list-title">
          <div>
            <h3>Devices</h3>
            <p>{devices.length} devices registered</p>
          </div>

          <div className="device-v2-header-actions">
            <button
              type="button"
              className="primary-button devices-v3-create-btn"
              onClick={onCreate}
              disabled={saving}
            >
              <Plus size={18} />
              Create Device
            </button>
          </div>
        </div>

        <div className="devices-v3-search-box">
          <Search size={16} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search device..."
          />
        </div>

        <div className="devices-v2-list-scroll devices-v3-list-scroll">
          {renderList()}
        </div>
      </div>
    </aside>
  )
}

export default DeviceList
