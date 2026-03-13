const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Find user by email in your APP database
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is admin
    const isAdmin = user.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access only' });
    }
    
    // Simple password check (for demo)
    if (password !== 'admin123') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        role: 'admin' 
      },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '8h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.fullName,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/check-status
 * Check if user is still active/suspended (used by Android app)
 */
router.post('/check-status', async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    
    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: 'firebaseUid is required'
      });
    }
    
    const user = await User.findOne({ firebaseUid });
    
    if (!user) {
      return res.json({ 
        success: false, 
        message: 'User not found',
        status: 'deleted'
      });
    }
    
    // Return user status
    res.json({
      success: true,
      status: user.status || 'Active',
      message: user.status === 'Suspended' ? 'Account suspended' : 'Account active'
    });
    
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;