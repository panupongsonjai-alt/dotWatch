import { Router } from 'express'
import {
  deleteDeviceMetric,
  listDeviceMetrics,
  resetDeviceMetrics,
  saveDeviceMetrics,
} from '../controllers/deviceMetricsController.js'

const router = Router()

router.get('/devices/:deviceId/metrics', listDeviceMetrics)
router.put('/devices/:deviceId/metrics', saveDeviceMetrics)
router.post('/devices/:deviceId/metrics/reset', resetDeviceMetrics)
router.delete('/devices/:deviceId/metrics/:metricId', deleteDeviceMetric)

export default router
