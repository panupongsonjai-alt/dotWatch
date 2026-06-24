import { listActivityLogs } from '../services/activity.service.js'

export async function listActivity(req, res) {
  const user = req.dbUser
  const { deviceId, limit } = req.query

  const rows = await listActivityLogs({
    userId: user.id,
    deviceId: deviceId || null,
    limit,
  })

  res.json(rows)
}
