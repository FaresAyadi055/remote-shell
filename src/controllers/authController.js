// src/controllers/authController.js
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  hashApiKey, 
  generateApiKey, 
  createApiKeyRecord, 
  deleteApiKeyRecord,
  getUserApiKeys as getStoredUserApiKeys,
  findApiKeyById,
  readApiKeys,
  writeApiKeys
} from '../middlewares/auth.js';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory storage for verification codes (use a database like Redis in production)
const verificationCodes = new Map();

/**
 * Generate a random 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * DEBUG: Log all stored verification codes
 */
const debugVerificationCodes = () => {
  console.log('=== DEBUG: Stored Verification Codes ===');
  verificationCodes.forEach((value, key) => {
    console.log(`Email: ${key}`);
    console.log(`Code: ${value.code}`);
    console.log(`Expires at: ${new Date(value.expiresAt).toLocaleString()}`);
    console.log(`Verified: ${value.verified}`);
    console.log(`Is expired: ${Date.now() > value.expiresAt}`);
    console.log('---');
  });
  console.log('Total codes:', verificationCodes.size);
};

/**
 * Send verification email using Resend
 */
const sendVerificationEmail = async (email, verificationCode) => {
  try {
    console.log(`Sending verification email to ${email} with code: ${verificationCode}`);
    
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Account</h2>
          <p>Please use the following verification code to complete your authentication:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }

    console.log('Verification email sent successfully');
    return data;
  } catch (error) {
    console.error('Error in sendVerificationEmail:', error);
    throw error;
  }
};

/**
 * Send API key email
 */
const sendApiKeyEmail = async (email, apiKey, deviceName) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Your API Key',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your API Key</h2>
          <p>Here is your new API key for ${deviceName}. Please store it securely as it will only be shown once:</p>
          <div style="background-color: #f4f4f4; padding: 20px; margin: 20px 0; border-left: 4px solid #007bff; word-break: break-all;">
            <code style="font-family: 'Courier New', monospace; font-size: 14px; color: #333;">${apiKey}</code>
          </div>
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="color: #856404; margin: 0;">
              <strong>⚠️ Important Security Notice:</strong><br/>
              1. Store this key securely<br/>
              2. Never share it publicly<br/>
              3. This key will not be shown again<br/>
              4. If compromised, revoke and generate a new one immediately
            </p>
          </div>
          <p>Created at: ${new Date().toLocaleString()}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending API key email:', error);
      throw new Error('Failed to send API key email');
    }

    return data;
  } catch (error) {
    console.error('Error in sendApiKeyEmail:', error);
    throw error;
  }
};

/**
 * Login controller with email verification
 */
export const login = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Store verification code with expiration (10 minutes)
    verificationCodes.set(normalizedEmail, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      verified: false,
      createdAt: Date.now()
    });

    console.log(`Generated code for ${normalizedEmail}: ${verificationCode}`);
    debugVerificationCodes();

    // Send verification email
    await sendVerificationEmail(normalizedEmail, verificationCode);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
      email: normalizedEmail,
      expiresIn: 600 // 10 minutes in seconds
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Verify the verification code
 */
export const verify = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log(`Verification attempt for: ${normalizedEmail}`);
    console.log(`Provided code: ${code}`);
    debugVerificationCodes();

    // Check if verification code exists
    const storedData = verificationCodes.get(normalizedEmail);
    
    if (!storedData) {
      console.log(`No verification data found for: ${normalizedEmail}`);
      return res.status(400).json({
        success: false,
        message: 'No verification request found for this email. Please request a new code.'
      });
    }

    // Check if code has expired
    if (Date.now() > storedData.expiresAt) {
      console.log(`Code expired for: ${normalizedEmail}. Expired at: ${new Date(storedData.expiresAt).toLocaleString()}`);
      verificationCodes.delete(normalizedEmail); // Clean up expired code
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    console.log(`Stored code for ${normalizedEmail}: ${storedData.code}`);
    console.log(`Code type - Provided: ${typeof code}, Stored: ${typeof storedData.code}`);

    // Check if code matches - ensure both are strings for comparison
    const providedCode = code.toString().trim();
    const storedCode = storedData.code.toString().trim();
    
    if (providedCode !== storedCode) {
      console.log(`Code mismatch for ${normalizedEmail}. Provided: "${providedCode}", Expected: "${storedCode}"`);
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check and try again.'
      });
    }

    console.log(`Code verified successfully for: ${normalizedEmail}`);

    // Clean up verification code after successful verification
    verificationCodes.delete(normalizedEmail);

    // Generate JWT token
    const token = jwt.sign(
      { 
        email: normalizedEmail,
        verified: true,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '24h' }
    );

    // Return success with token
    res.status(200).json({
      success: true,
      message: 'Verification successful!',
      token: token,
      user: {
        email: normalizedEmail,
        verified: true
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    debugVerificationCodes();
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.'
    });
  }
};

