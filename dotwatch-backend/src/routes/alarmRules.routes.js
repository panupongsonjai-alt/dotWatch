import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authUser } from '../middlewares/authUser.js'
import { loadUser } from '../middlewares/loadUser.js'
import { pool } from '../db/pool.js'

const router = Router()

router.use(authUser)
router.use(loadUser)

/**
 * GET /api/alarm-rules
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
      SELECT
        ar.*,
        d.name AS device_name
      FROM alarm_rules ar
      LEFT JOIN devices d
        ON d.id = ar.device_id
      WHERE d.user_id = $1
      ORDER BY ar.id DESC
      `,
      [req.dbUser.id]
    )

    res.json(result.rows)
  })
)

/**
 * POST /api/alarm-rules
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      device_id,
      metric,
      operator,
      threshold,
      severity = 'warning',
    } = req.body

    const result = await pool.query(
      `
      INSERT INTO alarm_rules (
        device_id,
        metric,
        operator,
        threshold,
        severity
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [device_id, metric, operator, threshold, severity]
    )

    res.status(201).json(result.rows[0])
  })
)

/**
 * PUT /api/alarm-rules/:id
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { metric, operator, threshold, severity, enabled } = req.body

    const result = await pool.query(
      `
      UPDATE alarm_rules
      SET
        metric = $1,
        operator = $2,
        threshold = $3,
        severity = $4,
        enabled = $5
      WHERE id = $6
      RETURNING *
      `,
      [metric, operator, threshold, severity, enabled, req.params.id]
    )

    if (!result.rows.length) {
      return res.status(404).json({
        message: 'Alarm rule not found',
      })
    }

    res.json(result.rows[0])
  })
)

/**
 * DELETE /api/alarm-rules/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query(
      `
      DELETE FROM alarm_rules
      WHERE id = $1
      `,
      [req.params.id]
    )

    res.json({ success: true })
  })
)

export default router
