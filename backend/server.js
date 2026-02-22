const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../admin-pawsociety')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'running',
        message: 'Backend server is running',
        database: 'connected',
        timestamp: new Date().toISOString()
    });
});

// Catch-all route for frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin-pawsociety', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Admin panel running at http://localhost:${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`📊 Database: pawsociety.db`);
    console.log(`👤 Default admin: admin@pawsociety.com / admin123`);
});