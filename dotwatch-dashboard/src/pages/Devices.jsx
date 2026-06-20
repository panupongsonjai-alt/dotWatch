import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  KeyRound,
  Trash2,
  Edit3,
  Save,
  X,
  MapPin,
} from 'lucide-react'

import DeviceCard from '../components/DeviceCard.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import {
  getDevices,
  addDevice,
  deleteDevice,
  updateDeviceName,
  updateDeviceGroup,
  resetDeviceSecret,
  updateDeviceLocation,
} from '../services/api'

function createDeviceCode() {
  return `dotwatch-${Date.now()}`
}

function createDeviceSecret() {
  return crypto.randomUUID()
}

function Device() {
  const [devices, setDevices] = useState([])
  const [deviceName, setDeviceName] = useState('')
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('All')
  const [editingDeviceId, setEditingDeviceId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [locations, setLocations] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadDevices() {
    try {
      setLoading(true)
      const data = await getDevices()
      setDevices(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Load devices error:', error)
      alert('โหลดข้อมูล Device ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  const groups = useMemo(() => {
    return [
      'All',
      ...new Set(devices.map((device) => device.group_name || 'Default')),
    ]
  }, [devices])

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const keyword = `${device.name || ''} ${device.device_code || ''}`
        .toLowerCase()
        .trim()

      const matchSearch = keyword.includes(search.toLowerCase())
      const matchGroup =
        groupFilter === 'All' ||
        (device.group_name || 'Default') === groupFilter

      return matchSearch && matchGroup
    })
  }, [devices, search, groupFilter])

  const onlineCount = devices.filter((d) => d.status === 'online').length
  const offlineCount = devices.length - onlineCount
  const warningCount = devices.filter((d) => d.status === 'warning').length

  async function handleAddDevice() {
    try {
      const name = deviceName.trim() || `dotWatch ${devices.length + 1}`
      const deviceCode = createDeviceCode()
      const deviceSecret = createDeviceSecret()

      setSaving(true)

      const created = await addDevice({
        deviceCode,
        name,
        deviceSecret,
      })

      setDeviceName('')
      await loadDevices()

      alert(
        `เพิ่ม Device สำเร็จ\n\nDevice Code:\n${created.device_code}\n\nDevice Secret:\n${created.deviceSecret}\n\nกรุณาเก็บ Device Secret นี้ไว้ เพราะจะแสดงครั้งเดียว`
      )
    } catch (error) {
      console.error('Add device error:', error)
      alert(error.message || 'เพิ่ม Device ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDeviceName(deviceId) {
    if (!editingName.trim()) {
      alert('กรุณากรอกชื่อ Device')
      return
    }

    try {
      setSaving(true)
      await updateDeviceName(deviceId, editingName.trim())
      setEditingDeviceId(null)
      setEditingName('')
      await loadDevices()
    } catch (error) {
      console.error('Update device error:', error)
      alert(error.message || 'แก้ไขชื่อ Device ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDevice(deviceId) {
    const ok = confirm('ต้องการลบ Device นี้ใช่ไหม?')
    if (!ok) return

    try {
      setSaving(true)
      await deleteDevice(deviceId)
      await loadDevices()
    } catch (error) {
      console.error('Delete device error:', error)
      alert(error.message || 'ลบ Device ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetSecret(device) {
    const ok = confirm(
      `ต้องการ Reset Secret ของ ${
        device.name || device.device_code
      } ใช่ไหม?\n\nSecret เดิมจะใช้งานไม่ได้ทันที`
    )

    if (!ok) return

    try {
      setSaving(true)
      const result = await resetDeviceSecret(device.id)
      await loadDevices()

      alert(
        `Reset Secret สำเร็จ\n\nDevice Code:\n${result.device_code}\n\nDevice Secret ใหม่:\n${result.deviceSecret}\n\nกรุณา Copy เก็บไว้ทันที`
      )
    } catch (error) {
      console.error('Reset secret error:', error)
      alert(error.message || 'Reset Secret ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeGroup(deviceId, groupName) {
    try {
      setSaving(true)
      await updateDeviceGroup(deviceId, groupName)
      await loadDevices()
    } catch (error) {
      console.error('Update group error:', error)
      alert('อัปเดต Group ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePickedLocation(device) {
    const location = locations[device.id]

    if (!location) {
      alert('กรุณาคลิกเลือกตำแหน่งบนแผนที่ก่อน')
      return
    }

    try {
      setSaving(true)
      await updateDeviceLocation(device.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        mapUrl: null,
      })

      await loadDevices()
      alert('บันทึกตำแหน่ง Device สำเร็จ')
    } catch (error) {
      console.error('Save picked location error:', error)
      alert(error.message || 'บันทึกตำแหน่งไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <section className="device-management-page">
        <div className="device-management-header">
          <div>
            <h2>Device Management</h2>
            <p>จัดการอุปกรณ์ dotWatch, Group, Secret และ Location</p>
          </div>

          <div className="device-header-stats">
            <div>
              <span>Total</span>
              <strong>{devices.length}</strong>
            </div>

            <div>
              <span>Online</span>
              <strong>{onlineCount}</strong>
            </div>

            <div>
              <span>Warning</span>
              <strong>{warningCount}</strong>
            </div>

            <div>
              <span>Offline</span>
              <strong>{offlineCount}</strong>
            </div>
          </div>
        </div>

        <div className="device-control-card">
          <div className="device-add-box">
            <input
              type="text"
              placeholder="ชื่อ Device เช่น dotWatch 01"
              value={deviceName}
              disabled={saving}
              onChange={(e) => setDeviceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddDevice()
              }}
            />

            <button
              className="primary-button"
              onClick={handleAddDevice}
              disabled={saving}
            >
              <Plus size={18} />
              {saving ? 'กำลังบันทึก...' : 'เพิ่ม Device'}
            </button>
          </div>

          <div className="device-filter-box">
            <div className="device-search-box">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search device..."
              />
            </div>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-device">
            <h3>กำลังโหลดข้อมูล</h3>
            <p>กำลังดึงข้อมูล Device จาก Backend</p>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="empty-device">
            <h3>ไม่พบ Device</h3>
            <p>ลองเปลี่ยนคำค้นหา หรือเพิ่มอุปกรณ์ใหม่</p>
          </div>
        ) : (
          <div className="device-management-grid">
            {filteredDevices.map((device) => (
              <article key={device.id} className="device-management-card">
                <div className="device-management-card-header">
                  <div>
                    <h3>{device.name || device.device_code}</h3>
                    <p>{device.device_code}</p>
                  </div>

                  <span className={`status ${device.status || 'offline'}`}>
                    {device.status || 'offline'}
                  </span>
                </div>

                {editingDeviceId === device.id ? (
                  <div className="device-edit-row clean">
                    <input
                      className="device-edit-input"
                      type="text"
                      value={editingName}
                      disabled={saving}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="ชื่อ Device"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveDeviceName(device.id)
                        }

                        if (e.key === 'Escape') {
                          setEditingDeviceId(null)
                          setEditingName('')
                        }
                      }}
                    />

                    <button
                      className="save-btn square"
                      disabled={saving}
                      onClick={() => handleSaveDeviceName(device.id)}
                      title="Save"
                    >
                      <Save size={16} />
                    </button>

                    <button
                      className="cancel-btn square"
                      disabled={saving}
                      onClick={() => {
                        setEditingDeviceId(null)
                        setEditingName('')
                      }}
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : null}

                <div className="device-management-meta">
                  <label>
                    Group
                    <select
                      value={device.group_name || 'Default'}
                      disabled={saving}
                      onChange={(e) =>
                        handleChangeGroup(device.id, e.target.value)
                      }
                    >
                      <option value="Default">Default</option>
                      <option value="Server Room">Server Room</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Factory">Factory</option>
                      <option value="Demo">Demo</option>
                    </select>
                  </label>
                </div>

                <DeviceCard
                  device={{
                    ...device,
                    deviceId: device.device_code,
                    lastSeen: device.latest_time || device.last_seen_at,
                  }}
                />

                <div className="device-location-section compact">
                  <div className="device-location-header">
                    <strong>
                      <MapPin size={16} />
                      Device Location
                    </strong>
                    <span>คลิกบนแผนที่เพื่อเลือกตำแหน่ง</span>
                  </div>

                  <LocationPicker
                    latitude={device.latitude}
                    longitude={device.longitude}
                    onChange={(location) =>
                      setLocations((prev) => ({
                        ...prev,
                        [device.id]: location,
                      }))
                    }
                  />

                  <button
                    type="button"
                    className="save-btn location-save-btn"
                    disabled={saving}
                    onClick={() => handleSavePickedLocation(device)}
                  >
                    Save Map Location
                  </button>
                </div>

                <div className="device-action-row">
                  {editingDeviceId !== device.id && (
                    <button
                      className="rename-btn"
                      disabled={saving}
                      onClick={() => {
                        setEditingDeviceId(device.id)
                        setEditingName(device.name || '')
                      }}
                    >
                      <Edit3 size={16} />
                      แก้ไขชื่อ
                    </button>
                  )}

                  <button
                    className="save-btn"
                    disabled={saving}
                    onClick={() => handleResetSecret(device)}
                  >
                    <KeyRound size={16} />
                    Reset Secret
                  </button>

                  <button
                    className="delete-btn"
                    disabled={saving}
                    onClick={() => handleDeleteDevice(device.id)}
                  >
                    <Trash2 size={16} />
                    ลบ Device
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Device
