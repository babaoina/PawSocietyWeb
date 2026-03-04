const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsociety';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Get the User model
    const User = require('./models/User');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@pawsociety.com' });
    
    if (existingAdmin) {
      console.log('✅ Admin already exists:', existingAdmin.email);
    } else {
      // Create admin user
      const adminUser = new User({
        firebaseUid: 'admin_' + Date.now(),
        username: 'admin',
        email: 'admin@pawsociety.com',
        fullName: 'Admin User',
        role: 'admin',
        status: 'Active'
      });
      
      await adminUser.save();
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: admin@pawsociety.com');
      console.log('🔑 Password: admin123');
    }
    
    mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  })
  .catch(error => {
    console.error('❌ Error:', error);
  });