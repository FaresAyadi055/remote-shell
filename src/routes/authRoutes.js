// src/routes/authRoutes.js
import express from 'express';
import authController from '../controllers/authController.js';
import { authenticate, authenticateApiKey } from '../middlewares/auth.js'; // IMPORTANT: Add authenticateApiKey

const router = express.Router();

// Public routes
router.post('/login', authController.login);
router.post('/verify', authController.verify);
router.post('/resend-code', authController.resendCode);

// Protected routes (require JWT authentication)
router.post('/api-keys', authenticate, authController.generateApiKeyForUser);
router.get('/api-keys', authenticate, authController.getUserApiKeys);
router.delete('/api-keys/:apiKeyId', authenticate, authController.revokeApiKey);

// Route protected by API key (alternative authentication method)
// CHANGED: Use authenticateApiKey from middleware instead of validateApiKey from controller
router.get('/protected-by-api-key', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    message: 'Access granted via API key',
    user: req.apiKey?.userEmail || req.user?.email,
    permissions: req.apiKey?.permissions || []
  });
});

// Protected routes (require JWT authentication)
router.get('/verify-status', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'User is authenticated',
    user: req.user
  });
});

export default router;