import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool.js'

const templates = {
  'cold-storage': {
    name: 'Cold Storage Monitoring',
    groupName: 'Cold Storage Demo',
    devices: [
      {
        code: 'DW-COLD-001',
        name: 'Cold Room A',
        status: 'online',
        baseTemp: 4,
        baseHumidity: 68,
        rssi: -51,
      },
      {
        code: 'DW-COLD-002',
        name: 'Freezer Room',
        status: 'warning',
        baseTemp: -16,
        baseHumidity: 55,
        rssi: -57,
      },
      {
        code: 'DW-COLD-003',
        name: 'Loading Area',
        status: 'online',
        baseTemp: 10,
        baseHumidity: 72,
        rssi: -63,
      },
    ],
    alarm: {
      metric: 'temperature',
      operator: '>',
      threshold: 8,
      value: 10.5,
      severity: 'warning',
    },
  },

  'server-room': {
    name: 'Server Room Monitoring',
    groupName: 'Server Room Demo',
    devices: [
      {
        code: 'DW-SERVER-001',
        name: 'Rack A',
        status: 'online',
        baseTemp: 25,
        baseHumidity: 48,
        rssi: -49,
      },
      {
        code: 'DW-SERVER-002',
        name: 'Rack B',
        status: 'warning',
        baseTemp: 33,
        baseHumidity: 52,
        rssi: -56,
      },
      {
        code: 'DW-SERVER-003',
        name: 'UPS Room',
        status: 'online',
        baseTemp: 29,
        baseHumidity: 46,
        rssi: -61,
      },
    ],
    alarm: {
      metric: 'temperature',
      operator: '>',
      threshold: 30,
      value: 33.2,
      severity: 'critical',
    },
  },

  factory: {
    name: 'Factory Monitoring',
    groupName: 'Factory Demo',
    devices: [
      {
        code: 'DW-FACTORY-001',
        name: 'Production Line 1',
        status: 'online',
        baseTemp: 31,
        baseHumidity: 62,
        rssi: -58,
      },
      {
        code: 'DW-FACTORY-002',
        name: 'Production Line 2',
        status: 'online',
        baseTemp: 30,
        baseHumidity: 60,
        rssi: -60,
      },
      {
        code: 'DW-FACTORY-003',
        name: 'Boiler Area',
        status: 'warning',
        baseTemp: 38,
        baseHumidity: 54,
        rssi: -67,
      },
    ],
    alarm: {
      metric: 'temperature',
      operator: '>',
      threshold: 35,
      value: 38.4,
      severity: 'warning',
    },
  },

  'smart-farm': {
    name: 'Smart Farm Monitoring',
    groupName: 'Smart Farm Demo',
    devices: [
      {
        code: 'DW-FARM-001',
        name: 'Greenhouse A',
        status: 'online',
        baseTemp: 28,
        baseHumidity: 76,
        rssi: -54,
      },
      {
        code: 'DW-FARM-002',
        name: 'Greenhouse B',
        status: 'online',
        baseTemp: 29,
        baseHumidity: 79,
        rssi: -59,
      },
      {
        code: 'DW-FARM-003',
        name: 'Water Tank Area',
        status: 'offline',
        baseTemp: 27,
        baseHumidity: 82,
        rssi: -72,
      },
    ],
    alarm: {
      metric: 'humidity',
      operator: '>',
      threshold: 80,
      value: 82,
      severity: 'warning',
    },
  },
}

function randomValue(base, range) {
  return Number((base + (Math.random() - 0.5) * range).toFixed(1))
}

function buildReadings(deviceId, baseTemp, baseHumidity, rssi) {
  const readings = []
  const now = new Date()

  // 24 ชั่วโมงย้อนหลัง ทุก 5 นาที = 288 จุด
  for (let i = 0; i < 288; i += 1) {
    const time = new Date(now.getTime() - (287 - i) * 5 * 60 * 1000)

    readings.push({
      time,
      deviceId,
      temperature: randomValue(baseTemp, 4),
      humidity: randomValue(baseHumidity, 10),
      rssi,
    })
  }

  return readings
}

