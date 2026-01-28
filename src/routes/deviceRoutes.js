// src/routes/deviceRoutes.js
import express from 'express';
import deviceController from '../controllers/deviceController.js';
import { authenticateApiKey } from '../middlewares/auth.js';

const router = express.Router();

// Device routes (API key auth)
router.get('/commands', authenticateApiKey, deviceController.checkForCommands);
router.post('/command-result', authenticateApiKey, deviceController.submitCommandResult);
// Debug (no auth needed for debugging)
router.get('/debug', deviceController.debugState);

export default router;