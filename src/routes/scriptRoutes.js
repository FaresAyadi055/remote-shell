// src/routes/scriptRoutes.js
import express from 'express';
import authController from '../controllers/scriptController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.get('/getscript', authenticate, authController.verify);
export default router;