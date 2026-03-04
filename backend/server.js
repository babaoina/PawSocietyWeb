const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../admin-pawsociety')));

// MongoDB Connection - Connect to YOUR APP DATABASE
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsociety';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ WEB BACKEND: Connected to MongoDB (your app database)');
  })
  .catch((error) => {
    console.error('❌ WEB BACKEND: MongoDB connection error:', error);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Admin backend is running',
    database: 'connected to MongoDB',
    timestamp: new Date().toISOString()
  });
});

// Catch-all route for frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-pawsociety', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WEB BACKEND running at http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});