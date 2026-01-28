// src/services/inventoryService.js
import pool from '../db/pool.js';

class InventoryService {
  // Get all inventory items
  async getAllInventory() {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM inventory 
        ORDER BY id DESC
      `);
      return { success: true, data: rows };
    } catch (error) {
      console.error('Error getting inventory:', error);
      return { success: false, error: 'Database error' };
    }
  }

  // Get inventory item by ID
  async getInventoryById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM inventory WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return { success: false, error: 'Item not found', status: 404 };
      }
      
      return { success: true, data: rows[0] };
    } catch (error) {
      console.error('Error getting inventory item:', error);
      return { success: false, error: 'Database error' };
    }
  }

  // Create new inventory item
  async createInventoryItem(itemData) {
    try {
      const { id, model, description, quantity, location } = itemData;
      
      // Validate required fields
      if (!model || !description || quantity === undefined || !location) {
        return { 
          success: false, 
          error: 'Missing required fields: model, description, quantity, location',
          status: 400 
        };
      }
      
      const [result] = await pool.query(
        'INSERT INTO inventory (model, description, quantity, location) VALUES (?, ?, ?, ?)',
        [model, description, quantity, location]
      );
      
      const newItem = {
        id: result.insertId,
        model,
        description,
        quantity,
        location
      };
      
      return { success: true, data: newItem, status: 201 };
    } catch (error) {
      console.error('Error creating inventory item:', error);
      
      // Handle duplicate or other SQL errors
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'Item already exists', status: 409 };
      }
      
      return { success: false, error: 'Failed to create item' };
    }
  }

  // Update inventory item
  async updateInventoryItem(id, updateData) {
    try {
      const { model, description, quantity, location } = updateData;
      
      // Check if item exists
      const [existing] = await pool.query(
        'SELECT id FROM inventory WHERE id = ?',
        [id]
      );
      
      if (existing.length === 0) {
        return { success: false, error: 'Item not found', status: 404 };
      }
      
      // Build dynamic update query
      const updates = [];
      const values = [];
      
      if (model !== undefined) {
        updates.push('model = ?');
        values.push(model);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (quantity !== undefined) {
        updates.push('quantity = ?');
        values.push(quantity);
      }
      if (location !== undefined) {
        updates.push('location = ?');
        values.push(location);
      }
      
      if (updates.length === 0) {
        return { success: false, error: 'No fields to update', status: 400 };
      }
      
      values.push(id);
      
      const query = `UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`;
      
      await pool.query(query, values);
      
      // Get updated item
      const [updatedRows] = await pool.query(
        'SELECT * FROM inventory WHERE id = ?',
        [id]
      );
      
      return { success: true, data: updatedRows[0] };
    } catch (error) {
      console.error('Error updating inventory item:', error);
      return { success: false, error: 'Failed to update item' };
    }
  }

  // Delete inventory item
  async deleteInventoryItem(id) {
    try {
      // Check if item exists
      const [existing] = await pool.query(
        'SELECT id FROM inventory WHERE id = ?',
        [id]
      );
      
      if (existing.length === 0) {
        return { success: false, error: 'Item not found', status: 404 };
      }
      
      // Check if item has related logs or requests
      const [logs] = await pool.query(
        'SELECT id FROM logs WHERE model_id = ? LIMIT 1',
        [id]
      );
      
      const [requests] = await pool.query(
        'SELECT id FROM requests WHERE model_id = ? LIMIT 1',
        [id]
      );
      
      if (logs.length > 0 || requests.length > 0) {
        return { 
          success: false, 
          error: 'Cannot delete item with existing logs or requests', 
          status: 400 
        };
      }
      
      await pool.query('DELETE FROM inventory WHERE id = ?', [id]);
      
      return { success: true, message: 'Item deleted successfully' };
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return { success: false, error: 'Failed to delete item' };
    }
  }

  // Search inventory
  async searchInventory(searchTerm) {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM inventory 
         WHERE model LIKE ? OR description LIKE ? OR location LIKE ?
         ORDER BY id DESC`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
      );
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('Error searching inventory:', error);
      return { success: false, error: 'Search failed' };
    }
  }

  // Get inventory statistics
  async getInventoryStats() {
    try {
      const [totalItems] = await pool.query('SELECT COUNT(*) as count FROM inventory');
      const [totalQuantity] = await pool.query('SELECT SUM(quantity) as total FROM inventory');
      const [lowStock] = await pool.query(
        'SELECT COUNT(*) as count FROM inventory WHERE quantity < 10'
      );
      const [locations] = await pool.query(
        'SELECT location, COUNT(*) as count FROM inventory GROUP BY location'
      );
      
      return {
        success: true,
        data: {
          totalItems: totalItems[0].count,
          totalQuantity: totalQuantity[0].total || 0,
          lowStockItems: lowStock[0].count,
          locations: locations
        }
      };
    } catch (error) {
      console.error('Error getting inventory stats:', error);
      return { success: false, error: 'Failed to get statistics' };
    }
  }
}

export default new InventoryService();