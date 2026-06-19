import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  getDevices,
  getDeviceHistory,
} from '../services/api'

const MAX_POINTS = 144

function formatTime(value) {
  if (!value) return '--'

  const date = new Date(value)

  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeHistory(rows = []) {
  return rows
    .map((item) => ({
      time: item.time || item.created_at || item.latest_time,
      label: formatTime(item.time || item.created_at || item.latest_time),
      temperature:
        item.temperature != null
          ? Number(item.temperature)
          : null,
      humidity:
        item.humidity != null
          ? Number(item.humidity)
          : null,
    }))
    .filter(
      (item) =>
        item.time &&
        (item.temperature != null || item.humidity != null)
    )
    .slice(-MAX_POINTS)
}

function ChartWidget() {
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [chartData, setChartData] = useState([])
  const [chartSize, setChartSize] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lastTimeRef = useRef(null)

  const chartHeight = useMemo(() => {
    if (chartSize === 'small') return 300
    if (chartSize === 'large') return 520
    return 420
  }, [chartSize])

  async function loadDevices() {
    try {
      const data = await getDevices()
      const list = Array.isArray(data) ? data : []

      setDevices(list)

      if (!selectedDeviceId && list.length > 0) {
        setSelectedDeviceId(String(list[0].id))
      }
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถโหลดรายการอุปกรณ์ได้')
    }
  }

  async function loadHistory(deviceId, replace = false) {
    if (!deviceId) return

    try {
      setLoading(true)
      setError('')

      const rows = await getDeviceHistory(deviceId)
      const nextData = normalizeHistory(Array.isArray(rows) ? rows : [])

      if (replace) {
        setChartData(nextData)
        lastTimeRef.current =
          nextData.length > 0
            ? nextData[nextData.length - 1].time
            : null
        return
      }

      if (nextData.length === 0) return

      const latest = nextData[nextData.length - 1]

      if (latest.time === lastTimeRef.current) {
        return
      }

      setChartData((prev) => {
        const merged = [...prev]

        nextData.forEach((item) => {
          const exists = merged.some(
            (oldItem) => oldItem.time === item.time
          )

          if (!exists) {
            merged.push(item)
          }
        })

        const trimmed = merged.slice(-MAX_POINTS)

        lastTimeRef.current =
          trimmed.length > 0
            ? trimmed[trimmed.length - 1].time
            : null

        return trimmed
      })
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถโหลดข้อมูลกราฟได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return

    lastTimeRef.current = null
    loadHistory(selectedDeviceId, true)

    const timer = setInterval(() => {
      loadHistory(selectedDeviceId, false)
    }, 5000)

    return () => clearInterval(timer)
  }, [selectedDeviceId])

  function handleExportCSV() {
    if (!chartData.length) return

    const header = ['time', 'temperature', 'humidity']

    const rows = chartData.map((item) => [
      item.time,
      item.temperature ?? '',
      item.humidity ?? '',
    ])

    const csv = [
      header.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `dotwatch-history-${selectedDeviceId}.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <section className="chart-card">
      <div className="chart-header">
        <div>
          <p className="section-eyebrow">Realtime Sensor Activity</p>
          <h2>Temperature & Humidity</h2>
          <span>
            แสดงข้อมูลล่าสุดจากอุปกรณ์แบบเรียลไทม์
          </span>
        </div>

        <div className="chart-actions">
          <select
            value={selectedDeviceId}
            onChange={(event) =>
              setSelectedDeviceId(event.target.value)
            }
          >
            {devices.length === 0 ? (
              <option value="">No device</option>
            ) : (
              devices.map((device) => (
                <option
                  key={device.id}
                  value={device.id}
                >
                  {device.name ||
                    device.device_code ||
                    `Device ${device.id}`}
                </option>
              ))
            )}
          </select>

          <select
            value={chartSize}
            onChange={(event) =>
              setChartSize(event.target.value)
            }
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>

          <button
            type="button"
            className="export-button"
            onClick={handleExportCSV}
            disabled={!chartData.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="chart-message error">
          {error}
        </div>
      )}

      {!error && loading && chartData.length === 0 && (
        <div className="chart-message">
          กำลังโหลดข้อมูล...
        </div>
      )}

      {!error && !loading && chartData.length === 0 && (
        <div className="chart-message">
          ยังไม่มีข้อมูลสำหรับอุปกรณ์นี้
        </div>
      )}

      {chartData.length > 0 && (
        <div
          className="chart-wrapper"
          style={{ height: chartHeight }}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={chartData}
              margin={{
                top: 24,
                right: 18,
                left: -10,
                bottom: 8,
              }}
            >
              <defs>
                <linearGradient
                  id="temperatureGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#ef4444"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="#ef4444"
                    stopOpacity={0}
                  />
                </linearGradient>

                <linearGradient
                  id="humidityGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#2563eb"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="#2563eb"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                minTickGap={28}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                width={42}
                domain={['auto', 'auto']}
              />

              <Tooltip
                animationDuration={0}
                labelFormatter={(label) => `เวลา ${label}`}
                formatter={(value, name) => {
                  if (name === 'temperature') {
                    return [`${Number(value).toFixed(1)} °C`, 'Temperature']
                  }

                  if (name === 'humidity') {
                    return [`${Number(value).toFixed(1)} %`, 'Humidity']
                  }

                  return [value, name]
                }}
                contentStyle={{
                  border: 'none',
                  borderRadius: 14,
                  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                }}
              />

              <Legend
                verticalAlign="top"
                height={36}
              />

              <Area
                type="monotone"
                dataKey="temperature"
                name="Temperature"
                stroke="#ef4444"
                fill="url(#temperatureGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />

              <Area
                type="monotone"
                dataKey="humidity"
                name="Humidity"
                stroke="#2563eb"
                fill="url(#humidityGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default ChartWidget