import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDevices, getHistory } from '../services/api'

const RANGE_OPTIONS = [
  { label: '1H', value: '1h', hours: 1 },
  { label: '6H', value: '6h', hours: 6 },
  { label: '24H', value: '24h', hours: 24 },
  { label: '7D', value: '7d', days: 7 },
  { label: '30D', value: '30d', days: 30 },
]

function getDateRange(range) {
  const now = new Date()
  const option = RANGE_OPTIONS.find((item) => item.value === range)

  const from = new Date(now)

  if (option?.days) {
    from.setDate(now.getDate() - option.days)
  } else {
    from.setHours(now.getHours() - (option?.hours || 24))
  }

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  }
}

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('th-TH', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeHistory(items) {
  return (items || []).map((item) => {
    const timestamp = item.bucket_time || item.time || item.latest_time

    return {
      timestamp,
      label: formatTime(timestamp),
      temperature:
        item.avg_temperature != null
          ? Number(item.avg_temperature)
          : item.temperature != null
          ? Number(item.temperature)
          : null,
      humidity:
        item.avg_humidity != null
          ? Number(item.avg_humidity)
          : item.humidity != null
          ? Number(item.humidity)
          : null,
      rssi:
        item.avg_rssi != null
          ? Number(item.avg_rssi)
          : item.rssi != null
          ? Number(item.rssi)
          : null,
    }
  })
}

function getValues(data, key) {
  return data
    .map((item) => Number(item[key]))
    .filter((value) => Number.isFinite(value))
}

function getAverage(data, key) {
  const values = getValues(data, key)
  if (!values.length) return '--'

  const total = values.reduce((sum, value) => sum + value, 0)
  return (total / values.length).toFixed(1)
}

function getMin(data, key) {
  const values = getValues(data, key)
  if (!values.length) return '--'
  return Math.min(...values).toFixed(1)
}

function getMax(data, key) {
  const values = getValues(data, key)
  if (!values.length) return '--'
  return Math.max(...values).toFixed(1)
}

function exportCsv(device, range, data) {
  const rows = [
    ['device_code', 'device_name', 'range', 'time', 'temperature', 'humidity', 'rssi'],
    ...data.map((row) => [
      device?.device_code || '',
      device?.name || '',
      range,
      row.timestamp || '',
      row.temperature ?? '',
      row.humidity ?? '',
      row.rssi ?? '',
    ]),
  ]

  const csv = rows.map((row) => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${device?.device_code || 'device'}-${range}-history.csv`
  link.click()

  URL.revokeObjectURL(url)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <strong>{formatTime(label)}</strong>

      {payload.map((item) => (
        <div key={item.dataKey} className="chart-tooltip-row">
          <span>{item.name}</span>
          <b>
            {item.value}
            {item.dataKey === 'temperature' && '°C'}
            {item.dataKey === 'humidity' && '%'}
            {item.dataKey === 'rssi' && ' dBm'}
          </b>
        </div>
      ))}
    </div>
  )
}

function ChartWidget({ deviceId }) {
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(deviceId || '')
  const [range, setRange] = useState('24h')
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showTemperature, setShowTemperature] = useState(true)
  const [showHumidity, setShowHumidity] = useState(true)
  const [showRSSI, setShowRSSI] = useState(false)

  const selectedDevice = useMemo(
    () => devices.find((device) => String(device.id) === String(selectedDeviceId)),
    [devices, selectedDeviceId]
  )

  const latestData = chartData[chartData.length - 1]

  async function loadDevices() {
    const data = await getDevices()
    const list = Array.isArray(data) ? data : []

    setDevices(list)

    if (!selectedDeviceId && list.length > 0) {
      setSelectedDeviceId(list[0].id)
    }
  }

  async function loadHistory(targetDeviceId = selectedDeviceId, targetRange = range) {
    if (!targetDeviceId) return

    try {
      setLoading(true)
      setError('')

      const { from, to } = getDateRange(targetRange)
      const data = await getHistory(targetDeviceId, from, to)

      setChartData(normalizeHistory(data))
    } catch (err) {
      console.error(err)
      setError('โหลดข้อมูลกราฟไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    if (deviceId) {
      setSelectedDeviceId(deviceId)
    }
  }, [deviceId])

  useEffect(() => {
    if (selectedDeviceId) {
      loadHistory(selectedDeviceId, range)
    }
  }, [selectedDeviceId, range])

  useEffect(() => {
    if (!selectedDeviceId) return

    const timer = setInterval(() => {
      loadHistory(selectedDeviceId, range)
    }, 15000)

    return () => clearInterval(timer)
  }, [selectedDeviceId, range])

  return (
    <section className="chart-panel">
      <div className="chart-header">
        <div>
          <h2>Sensor Analytics</h2>
          <p>กราฟวิเคราะห์ข้อมูลย้อนหลังของอุปกรณ์</p>
        </div>

        <div className="chart-actions">
          {!deviceId && (
            <select
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
            >
              <option value="">เลือก Device</option>

              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name || device.device_code}
                </option>
              ))}
            </select>
          )}

          <select value={range} onChange={(event) => setRange(event.target.value)}>
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="ghost-button"
            onClick={() => loadHistory(selectedDeviceId, range)}
          >
            Refresh
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => exportCsv(selectedDevice, range, chartData)}
            disabled={!chartData.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="realtime-stats">
        <article className="realtime-stat">
          <p>Temperature</p>
          <strong>
            {latestData?.temperature != null
              ? `${latestData.temperature.toFixed(1)}°C`
              : '--'}
          </strong>
          <span>Avg {getAverage(chartData, 'temperature')}°C</span>
          <small>
            Min {getMin(chartData, 'temperature')}°C | Max{' '}
            {getMax(chartData, 'temperature')}°C
          </small>
        </article>

        <article className="realtime-stat">
          <p>Humidity</p>
          <strong>
            {latestData?.humidity != null
              ? `${latestData.humidity.toFixed(1)}%`
              : '--'}
          </strong>
          <span>Avg {getAverage(chartData, 'humidity')}%</span>
          <small>
            Min {getMin(chartData, 'humidity')}% | Max{' '}
            {getMax(chartData, 'humidity')}%
          </small>
        </article>

        <article className="realtime-stat">
          <p>RSSI</p>
          <strong>
            {latestData?.rssi != null ? `${latestData.rssi} dBm` : '--'}
          </strong>
          <span>Avg {getAverage(chartData, 'rssi')} dBm</span>
          <small>
            Min {getMin(chartData, 'rssi')} | Max {getMax(chartData, 'rssi')}
          </small>
        </article>
      </div>

      <div className="chart-toggles">
        <button
          type="button"
          className={showTemperature ? 'filter-button active' : 'filter-button'}
          onClick={() => setShowTemperature((value) => !value)}
        >
          Temperature
        </button>

        <button
          type="button"
          className={showHumidity ? 'filter-button active' : 'filter-button'}
          onClick={() => setShowHumidity((value) => !value)}
        >
          Humidity
        </button>

        <button
          type="button"
          className={showRSSI ? 'filter-button active' : 'filter-button'}
          onClick={() => setShowRSSI((value) => !value)}
        >
          RSSI
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {loading && <div className="loading">Loading chart...</div>}

      {!loading && !chartData.length && (
        <div className="empty-state">
          <h3>No chart data</h3>
          <p>ยังไม่มีข้อมูลย้อนหลังสำหรับอุปกรณ์นี้</p>
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={390}>
            <AreaChart data={chartData} margin={{ top: 18, right: 24, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="temperatureGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>

                <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>

                <linearGradient id="rssiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                minTickGap={42}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {showTemperature && (
                <Area
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature"
                  stroke="#ef4444"
                  fill="url(#temperatureGradient)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}

              {showHumidity && (
                <Area
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity"
                  stroke="#2563eb"
                  fill="url(#humidityGradient)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}

              {showRSSI && (
                <Area
                  type="monotone"
                  dataKey="rssi"
                  name="RSSI"
                  stroke="#10b981"
                  fill="url(#rssiGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}

              <Brush
                dataKey="timestamp"
                height={28}
                travellerWidth={10}
                tickFormatter={formatTime}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default ChartWidget