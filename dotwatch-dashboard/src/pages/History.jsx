import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Download,
  RefreshCcw,
  Search,
  Table2,
} from 'lucide-react'
import {
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard,
  StatusBadge,
} from '../components/common'
import { getDevices, getDeviceHistory, getDeviceMetrics } from '../services/api'
import {
  DEFAULT_METRICS,
  formatMetricValue,
  normalizeMetrics,
} from '../utils/metricDisplayConfig'

const PAGE_SIZE = 25

function getTodayDateInput() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateRange(dateText) {
  const start = new Date(`${dateText}T00:00:00`)
  const end = new Date(`${dateText}T23:59:59.999`)

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

function normalizeHistoryResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.history)) return data.history
  if (Array.isArray(data?.readings)) return data.readings
  return []
}

function getRowTime(row) {
  return row?.time || row?.latest_time || row?.created_at || row?.timestamp
}

function formatDateTime(value) {
  if (!value) return '--'

  try {
    return new Date(value).toLocaleString('th-TH')
  } catch {
    return value
  }
}

function getMetricValueFromRow(row, metricKey) {
  if (!row || !metricKey) return null

  if (row[metricKey] != null) return row[metricKey]
  if (row.latest_metrics?.[metricKey] != null) return row.latest_metrics[metricKey]
  if (row.metrics?.[metricKey] != null) return row.metrics[metricKey]

  return null
}

function normalizeRows(rawRows) {
  const hasMetricKeyRows = rawRows.some(
    (row) => row.metric_key || row.metricKey || row.metric
  )

  if (!hasMetricKeyRows) {
    return rawRows
      .map((row) => ({
        ...row,
        time: getRowTime(row),
      }))
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
  }

  const grouped = new Map()

  rawRows.forEach((row) => {
    const time = getRowTime(row)
    const metricKey = row.metric_key || row.metricKey || row.metric
    const value = row.value ?? row.metric_value ?? row[metricKey]

    if (!time || !metricKey) return

    const existing = grouped.get(time) || { time }
    existing[metricKey] = value
    grouped.set(time, existing)
  })

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.time || 0) - new Date(a.time || 0)
  )
}