export async function listDemoTemplates(req, res) {
  res.json(
    Object.entries(templates).map(([key, template]) => ({
      key,
      name: template.name,
      groupName: template.groupName,
      devices: template.devices.map((device) => ({
        name: device.name,
        status: device.status,
      })),
    }))
  )
}

export async function createDemoTemplate(req, res) {
  const user = req.dbUser
  const { templateKey } = req.params
  const template = templates[templateKey]

  if (!template) {
    return res.status(404).json({
      message: 'Demo template not found',
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const createdDevices = []

    for (const demoDevice of template.devices) {
      const deviceSecret = crypto.randomBytes(18).toString('hex')
      const secretHash = await bcrypt.hash(deviceSecret, 10)

      const deviceCode = `${demoDevice.code}-U${user.id}`

      const isOffline = demoDevice.status === 'offline'
      const nowValue = isOffline ? `NOW() - INTERVAL '15 minutes'` : 'NOW()'

      const deviceResult = await client.query(
        `
        INSERT INTO devices (
          user_id,
          device_code,
          name,
          group_name,
          status,
          secret_hash,
          last_seen_at,
          last_ingest_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          ${nowValue},
          ${nowValue}
        )
        ON CONFLICT (device_code)
        DO UPDATE SET
          name = EXCLUDED.name,
          group_name = EXCLUDED.group_name,
          status = EXCLUDED.status,
          secret_hash = EXCLUDED.secret_hash,
          last_seen_at = EXCLUDED.last_seen_at,
          last_ingest_at = EXCLUDED.last_ingest_at
        RETURNING id, device_code, name, group_name, status, last_seen_at
        `,
        [
          user.id,
          deviceCode,
          demoDevice.name,
          template.groupName,
          demoDevice.status,
          secretHash,
        ]
      )

      const device = deviceResult.rows[0]

      await client.query(
        `
        DELETE FROM sensor_readings
        WHERE device_id = $1
        `,
        [device.id]
      )

      const readings = buildReadings(
        device.id,
        demoDevice.baseTemp,
        demoDevice.baseHumidity,
        demoDevice.rssi
      )

      for (const reading of readings) {
        await client.query(
          `
          INSERT INTO sensor_readings (
            time,
            device_id,
            temperature,
            humidity,
            rssi
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            reading.time,
            reading.deviceId,
            reading.temperature,
            reading.humidity,
            reading.rssi,
          ]
        )
      }

      createdDevices.push({
        ...device,
        deviceSecret,
      })
    }

    const alarmDevice = createdDevices.find(
      (device) => device.status === 'warning'
    ) || createdDevices[0]

    await client.query(
      `
      DELETE FROM alarm_events
      WHERE user_id = $1
        AND device_id = $2
        AND metric = $3
      `,
      [user.id, alarmDevice.id, template.alarm.metric]
    )

    await client.query(
      `
      INSERT INTO alarm_events (
        user_id,
        device_id,
        metric,
        operator,
        threshold,
        value,
        severity,
        status,
        triggered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
      `,
      [
        user.id,
        alarmDevice.id,
        template.alarm.metric,
        template.alarm.operator,
        template.alarm.threshold,
        template.alarm.value,
        template.alarm.severity,
      ]
    )

    await client.query('COMMIT')

    res.status(201).json({
      ok: true,
      template: template.name,
      devices: createdDevices,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function deleteDemoData(req, res) {
  const user = req.dbUser

  const result = await pool.query(
    `
    DELETE FROM devices
    WHERE user_id = $1
      AND (
        device_code LIKE 'DW-COLD-%'
        OR device_code LIKE 'DW-SERVER-%'
        OR device_code LIKE 'DW-FACTORY-%'
        OR device_code LIKE 'DW-FARM-%'
      )
    RETURNING id
    `,
    [user.id]
  )

  res.json({
    ok: true,
    deletedDevices: result.rowCount,
  })
}