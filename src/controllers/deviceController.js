// src/controllers/deviceController.js

// Simple in-memory storage
const activeCommands = new Map(); // commandId -> {command data}
const deviceActivity = new Map(); // deviceId -> lastActivity timestamp

/**
 * Check for pending commands - also updates device activity
 */
export const checkForCommands = async (req, res) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey || !apiKey.deviceId) {
      return res.status(401).json({
        success: false,
        message: 'Device authentication required'
      });
    }

    const deviceId = apiKey.deviceId;
    const now = new Date().toISOString();
    
    // Update device activity (this is the "heartbeat")
    deviceActivity.set(deviceId, now);
    
  
    
    // Find pending commands for this device
    const pendingCommands = [];
    
    for (const [commandId, command] of activeCommands.entries()) {
      if (command.deviceId === deviceId && !command.result) {
        pendingCommands.push({
          id: commandId,
          command: command.command,
          issuedBy: command.issuedBy,
          timestamp: command.timestamp
        });
        
        // Mark as fetched
        command.fetchedAt = now;
      }
    }
    
    
    res.status(200).json({
      success: true,
      commands: pendingCommands,
      deviceId,
      deviceName: apiKey.deviceName,
      timestamp: now
    });
    
  } catch (error) {
    console.error('Check for commands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for commands'
    });
  }
};

/**
 * Submit command result - also updates device activity
 * Updated to match masterController response structure
 */
export const submitCommandResult = async (req, res) => {
  try {
    const apiKey = req.apiKey;
    if (!apiKey || !apiKey.deviceId) {
      return res.status(401).json({
        success: false,
        message: 'Device authentication required'
      });
    }

    const deviceId = apiKey.deviceId;
    const { commandId, result } = req.body;
    
    if (!commandId) {
      return res.status(400).json({
        success: false,
        message: 'commandId is required'
      });
    }
    
    // Update device activity
    const now = new Date().toISOString();
    deviceActivity.set(deviceId, now);
    
    // Find and update command
    const command = activeCommands.get(commandId);
    
    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }
    
    // Verify this device owns this command
    if (command.deviceId !== deviceId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit result for this command'
      });
    }
    
    // Update with result
    command.result = result || "command executed";
    command.completedAt = now;
    command.success = true;
    
    
    // Return response matching masterController structure
    const response = {
      success: true,
      command: {
        id: command.id,
        command: command.command,
        deviceId: command.deviceId,
        issuedBy: command.issuedBy,
        timestamp: command.timestamp,
        status: 'completed',
        result: command.result,
        completedAt: command.completedAt,
        success: command.success
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Submit command result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit command result'
    });
  }
};

/**
 * Get device status (internal helper)
 */
export const getDeviceStatus = (deviceId) => {
  const lastActivity = deviceActivity.get(deviceId);
  if (!lastActivity) return { online: false, lastSeen: null };
  
  const lastActivityTime = new Date(lastActivity).getTime();
  const isOnline = (Date.now() - lastActivityTime) < 120000; // 2 minutes
  
  return {
    online: isOnline,
    lastSeen: lastActivity,
    lastSeenAgo: Math.floor((Date.now() - lastActivityTime) / 1000) + ' seconds ago'
  };
};

/**
 * Debug endpoint
 */
export const debugState = async (req, res) => {
  const devices = Array.from(deviceActivity.entries()).map(([deviceId, lastActivity]) => {
    const status = getDeviceStatus(deviceId);
    return {
      deviceId,
      lastActivity,
      online: status.online,
      lastSeenAgo: status.lastSeenAgo
    };
  });
  
  const commands = Array.from(activeCommands.entries()).map(([id, cmd]) => ({
    id,
    deviceId: cmd.deviceId,
    command: cmd.command.substring(0, 50),
    result: cmd.result ? '✓ Completed' : '⏳ Pending',
    issuedBy: cmd.issuedBy,
    fetched: !!cmd.fetchedAt
  }));
  
  res.status(200).json({
    success: true,
    devices,
    commands,
    stats: {
      totalDevices: deviceActivity.size,
      onlineDevices: devices.filter(d => d.online).length,
      pendingCommands: commands.filter(c => !c.result.includes('✓')).length
    }
  });
};

// Export storage for masterController to use
export { activeCommands, deviceActivity };

export default {
  checkForCommands,
  submitCommandResult,
  getDeviceStatus,
  debugState
};