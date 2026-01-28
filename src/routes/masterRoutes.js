// src/routes/masterRoutes.js
import express from 'express';
import masterController from '../controllers/masterController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Check device status
router.get('/device/:deviceId/status',authenticate ,masterController.checkDeviceStatus);

// Send command
router.post('/command/send',authenticate ,masterController.sendCommand);

// Get command result
router.get('/command/:commandId',authenticate ,masterController.getCommandResult);

export default router;