function getNumberValues(rows, columns) {
  const values = []

  rows.forEach((row) => {
    columns.forEach((column) => {
      const value = Number(getMetricValueFromRow(row, column.key))
      if (Number.isFinite(value)) values.push(value)
    })
  })

  return values
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '--'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function downloadCsv(filename, rows, columns) {
  const escapeCell = (value) => {
    if (value == null) return ''
    const text = String(value).replace(/"/g, '""')
    return `"${text}"`
  }

  const header = ['Timestamp', ...columns.map((column) => column.label)]
  const body = rows.map((row) => [
    formatDateTime(row.time),
    ...columns.map((column) =>
      formatMetricValue(getMetricValueFromRow(row, column.key), column.unit)
    ),
  ])

  const csv = [header, ...body]
    .map((line) => line.map(escapeCell).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function History() {
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayDateInput())
  const [selectedMetric, setSelectedMetric] = useState('all')
  const [metricConfigs, setMetricConfigs] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')

  const selectedDevice = useMemo(() => {
    return devices.find((device) => String(device.id) === String(selectedDeviceId))
  }, [devices, selectedDeviceId])

  const metricOptions = useMemo(() => {
    const normalized = normalizeMetrics(metricConfigs)
    return normalized.length > 0 ? normalized : DEFAULT_METRICS
  }, [metricConfigs])

  const visibleMetrics = useMemo(() => {
    const metrics = metricOptions.filter((metric) => metric.visible !== false)
    if (selectedMetric === 'all') return metrics
    return metrics.filter((metric) => metric.metric_key === selectedMetric)
  }, [metricOptions, selectedMetric])

  const columns = useMemo(() => {
    return visibleMetrics.map((metric) => ({
      key: metric.metric_key,
      label: metric.metric_name || metric.metric_key,
      unit: metric.unit || '',
    }))
  }, [visibleMetrics])

  const rows = useMemo(() => normalizeRows(rawRows), [rawRows])

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) => {
      const values = [
        formatDateTime(row.time),
        ...columns.map((column) =>
          formatMetricValue(getMetricValueFromRow(row, column.key), column.unit)
        ),
      ]

      return values.join(' ').toLowerCase().includes(keyword)
    })
  }, [rows, columns, searchText])

  const numericValues = useMemo(
    () => getNumberValues(filteredRows, columns),
    [filteredRows, columns]
  )

  const analytics = useMemo(() => {
    const records = filteredRows.length
    const min = numericValues.length ? Math.min(...numericValues) : null
    const max = numericValues.length ? Math.max(...numericValues) : null
    const average = numericValues.length
      ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
      : null

    return { records, min, max, average }
  }, [filteredRows, numericValues])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, currentPage])

  const sampleRows = useMemo(() => {
    return rows.slice(0, 12).reverse()
  }, [rows])

  async function loadDevices() {
    try {
      setLoadingDevices(true)
      setError('')

      const data = await getDevices()
      const nextDevices = Array.isArray(data) ? data : []

      setDevices(nextDevices)

      if (!selectedDeviceId && nextDevices.length > 0) {
        setSelectedDeviceId(String(nextDevices[0].id))
      }
    } catch (loadError) {
      console.error('Load devices error:', loadError)
      setError('โหลดรายการ Device ไม่สำเร็จ')
      setDevices([])
    } finally {
      setLoadingDevices(false)
    }
  }

  async function loadMetrics(deviceId) {
    if (!deviceId) return

    try {
      const data = await getDeviceMetrics(deviceId)
      const metrics = Array.isArray(data)
        ? data
        : Array.isArray(data?.metrics)
          ? data.metrics
          : []

      setMetricConfigs(metrics.length > 0 ? metrics : DEFAULT_METRICS)
    } catch (loadError) {
      console.error('Load device metrics error:', loadError)
      setMetricConfigs(DEFAULT_METRICS)
    }
  }

  async function loadHistory() {
    if (!selectedDeviceId || !selectedDate) return

    try {
      setLoadingHistory(true)
      setError('')

      const { from, to } = getDateRange(selectedDate)
      const metricKey = selectedMetric === 'all' ? undefined : selectedMetric
      const data = await getDeviceHistory(selectedDeviceId, from, to, metricKey)

      setRawRows(normalizeHistoryResponse(data))
      setPage(1)
    } catch (loadError) {
      console.error('Load history error:', loadError)
      setError('โหลด History ไม่สำเร็จ')
      setRawRows([])
    } finally {
      setLoadingHistory(false)
    }
  }

  function handleExportCsv() {
    const deviceName = selectedDevice?.device_code || selectedDeviceId || 'device'
    const metricName = selectedMetric === 'all' ? 'all-metrics' : selectedMetric
    const filename = `dotwatch-history-${deviceName}-${selectedDate}-${metricName}.csv`
    downloadCsv(filename, filteredRows, columns)
  }

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return
    loadMetrics(selectedDeviceId)
  }, [selectedDeviceId])

  useEffect(() => {
    if (!selectedDeviceId) return
    loadHistory()
  }, [selectedDeviceId, selectedDate, selectedMetric])

  return (
    <div className="page app-page history-page history-v2-page">
      <PageHeader
        eyebrow="Data Center"
        title="History Analytics"
        description="ตรวจสอบข้อมูลย้อนหลังตาม Device, วันที่ และ Metric พร้อมสรุปค่าเฉลี่ย Min / Max และ Export CSV"
        actions={
          <div className="history-header-actions">
            <span className="history-date-chip">
              <CalendarDays size={15} />
              {selectedDate}
            </span>
            <button
              className="secondary-button"
              onClick={loadHistory}
              disabled={!selectedDeviceId || loadingHistory}
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        }
      />

      <section className="history-stat-grid">
        <StatCard
          label="Records"
          value={loadingHistory ? '...' : analytics.records}
          hint="Filtered rows"
        />
        <StatCard
          label="Average"
          value={formatNumber(analytics.average)}
          hint="All selected metrics"
        />
        <StatCard label="Min" value={formatNumber(analytics.min)} hint="Lowest value" />
        <StatCard label="Max" value={formatNumber(analytics.max)} hint="Highest value" />
      </section>

      <section className="app-card history-filter-card">
        <SectionHeader
          title="Filter"
          description="เลือก Device, วันที่ และ Metric ที่ต้องการตรวจสอบ"
        />

        <div className="history-filter-grid">
          <label>
            Device
            <select
              value={selectedDeviceId}
              onChange={(event) => {
                setSelectedDeviceId(event.target.value)
                setSelectedMetric('all')
              }}
            >
              {devices.length === 0 ? (
                <option value="">No Device</option>
              ) : (
                devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name || device.device_code || `Device ${device.id}`}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <label>
            Metric
            <select
              value={selectedMetric}
              onChange={(event) => setSelectedMetric(event.target.value)}
            >
              <option value="all">All Metrics</option>
              {metricOptions
                .filter((metric) => metric.visible !== false)
                .map((metric) => (
                  <option key={metric.metric_key} value={metric.metric_key}>
                    {metric.metric_name || metric.metric_key}
                    {metric.unit ? ` (${metric.unit})` : ''}
                  </option>
                ))}
            </select>
          </label>

          <div className="history-search-box">
            <Search size={16} />
            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                setPage(1)
              }}
              placeholder="Search table..."
            />
          </div>

          <button
            className="primary-button history-export-button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </section>

      <section className="history-content-grid">
        <section className="app-card history-chart-card">
          <div className="history-card-title-row">
            <SectionHeader
              title="Daily Snapshot"
              description="มุมมองแบบเร็วจากข้อมูลล่าสุดของวันที่เลือก"
            />
            <StatusBadge status={loadingHistory ? 'warning' : 'online'}>
              {loadingHistory ? 'Loading' : `${filteredRows.length} Rows`}
            </StatusBadge>
          </div>

          {sampleRows.length === 0 ? (
            <EmptyState
              title="ยังไม่มีข้อมูลสำหรับกราฟ"
              description="เลือก Device และวันที่ที่มีข้อมูลย้อนหลัง"
            />
          ) : (
            <div className="history-sparkline-list">
              {columns.slice(0, 4).map((column) => {
                const values = sampleRows.map((row) => {
                  const value = Number(getMetricValueFromRow(row, column.key))
                  return Number.isFinite(value) ? value : null
                })
                const valid = values.filter((value) => value != null)
                const max = valid.length ? Math.max(...valid) : 1

                return (
                  <div key={column.key} className="history-sparkline-row">
                    <div>
                      <strong>{column.label}</strong>
                      <span>{column.unit || 'value'}</span>
                    </div>

                    <div className="history-sparkline-bars">
                      {values.map((value, index) => (
                        <i
                          key={`${column.key}-${index}`}
                          style={{
                            height: `${Math.max(10, ((value || 0) / max) * 100)}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="app-card history-device-card">
          <SectionHeader
            title="Selected Device"
            description="Device ที่กำลังดูข้อมูลย้อนหลัง"
          />

          {selectedDevice ? (
            <div className="history-device-summary">
              <div className="history-device-icon">
                <Table2 size={22} />
              </div>
              <h3>{selectedDevice.name || 'Unnamed Device'}</h3>
              <p>{selectedDevice.device_code || `Device ${selectedDevice.id}`}</p>
              <div className="history-device-meta">
                <span>Model</span>
                <strong>{selectedDevice.model_name || '--'}</strong>
              </div>
              <div className="history-device-meta">
                <span>Status</span>
                <StatusBadge status={selectedDevice.status || 'offline'} />
              </div>
            </div>
          ) : (
            <EmptyState
              title="ยังไม่ได้เลือก Device"
              description="เลือก Device จาก filter เพื่อเริ่มดู History"
            />
          )}
        </section>
      </section>

      <section className="app-card history-table-card">
        <div className="history-table-header">
          <SectionHeader
            title="Telemetry Table"
            description={
              selectedDevice
                ? `${selectedDevice.name || selectedDevice.device_code} • ${selectedDate}`
                : 'เลือก Device เพื่อดูข้อมูลย้อนหลัง'
            }
          />

          <div className="history-table-meta">
            <span className="history-table-count">
              <BarChart3 size={15} />
              Page {currentPage} / {totalPages}
            </span>
          </div>
        </div>

        {error ? (
          <EmptyState title="เกิดข้อผิดพลาด" description={error} />
        ) : loadingHistory ? (
          <EmptyState title="กำลังโหลด History" description="กำลังดึงข้อมูลจาก Backend" />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="ไม่พบข้อมูล"
            description="ไม่มี telemetry data สำหรับ Device และวันที่ที่เลือก"
          />
        ) : (
          <>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    {columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr key={`${row.time || 'row'}-${index}`}>
                      <td>
                        <strong>{formatDateTime(row.time)}</strong>
                      </td>
                      {columns.map((column) => (
                        <td key={column.key}>
                          {formatMetricValue(
                            getMetricValueFromRow(row, column.key),
                            column.unit
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="history-mobile-list">
              {pagedRows.map((row, index) => (
                <article
                  key={`mobile-${row.time || 'row'}-${index}`}
                  className="history-mobile-card"
                >
                  <div className="history-mobile-card-time">
                    <span>Timestamp</span>
                    <strong>{formatDateTime(row.time)}</strong>
                  </div>

                  <div className="history-mobile-card-values">
                    {columns.map((column) => (
                      <div key={column.key}>
                        <span>{column.label}</span>
                        <strong>
                          {formatMetricValue(
                            getMetricValueFromRow(row, column.key),
                            column.unit
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="history-pagination">
              <button
                className="secondary-button"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Prev
              </button>

              <span>
                Page {currentPage} of {totalPages}
              </span>

              <button
                className="secondary-button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default History
