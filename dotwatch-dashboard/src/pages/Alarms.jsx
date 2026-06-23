import { useEffect, useMemo, useState } from 'react'
import {
  acknowledgeAlarm,
  deleteAlarmRule,
  getAlarmRules,
  getAlarms,
  getDevices,
  getDeviceMetrics,
  updateAlarmRule,
} from '../services/api'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'

function formatDate(value) {
  if (!value) return '--'

  try {
    return new Date(value).toLocaleString('th-TH')
  } catch {
    return value
  }
}

function formatRelativeTime(value) {
  if (!value) return '--'

  const date = new Date(value)
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))

  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`

  return `${Math.floor(diffSeconds / 86400)}d ago`
}

function formatValue(value, unit = '') {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '--'

  const numberValue = Number(value)
  const displayValue = Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(1)

  return `${displayValue}${unit ? ` ${unit}` : ''}`
}

function getSeverityLabel(severity) {
  if (severity === 'critical') return 'Critical'
  if (severity === 'warning') return 'Warning'
  return severity || 'Unknown'
}

function getStatusLabel(status) {
  if (status === 'active') return 'Active'
  if (status === 'acknowledged') return 'Acknowledged'
  return status || 'Unknown'
}

function getSeverityIcon(severity) {
  if (severity === 'critical') return <ShieldAlert size={18} />
  return <AlertTriangle size={18} />
}

function Alarms() {
  const [alarms, setAlarms] = useState([])
  const [rules, setRules] = useState([])
  const [devices, setDevices] = useState([])
  const [deviceMetrics, setDeviceMetrics] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [severityFilter, setSeverityFilter] = useState('all')

  async function loadData() {
    try {
      setLoading(true)

      const [alarmData, ruleData, deviceData] = await Promise.all([
        getAlarms(),
        getAlarmRules(),
        getDevices(),
      ])

      const nextAlarms = Array.isArray(alarmData) ? alarmData : []
      const nextRules = Array.isArray(ruleData) ? ruleData : []
      const nextDevices = Array.isArray(deviceData) ? deviceData : []

      setAlarms(nextAlarms)
      setRules(nextRules)
      setDevices(nextDevices)

      const metricEntries = await Promise.all(
        nextDevices.map(async (device) => {
          try {
            const metrics = await getDeviceMetrics(device.id)
            return [device.id, Array.isArray(metrics) ? metrics : []]
          } catch (error) {
            console.error(`Load metrics error device ${device.id}:`, error)
            return [device.id, []]
          }
        })
      )

      setDeviceMetrics(Object.fromEntries(metricEntries))
    } catch (error) {
      console.error('Load alarms error:', error)
      alert(error.message || 'โหลดข้อมูล Alarm ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function getMetricInfo(deviceId, metricKey) {
    const metrics = deviceMetrics[deviceId] || []
    const metric = metrics.find((item) => item.metric_key === metricKey)

    return {
      name: metric?.metric_name || metricKey || '--',
      unit: metric?.unit || '',
    }
  }

  async function handleAcknowledge(alarmId) {
    try {
      setSaving(true)
      await acknowledgeAlarm(alarmId)
      await loadData()
    } catch (error) {
      console.error('Acknowledge alarm error:', error)
      alert(error.message || 'Acknowledge ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRule(rule) {
    try {
      setSaving(true)

      await updateAlarmRule(rule.id, {
        device_id: rule.device_id,
        metric: rule.metric,
        operator: rule.operator,
        threshold: rule.threshold,
        severity: rule.severity,
        is_active: !rule.is_active,
      })

      await loadData()
    } catch (error) {
      console.error('Toggle rule error:', error)
      alert(error.message || 'แก้ไขสถานะ Rule ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRule(ruleId) {
    const ok = confirm('ต้องการลบ Alarm Rule นี้ใช่ไหม?')
    if (!ok) return

    try {
      setSaving(true)
      await deleteAlarmRule(ruleId)
      await loadData()
    } catch (error) {
      console.error('Delete rule error:', error)
      alert(error.message || 'ลบ Alarm Rule ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    return alarms.reduce(
      (acc, alarm) => {
        acc.total += 1

        if (alarm.status === 'active') acc.active += 1
        if (alarm.status === 'acknowledged') acc.acknowledged += 1
        if (alarm.severity === 'critical') acc.critical += 1
        if (alarm.severity === 'warning') acc.warning += 1

        return acc
      },
      {
        total: 0,
        active: 0,
        acknowledged: 0,
        critical: 0,
        warning: 0,
      }
    )
  }, [alarms])

  const activeAlarms = useMemo(() => {
    return alarms.filter((alarm) => alarm.status === 'active')
  }, [alarms])

  const criticalAlarms = useMemo(() => {
    return activeAlarms.filter((alarm) => alarm.severity === 'critical')
  }, [activeAlarms])

  const filteredAlarms = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return alarms.filter((alarm) => {
      const metricInfo = getMetricInfo(alarm.device_id, alarm.metric)

      const text = [
        alarm.device_name,
        alarm.device_code,
        alarm.metric,
        metricInfo.name,
        alarm.severity,
        alarm.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchSearch = !keyword || text.includes(keyword)
      const matchStatus = statusFilter === 'all' || alarm.status === statusFilter
      const matchSeverity =
        severityFilter === 'all' || alarm.severity === severityFilter

      return matchSearch && matchStatus && matchSeverity
    })
  }, [alarms, search, statusFilter, severityFilter, deviceMetrics])

  const latestCritical = criticalAlarms[0]

  return (
    <div className="page app-page alarms-page alarm-center-page">
      <section className="alarm-center-hero">
        <div>
          <span className="page-eyebrow">Alarm Center</span>
          <h1>Operations Alarm Center</h1>
          <p>
            ตรวจสอบ Alarm Events, Active Alarm และ Alarm Rules ของอุปกรณ์ทั้งหมด
          </p>
        </div>

        <button
          type="button"
          className="ghost-button"
          onClick={loadData}
          disabled={loading || saving}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>

      <section className="alarm-summary-grid">
        <article className="alarm-summary-card active">
          <span>Active Alarms</span>
          <strong>{summary.active}</strong>
          <small>ต้องตรวจสอบ</small>
        </article>

        <article className="alarm-summary-card critical">
          <span>Critical</span>
          <strong>{summary.critical}</strong>
          <small>ระดับรุนแรง</small>
        </article>

        <article className="alarm-summary-card warning">
          <span>Warning</span>
          <strong>{summary.warning}</strong>
          <small>ควรติดตาม</small>
        </article>

        <article className="alarm-summary-card rules">
          <span>Alarm Rules</span>
          <strong>{rules.length}</strong>
          <small>{rules.filter((rule) => rule.is_active).length} Active</small>
        </article>
      </section>

      <section className="alarm-center-grid">
        <div className="alarm-center-main">
          <section className="app-card alarm-panel-card">
            <div className="alarm-panel-header">
              <div>
                <h2>Active Alarms</h2>
                <p>รายการแจ้งเตือนที่ยังไม่ได้ Acknowledge</p>
              </div>
              <span className="status active">{activeAlarms.length} Active</span>
            </div>

            {loading ? (
              <div className="app-empty-state compact">
                <h3>กำลังโหลดข้อมูล</h3>
                <p>กำลังดึงข้อมูล Alarm จาก Backend</p>
              </div>
            ) : activeAlarms.length === 0 ? (
              <div className="alarm-clear-state">
                <CheckCircle2 size={34} />
                <h3>No Active Alarm</h3>
                <p>ตอนนี้ยังไม่มี Alarm ที่ต้องดำเนินการ</p>
              </div>
            ) : (
              <div className="active-alarm-list">
                {activeAlarms.slice(0, 8).map((alarm) => {
                  const metricInfo = getMetricInfo(alarm.device_id, alarm.metric)

                  return (
                    <article
                      key={alarm.id}
                      className={`active-alarm-card ${alarm.severity || 'warning'}`}
                    >
                      <div className="active-alarm-icon">
                        {getSeverityIcon(alarm.severity)}
                      </div>

                      <div className="active-alarm-content">
                        <div className="active-alarm-topline">
                          <strong>{alarm.device_name || 'Unnamed Device'}</strong>
                          <span className={`status ${alarm.severity}`}>
                            {getSeverityLabel(alarm.severity)}
                          </span>
                        </div>

                        <p>
                          {alarm.metric_name || metricInfo.name}{' '}
                          {alarm.operator}{' '}
                          {formatValue(alarm.threshold, metricInfo.unit)}
                        </p>

                        <div className="active-alarm-meta">
                          <span>
                            Current:{' '}
                            <b>{formatValue(alarm.value, metricInfo.unit)}</b>
                          </span>
                          <span>{formatRelativeTime(alarm.triggered_at)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="save-btn alarm-ack-btn"
                        disabled={saving}
                        onClick={() => handleAcknowledge(alarm.id)}
                      >
                        <CheckCircle2 size={15} />
                        Ack
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="app-card alarm-panel-card">
            <div className="alarm-panel-header with-toolbar">
              <div>
                <h2>Alarm Events</h2>
                <p>ประวัติ Alarm ล่าสุดจาก Dynamic Metrics</p>
              </div>
            </div>

            <div className="alarm-toolbar clean">
              <label className="search-input">
                <Search size={16} />
                <input
                  value={search}
                  placeholder="Search device, metric, severity..."
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
              </select>
            </div>

            {filteredAlarms.length === 0 ? (
              <div className="app-empty-state">
                <Bell size={30} />
                <h3>ยังไม่มี Alarm</h3>
                <p>เมื่อมีค่าเกินเงื่อนไข ระบบจะแสดงรายการที่นี่</p>
              </div>
            ) : (
              <div className="alarm-table-wrap">
                <table className="device-v2-table alarm-table alarm-center-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Metric</th>
                      <th>Condition</th>
                      <th>Value</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Triggered</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAlarms.map((alarm) => {
                      const metricInfo = getMetricInfo(alarm.device_id, alarm.metric)

                      return (
                        <tr key={alarm.id}>
                          <td>
                            <strong>{alarm.device_name || 'Unnamed Device'}</strong>
                            <span>{alarm.device_code || `ID ${alarm.device_id}`}</span>
                          </td>

                          <td>
                            <strong>{alarm.metric_name || metricInfo.name}</strong>
                            <span>{alarm.metric}</span>
                          </td>

                          <td>
                            {alarm.operator}{' '}
                            {formatValue(alarm.threshold, metricInfo.unit)}
                          </td>

                          <td>
                            <strong>{formatValue(alarm.value, metricInfo.unit)}</strong>
                          </td>

                          <td>
                            <span className={`status ${alarm.severity}`}>
                              {getSeverityLabel(alarm.severity)}
                            </span>
                          </td>

                          <td>
                            <span className={`status ${alarm.status}`}>
                              {getStatusLabel(alarm.status)}
                            </span>
                          </td>

                          <td>{formatDate(alarm.triggered_at)}</td>

                          <td>
                            {alarm.status === 'active' && (
                              <button
                                type="button"
                                className="save-btn"
                                disabled={saving}
                                onClick={() => handleAcknowledge(alarm.id)}
                              >
                                <CheckCircle2 size={15} />
                                Ack
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="alarm-center-side">
          <section className="app-card critical-focus-card">
            <div className="critical-focus-icon">
              <CircleAlert size={22} />
            </div>

            <span>Critical Focus</span>

            {latestCritical ? (
              <>
                <h3>{latestCritical.device_name || 'Unnamed Device'}</h3>
                <p>
                  {latestCritical.metric_name || latestCritical.metric}{' '}
                  {latestCritical.operator}{' '}
                  {formatValue(latestCritical.threshold, getMetricInfo(latestCritical.device_id, latestCritical.metric).unit)}
                </p>
                <strong>
                  {formatValue(
                    latestCritical.value,
                    getMetricInfo(latestCritical.device_id, latestCritical.metric).unit
                  )}
                </strong>
                <small>{formatRelativeTime(latestCritical.triggered_at)}</small>
              </>
            ) : (
              <>
                <h3>No Critical Alarm</h3>
                <p>ยังไม่มี Critical Alarm ที่ต้องรีบจัดการ</p>
              </>
            )}
          </section>

          <section className="app-card alarm-rules-card">
            <div className="alarm-panel-header compact">
              <div>
                <h2>Alarm Rules</h2>
                <p>Rule ทั้งหมดที่ตั้งไว้</p>
              </div>
            </div>

            {rules.length === 0 ? (
              <div className="app-empty-state compact">
                <AlertTriangle size={30} />
                <h3>ยังไม่มี Rule</h3>
                <p>ไปที่หน้า Device เพื่อกำหนด Rule</p>
              </div>
            ) : (
              <div className="alarm-rule-list-clean">
                {rules.slice(0, 10).map((rule) => {
                  const metricInfo = getMetricInfo(rule.device_id, rule.metric)

                  return (
                    <article key={rule.id} className="alarm-rule-card-clean">
                      <div>
                        <strong>{rule.device_name || 'Unnamed Device'}</strong>
                        <span>
                          {rule.metric_name || metricInfo.name} {rule.operator}{' '}
                          {formatValue(rule.threshold, metricInfo.unit)}
                        </span>
                      </div>

                      <div className="alarm-rule-card-actions">
                        <button
                          type="button"
                          className={rule.is_active ? 'status online' : 'status offline'}
                          disabled={saving}
                          onClick={() => handleToggleRule(rule)}
                        >
                          {rule.is_active ? 'Active' : 'Off'}
                        </button>

                        <button
                          type="button"
                          className="delete-btn square"
                          disabled={saving}
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Delete rule"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  )
}

export default Alarms
