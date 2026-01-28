// src/controllers/masterController.js
import { getDeviceStatus, activeCommands } from './deviceController.js';

/**
 * Check if device is online
 */
export const checkDeviceStatus = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device status
    const status = getDeviceStatus(deviceId);
    
    res.status(200).json({
      success: true,
      deviceId,
      online: status.online,
      lastSeen: status.lastSeen,
      lastSeenAgo: status.lastSeenAgo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Check device status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check device status'
    });
  }
};

/**
 * Send command to device
 */
export const sendCommand = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { deviceId, command } = req.body;
    if (!deviceId || !command) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and command are required'
      });
    }
    // Generate command ID
    const crypto = await import('crypto');
    const commandId = `cmd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Store command
    activeCommands.set(commandId, {
      id: commandId,
      command,
      deviceId,
      issuedBy: user.email,
      timestamp,
      result: null,
      completedAt: null
    });


    res.status(200).json({
      success: true,
      message: 'Command sent to device',
      commandId,
      deviceId,
      timestamp
    });

  } catch (error) {
    console.error('Send command error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send command'
    });
  }
};

/**
 * Get command result
 */
export const getCommandResult = async (req, res) => {
  try {
    const user = req.user;
    const { commandId } = req.params;
    
    if (!user || !user.email) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!commandId) {
      return res.status(400).json({
        success: false,
        message: 'Command ID is required'
      });
    }

    // Get command
    const command = activeCommands.get(commandId);
    
    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    // Check ownership
    if (command.issuedBy !== user.email) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this command'
      });
    }

    const response = {
      success: true,
      command: {
        id: command.id,
        command: command.command,
        deviceId: command.deviceId,
        issuedBy: command.issuedBy,
        timestamp: command.timestamp,
        status: command.result ? 'completed' : 'pending'
      }
    };

    if (command.result) {
      response.command.result = command.result;
      response.command.completedAt = command.completedAt;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Get command result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get command result'
    });
  }
};

export default {
  checkDeviceStatus,
  sendCommand,
  getCommandResult
};