/**
 * Generate API key for authenticated user WITH device info
 */
export const generateApiKeyForUser = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get device info from request
    const { deviceName,  deviceId } = req.body;
    
    if (!deviceName) {
      return res.status(400).json({
        success: false,
        message: 'Device name is required'
      });
    }

    // Generate unique device ID if not provided
    const finalDeviceId = deviceId || `device_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    
    const data = readApiKeys();
    
    const apiKeyRecord = {
      id: crypto.randomUUID(),
      userEmail: userEmail,
      deviceId: finalDeviceId,           // Added device ID
      deviceName: deviceName,           // Added device name          
      hashedKey: hashedKey,
      prefix: apiKey.substring(0, 10) + '...',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      isActive: true,
      name: `${deviceName} API Key`,    // Use device name for key name
      permissions: req.body.permissions || ['execute_commands'],
      metadata: {
        createdBy: userEmail,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    };
    
    data.apiKeys.push(apiKeyRecord);
    
    if (!writeApiKeys(data)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save API key'
      });
    }

    await sendApiKeyEmail(userEmail, apiKey, deviceName);

    res.status(201).json({
      success: true,
      message: `API key generated for ${deviceName}`,
      apiKeyInfo: {
        id: apiKeyRecord.id,
        deviceId: finalDeviceId,
        deviceName: deviceName,
        name: apiKeyRecord.name,
        prefix: apiKeyRecord.prefix,
        createdAt: apiKeyRecord.createdAt,
        permissions: apiKeyRecord.permissions
      },
      securityNotice: 'API key has been sent to your email. Store it securely as it will not be shown again.'
    });

  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's API keys
 */
export const getUserApiKeys = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userKeys = getStoredUserApiKeys(userEmail);

    res.status(200).json({
      success: true,
      apiKeys: userKeys,
      count: userKeys.length
    });

  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Revoke/Delete an API key
 */
export const revokeApiKey = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const { apiKeyId } = req.params;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!deleteApiKeyRecord(apiKeyId, userEmail)) {
      return res.status(404).json({
        success: false,
        message: 'API key not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Resend verification code
 */
export const resendCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if there's an existing verification attempt
    const existingCode = verificationCodes.get(normalizedEmail);
    
    // Prevent spamming - enforce cooldown period (1 minute)
    if (existingCode && existingCode.lastSent && Date.now() < existingCode.lastSent + 60000) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting a new code'
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    
    // Update stored code
    verificationCodes.set(normalizedEmail, {
      code: verificationCode,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      lastSent: Date.now(),
      verified: false,
      createdAt: Date.now()
    });

    console.log(`Resending code for ${normalizedEmail}: ${verificationCode}`);
    debugVerificationCodes();

    // Send new verification email
    await sendVerificationEmail(normalizedEmail, verificationCode);

    res.status(200).json({
      success: true,
      message: 'New verification code sent',
      email: normalizedEmail,
      expiresIn: 600
    });

  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * DEBUG endpoint to view verification codes (remove in production)
 */
export const debugCodes = async (req, res) => {
  try {
    const codesArray = Array.from(verificationCodes.entries()).map(([email, data]) => ({
      email,
      code: data.code,
      expiresAt: new Date(data.expiresAt).toLocaleString(),
      isExpired: Date.now() > data.expiresAt,
      createdAt: new Date(data.createdAt).toLocaleString()
    }));

    res.status(200).json({
      success: true,
      codes: codesArray,
      total: verificationCodes.size
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error'
    });
  }
};

// Export all controllers
export default {
  login,
  verify,
  resendCode,
  generateApiKeyForUser,
  getUserApiKeys,
  revokeApiKey,
  debugCodes // Remove this in production
};