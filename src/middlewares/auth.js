// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORRECTED: Use absolute path from the project root
const DATA_FILE = path.join(__dirname, '../fs/data.json');



/**
 * Ensure data directory and file exist
 */
const ensureDataFile = () => {
  try {
    const dataDir = path.dirname(DATA_FILE);
    
    if (!fs.existsSync(dataDir)) {
      console.log('Creating data directory:', dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(DATA_FILE)) {
      console.log('Creating data file:', DATA_FILE);
      fs.writeFileSync(DATA_FILE, JSON.stringify({ apiKeys: [] }, null, 2));
      console.log('Data file created successfully');
    } else {
      // Check if file is readable
      try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
      } catch (readError) {
        console.error('Cannot read data file:', readError);
      }
    }
  } catch (error) {
    console.error('Error ensuring data file:', error);
  }
};

/**
 * Read API keys from file
 */
const readApiKeys = () => {
  try {
    ensureDataFile();
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    
    // Handle empty file
    if (!data || data.trim() === '') {
      console.log('File is empty, returning default structure');
      return { apiKeys: [] };
    }
    
    const parsedData = JSON.parse(data);
    return parsedData;
  } catch (error) {
    console.error('Error reading API keys:', error.message);
    console.error('Error stack:', error.stack);
    return { apiKeys: [] };
  }
};

/**
 * Write API keys to file
 */
const writeApiKeys = (data) => {
  try {
    ensureDataFile();
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing API keys:', error.message);
    console.error('Error stack:', error.stack);
    return false;
  }
};

/**
 * Hash API key for secure comparison
 */
export const hashApiKey = (apiKey) => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * Generate a secure API key
 */
export const generateApiKey = () => {
  const prefix = 'sk_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString(36);
  return `${prefix}${timestamp}_${randomPart}`;
};

/**
 * Find API key by ID and user email
 */
export const findApiKeyById = (apiKeyId, userEmail) => {
  const data = readApiKeys();
  return data.apiKeys.find(
    key => key.id === apiKeyId && key.userEmail === userEmail
  );
};

/**
 * Find API key by hashed key
 */
export const findApiKeyByHash = (hashedKey) => {
  const data = readApiKeys();
  return data.apiKeys.find(key => key.hashedKey === hashedKey);
};

/**
 * Create new API key record
 */
export const createApiKeyRecord = (apiKeyRecord) => {
  const data = readApiKeys();
  data.apiKeys.push(apiKeyRecord);
  return writeApiKeys(data);
};

/**
 * Delete API key record
 */
export const deleteApiKeyRecord = (apiKeyId, userEmail) => {
  const data = readApiKeys();
  const keyIndex = data.apiKeys.findIndex(
    key => key.id === apiKeyId && key.userEmail === userEmail
  );
  
  if (keyIndex === -1) return false;
  
  data.apiKeys.splice(keyIndex, 1);
  return writeApiKeys(data);
};

/**
 * Update API key last used timestamp
 */
export const updateApiKeyLastUsed = (hashedKey) => {
  const data = readApiKeys();
  const keyRecord = data.apiKeys.find(key => key.hashedKey === hashedKey);
  
  if (keyRecord) {
    keyRecord.lastUsed = new Date().toISOString();
    return writeApiKeys(data);
  }
  
  return false;
};

/**
 * Get user's API keys
 */
export const getUserApiKeys = (userEmail) => {
  const data = readApiKeys();
  return data.apiKeys
    .filter(key => key.userEmail === userEmail)
    .map(key => ({
      id: key.id,
      name: key.name,
      deviceName: key.deviceName,
      deviceID: key.deviceId,
      prefix: key.prefix,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive,
      permissions: key.permissions
    }));
};

// Export storage functions for use by controller
export { readApiKeys, writeApiKeys, ensureDataFile };

/**
 * JWT Authentication Middleware
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No Bearer token found in headers');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    if (!token) {
      console.log('Token is empty after Bearer prefix');
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    
    // Check if token has expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      console.log('Token expired at:', new Date(decoded.exp * 1000));
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Check if user is verified
    if (!decoded.verified) {
      console.log('User not verified:', decoded.email);
      return res.status(403).json({
        success: false,
        message: 'Account not verified. Please complete verification.',
        code: 'ACCOUNT_NOT_VERIFIED'
      });
    }


    
    // Attach user data to request object
    req.user = {
      id: decoded.userId || decoded.email,
      email: decoded.email,
      verified: decoded.verified,
      role: decoded.role || 'user',
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Generic error
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * API Key Authentication Middleware
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    
    // Get API key from header or query parameter
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
      console.log('No API key found in request');
      return res.status(401).json({
        success: false,
        message: 'API key is required.',
        code: 'NO_API_KEY'
      });
    }


    // Validate API key format
    if (!apiKey.startsWith('sk_')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key format.',
        code: 'INVALID_API_KEY_FORMAT'
      });
    }

    // Hash the provided API key for comparison
    const hashedKey = hashApiKey(apiKey);
    
    // Read API keys from storage
    const data = readApiKeys();
    
    // Find the key
    const keyRecord = data.apiKeys.find(
      key => key.hashedKey === hashedKey
    );
    
    if (!keyRecord) {
      console.log('API key not found in storage');
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
        code: 'INVALID_API_KEY'
      });
    }

    
    // Check if key is active
    if (!keyRecord.isActive) {
      console.log('API key is inactive');
      return res.status(401).json({
        success: false,
        message: 'API key is inactive.',
        code: 'API_KEY_INACTIVE'
      });
    }

    // Check if key has expired
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'API key has expired.',
        code: 'API_KEY_EXPIRED'
      });
    }

    // Update last used timestamp
    updateApiKeyLastUsed(hashedKey);

    // Attach API key info to request object
    req.apiKey = {
      id: keyRecord.id,
      deviceId: keyRecord.deviceId,
      deviceName: keyRecord.deviceName,
      userEmail: keyRecord.userEmail,
      permissions: keyRecord.permissions || [],
      name: keyRecord.name,
      createdAt: keyRecord.createdAt
    };

    // Attach user info to request for consistency with JWT auth
    req.user = {
      email: keyRecord.userEmail,
      verified: true,
      role: 'api_user',
      authMethod: 'api_key'
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'API key authentication failed.',
      code: 'API_KEY_AUTH_FAILED'
    });
  }
};