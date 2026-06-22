import { pool } from '../db/pool.js'

const DEFAULT_METRICS = [
  {
    metric_key: 'temperature',
    metric_name: 'Temperature',
    metric_type: 'temperature',
    unit: '°C',
    icon: 'Thermometer',
    visible: true,
    sort_order: 0,
  },
  {
    metric_key: 'humidity',
    metric_name: 'Humidity',
    metric_type: 'humidity',
    unit: '%',
    icon: 'Droplets',
    visible: true,
    sort_order: 1,
  },
  {
    metric_key: 'rssi',
    metric_name: 'Signal',
    metric_type: 'signal',
    unit: 'dBm',
    icon: 'Wifi',
    visible: true,
    sort_order: 2,
  },
]

function normalizeMetricKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeMetricType(value = '') {
  return normalizeMetricKey(value)
}

function cleanMetric(metric, index) {
  const metricName = String(metric.metric_name || metric.name || '').trim()
  const metricKey = normalizeMetricKey(
    metric.metric_key || metric.key || metricName
  )

  if (!metricName) {
    return null
  }

  if (!metricKey) {
    throw new Error('Metric key is required')
  }

  return {
    metric_key: metricKey,
    metric_name: metricName,
    metric_type: normalizeMetricType(
      metric.metric_type || metric.type || metricName || ''
    ),
    unit: String(metric.unit || '').trim(),
    icon: String(metric.icon || 'Activity').trim(),
    visible: metric.visible !== false,
    sort_order: Number.isFinite(Number(metric.sort_order))
      ? Number(metric.sort_order)
      : index,
  }
}

async function ensureDeviceOwner(deviceId, userId) {
  if (!userId) {
    const result = await pool.query(
      `SELECT id FROM devices WHERE id = $1 AND is_active = true`,
      [deviceId]
    )
    return result.rowCount > 0
  }

  const result = await pool.query(
    `SELECT id FROM devices WHERE id = $1 AND user_id = $2 AND is_active = true`,
    [deviceId, userId]
  )

  return result.rowCount > 0
}

async function insertDefaultMetrics(client, deviceId) {
  for (const metric of DEFAULT_METRICS) {
    await client.query(
      `
      INSERT INTO device_metrics
        (device_id, metric_key, metric_name, metric_type, unit, icon, visible, sort_order)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (device_id, metric_key) DO NOTHING
      `,
      [
        deviceId,
        metric.metric_key,
        metric.metric_name,
        metric.metric_type,
        metric.unit,
        metric.icon,
        metric.visible,
        metric.sort_order,
      ]
    )
  }
}

async function getMetrics(deviceId) {
  const result = await pool.query(
    `
    SELECT
      id,
      device_id,
      metric_key,
      metric_name,
      metric_type,
      unit,
      icon,
      visible,
      sort_order,
      created_at,
      updated_at
    FROM device_metrics
    WHERE device_id = $1
    ORDER BY sort_order ASC, id ASC
    `,
    [deviceId]
  )

  return result.rows
}

export async function listDeviceMetrics(req, res) {
  const client = await pool.connect()

  try {
    const userId = req.dbUser?.id
    const deviceId = Number(req.params.deviceId)

    if (!Number.isInteger(deviceId)) {
      return res.status(400).json({ message: 'Invalid device id' })
    }

    const allowed = await ensureDeviceOwner(deviceId, userId)

    if (!allowed) {
      return res.status(404).json({ message: 'Device not found' })
    }

    let metrics = await getMetrics(deviceId)

    if (metrics.length === 0) {
      await client.query('BEGIN')
      await insertDefaultMetrics(client, deviceId)
      await client.query('COMMIT')
      metrics = await getMetrics(deviceId)
    }

    res.json(metrics)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('listDeviceMetrics error:', error)
    res.status(500).json({ message: 'Failed to load device metrics' })
  } finally {
    client.release()
  }
}

export async function saveDeviceMetrics(req, res) {
  const client = await pool.connect()

  try {
    const userId = req.dbUser?.id
    const deviceId = Number(req.params.deviceId)
    const metrics = Array.isArray(req.body?.metrics) ? req.body.metrics : []

    if (!Number.isInteger(deviceId)) {
      return res.status(400).json({ message: 'Invalid device id' })
    }

    const allowed = await ensureDeviceOwner(deviceId, userId)

    if (!allowed) {
      return res.status(404).json({ message: 'Device not found' })
    }

    const cleaned = metrics.map(cleanMetric).filter(Boolean)
    const seen = new Set()

    for (const metric of cleaned) {
      if (seen.has(metric.metric_key)) {
        return res.status(400).json({
          message: `Duplicate metric name: ${metric.metric_name}`,
        })
      }

      seen.add(metric.metric_key)
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM device_metrics WHERE device_id = $1', [
      deviceId,
    ])

    for (const metric of cleaned) {
      await client.query(
        `
        INSERT INTO device_metrics
          (device_id, metric_key, metric_name, metric_type, unit, icon, visible, sort_order)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          deviceId,
          metric.metric_key,
          metric.metric_name,
          metric.metric_type,
          metric.unit,
          metric.icon,
          metric.visible,
          metric.sort_order,
        ]
      )
    }

    await client.query('COMMIT')

    const result = await getMetrics(deviceId)
    res.json(result)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('saveDeviceMetrics error:', error)
    res
      .status(500)
      .json({ message: error.message || 'Failed to save device metrics' })
  } finally {
    client.release()
  }
}

export async function resetDeviceMetrics(req, res) {
  const client = await pool.connect()

  try {
    const userId = req.dbUser?.id
    const deviceId = Number(req.params.deviceId)

    if (!Number.isInteger(deviceId)) {
      return res.status(400).json({ message: 'Invalid device id' })
    }

    const allowed = await ensureDeviceOwner(deviceId, userId)

    if (!allowed) {
      return res.status(404).json({ message: 'Device not found' })
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM device_metrics WHERE device_id = $1', [
      deviceId,
    ])
    await insertDefaultMetrics(client, deviceId)
    await client.query('COMMIT')

    const result = await getMetrics(deviceId)
    res.json(result)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('resetDeviceMetrics error:', error)
    res.status(500).json({ message: 'Failed to reset device metrics' })
  } finally {
    client.release()
  }
}

export async function deleteDeviceMetric(req, res) {
  try {
    const userId = req.dbUser?.id
    const deviceId = Number(req.params.deviceId)
    const metricId = Number(req.params.metricId)

    if (!Number.isInteger(deviceId) || !Number.isInteger(metricId)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const allowed = await ensureDeviceOwner(deviceId, userId)

    if (!allowed) {
      return res.status(404).json({ message: 'Device not found' })
    }

    await pool.query(
      `DELETE FROM device_metrics WHERE id = $1 AND device_id = $2`,
      [metricId, deviceId]
    )

    res.json({ ok: true })
  } catch (error) {
    console.error('deleteDeviceMetric error:', error)
    res.status(500).json({ message: 'Failed to delete metric' })
  }
}
