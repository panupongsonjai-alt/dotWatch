import { Router } from 'express'
import { listDeviceModels } from '../controllers/deviceModelsController.js'

const router = Router()

router.get('/device-models', listDeviceModels)

export default router
