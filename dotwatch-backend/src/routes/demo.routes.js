import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authUser } from '../middlewares/authUser.js'
import { loadUser } from '../middlewares/loadUser.js'
import {
  createDemoTemplate,
  listDemoTemplates,
  deleteDemoData,
} from '../controllers/demo.controller.js'

export const demoRouter = Router()

demoRouter.use(authUser)
demoRouter.use(loadUser)

demoRouter.get('/templates', asyncHandler(listDemoTemplates))
demoRouter.post('/templates/:templateKey', asyncHandler(createDemoTemplate))
demoRouter.delete('/data', asyncHandler(deleteDemoData))