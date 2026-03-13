const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
} 

// Initialize Firebase Admin (with error handling)
let firebaseInitialized = false;
try {
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized for user management');
    }
  } else {
    console.warn('⚠️ Firebase service account not found. User suspension will not sync with Firebase.');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.warn('⚠️ Continuing without Firebase sync. User suspension will only affect MongoDB.');
}

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
    
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Apply middleware to all routes
router.use(verifyAdmin);

// Verify token endpoint
router.get('/verify', (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ===== DASHBOARD STATS =====
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats...');
    
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const lostPets = await Post.countDocuments({ status: 'Lost' });
    const foundPets = await Post.countDocuments({ status: 'Found' });
    const adoptions = await Post.countDocuments({ status: 'Adoption' });
    
    // Get user growth (last 7 months)
    const userGrowth = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const nextDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const count = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      userGrowth.push(count);
    }
    
    // Get recent activity (last 5 posts)
    const recentPosts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    const recentActivity = recentPosts.map(post => ({
      type: post.status === 'Lost' ? 'lost' : post.status === 'Found' ? 'post' : 'adoption',
      text: `${post.petName} - ${post.status} post by ${post.userName}`,
      time: new Date(post.createdAt).toLocaleDateString(),
      status: 'new'
    }));
    
    res.json({
      totalUsers,
      totalPosts,
      lostPets,
      foundPets,
      adoptions,
      userGrowth,
      postsByStatus: {
        lost: lostPets,
        found: foundPets,
        adoption: adoptions
      },
      recentActivity
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== USERS =====
router.get('/users', async (req, res) => {
  try {
    console.log('👥 Fetching all users...');
    
    const users = await User.find().sort({ createdAt: -1 }).lean();
    
    console.log(`📊 Found ${users.length} total users`);
    
    const formattedUsers = users
      .filter(user => user.email && user.email.includes('@'))
      .map(user => ({
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.fullName || user.username || 'Unknown',
        email: user.email || 'No email',
        role: user.role || 'user',
        status: user.status || 'Active',
        joined: user.createdAt || new Date(),
        posts: 0
      }));
    
    console.log(`✅ Returning ${formattedUsers.length} users`);
    res.json(formattedUsers);
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    
    const currentUser = await User.findById(req.params.id);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updateData = {};
    if (name) updateData.fullName = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    // Sync with Firebase if initialized and status changed
    if (status && status !== currentUser.status && firebaseInitialized && currentUser.firebaseUid) {
      try {
        if (status === 'Suspended') {
          await admin.auth().updateUser(currentUser.firebaseUid, { disabled: true });
          console.log(`🔒 User ${currentUser.email} disabled in Firebase`);
        } else if (status === 'Active') {
          await admin.auth().updateUser(currentUser.firebaseUid, { disabled: false });
          console.log(`🔓 User ${currentUser.email} enabled in Firebase`);
        }
      } catch (firebaseError) {
        console.error('❌ Firebase update error:', firebaseError.message);
      }
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    try {
      if (firebaseInitialized && user.firebaseUid) {
        await admin.auth().deleteUser(user.firebaseUid);
        console.log(`🔥 User ${user.email} deleted from Firebase`);
      }
    } catch (firebaseError) {
      console.error('❌ Firebase delete error:', firebaseError.message);
    }
    
    await Post.deleteMany({ firebaseUid: user.firebaseUid });
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User and all associated data deleted', id: req.params.id });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});




// ===== POSTS =====
// Around line 210-230, find this section:
router.get('/posts', async (req, res) => {
  try {
    console.log('📥 Fetching all posts...');
    
    const posts = await Post.find().sort({ createdAt: -1 }).lean();
    
    console.log(`📊 Found ${posts.length} posts`);
    
    const formattedPosts = posts.map(post => ({
      id: post._id,
      postId: post.postId,
      petName: post.petName || 'Unnamed',
      gender: post.gender || 'Unknown',  // ← ADD THIS LINE
      status: post.status || 'Unknown',
      userName: post.userName || 'Unknown',
      location: post.location || 'No location',
      description: post.description || '',
      contact: post.contactInfo || 'No contact',
      reported: false,
      reportCount: 0,
      time: post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown',
      userAvatar: post.userName?.charAt(0).toUpperCase() || '?',
      imageUrls: post.imageUrls || []
    }));
    
    console.log(`✅ Returning ${formattedPosts.length} posts`);
    res.json(formattedPosts);
  } catch (error) {
    console.error('❌ Get posts error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    console.error('❌ Get post error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    console.log(`🗑️ Post ${post.postId} deleted`);
    res.json({ message: 'Post deleted', id: req.params.id });
  } catch (error) {
    console.error('❌ Delete post error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== REPORTS MANAGEMENT =====
router.get('/reports', async (req, res) => {
  try {
    console.log('📋 Fetching all reports...');
    
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .lean();
    
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        let post = null;
        if (report.postId) {
          post = await Post.findOne({ postId: report.postId }).lean();
        }
        
        const reporter = await User.findOne({ firebaseUid: report.reporterUid })
          .select('username email firebaseUid')
          .lean();
        
        let reportedUser = null;
        if (report.reportedUid) {
          reportedUser = await User.findOne({ firebaseUid: report.reportedUid })
            .select('username email')
            .lean();
        }
        
        return {
          ...report,
          post: post,
          reporter: reporter,
          reportedUser: reportedUser
        };
      })
    );
    
    console.log(`✅ Found ${reportsWithDetails.length} reports`);
    res.json(reportsWithDetails);
  } catch (error) {
    console.error('❌ Get reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/reports/:reportId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const report = await Report.findOneAndUpdate(
      { reportId: req.params.reportId },
      { status: status },
      { new: true }
    ).lean();
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    console.log(`✅ Report ${report.reportId} marked as ${status}`);
    
    // ===== SEND NOTIFICATION TO REPORTER =====
    try {
      // Get reporter details
      const reporter = await User.findOne({ firebaseUid: report.reporterUid })
        .select('username email firebaseUid')
        .lean();
      
      if (reporter) {
        // Get post details if it's a post report
        let postDetails = '';
        if (report.postId) {
          const post = await Post.findOne({ postId: report.postId }).lean();
          postDetails = post ? ` about "${post.petName}"` : '';
        }
        
        // Prepare notification message
        let message = '';
        if (status === 'reviewed') {
          message = `✅ Your report${postDetails} has been reviewed. Thank you for helping keep PawSociety safe!`;
        } else if (status === 'dismissed') {
          message = `ℹ️ Your report${postDetails} has been reviewed and dismissed. Thank you for your feedback.`;
        }
        
        // Create notification in the MAIN APP DATABASE (not admin DB)
        // You need to connect to the main app's MongoDB or use its API
        const mongoose = require('mongoose');
        const mainDB = mongoose.connection; // This should be your main app DB
        
        const Notification = require('../../backend/models/Notification'); // Path to your app's Notification model
        
        const notification = new Notification({
          notificationId: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          userId: reporter.firebaseUid,
          fromUserId: 'system',
          fromUserName: 'PawSociety Admin',
          fromUserImage: '',
          type: 'report_update',
          postId: report.postId || '',
          message: message,
          isRead: false,
          createdAt: new Date()
        });
        
        await notification.save();
        console.log(`🔔 Notification sent to ${reporter.username}: ${message}`);
        
        // Emit socket event for real-time update (if socket is connected)
        try {
          const io = req.app.get('io');
          if (io) {
            io.to(reporter.firebaseUid).emit('new-notification', {
              notificationId: notification.notificationId,
              message: message,
              type: 'report_update'
            });
          }
        } catch (socketError) {
          console.error('Socket emit error:', socketError.message);
        }
      }
    } catch (notifError) {
      console.error('Failed to send notification:', notifError.message);
    }
    
    res.json({ success: true, report });
    
  } catch (error) {
    console.error('❌ Update report status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reports/:reportId', async (req, res) => {
  try {
    const report = await Report.findOneAndDelete({
      reportId: req.params.reportId
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    console.log(`✅ Report ${report.reportId} deleted`);
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('❌ Delete report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Around line 300-350, find this function and replace it
router.put('/reports/:reportId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const report = await Report.findOneAndUpdate(
      { reportId: req.params.reportId },
      { status: status },
      { new: true }
    ).lean();
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    console.log(`✅ Report ${report.reportId} marked as ${status}`);
    
    // Get reporter details to send notification
    const reporter = await User.findOne({ firebaseUid: report.reporterUid })
      .select('username email fcmToken')
      .lean();
    
    // Get post details if it's a post report
    let post = null;
    if (report.postId) {
      post = await Post.findOne({ postId: report.postId })
        .select('petName')
        .lean();
    }
    
    // Prepare notification data
    const notificationData = {
      reportId: report.reportId,
      status: status,
      reason: report.reason,
      postId: report.postId,
      postName: post?.petName || 'a post',
      commentId: report.commentId,
      timestamp: new Date().toISOString()
    };
    
    // Send notification to reporter if they exist
    if (reporter) {
      // Create notification in database (you'll need a Notification model)
      try {
        const Notification = require('../models/Notification');
        const { v4: uuidv4 } = require('uuid');
        
        const notification = new Notification({
          notificationId: `notif_${Date.now()}_${uuidv4().substring(0, 8)}`,
          userId: reporter.firebaseUid,
          fromUserId: 'system',
          fromUserName: 'PawSociety Admin',
          type: 'report_update',
          message: `Your report${post ? ' about ' + post.petName : ''} has been ${status}`,
          data: notificationData
        });
        
        await notification.save();
        console.log(`🔔 Notification created for reporter: ${reporter.username}`);
        
        // If using Socket.IO, emit real-time update
        const io = req.app.get('io');
        if (io) {
          io.to(reporter.firebaseUid).emit('report-updated', notificationData);
        }
      } catch (notifError) {
        console.error('Failed to create notification:', notifError.message);
      }
    }
    
    res.json({ success: true, report });
    
  } catch (error) {
    console.error('❌ Update report status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reports/:reportId', async (req, res) => {
  try {
    const report = await Report.findOneAndDelete({
      reportId: req.params.reportId
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    console.log(`✅ Report ${report.reportId} deleted`);
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('❌ Delete report error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/posts/reported', async (req, res) => {
  try {
    console.log('📋 Fetching reported posts...');
    
    const reports = await Report.aggregate([
      { $match: { postId: { $ne: '' } } },
      { $group: { 
          _id: "$postId", 
          reportCount: { $sum: 1 },
          reports: { $push: "$$ROOT" }
        }
      },
      { $sort: { reportCount: -1 } }
    ]);
    
    const reportedPosts = await Promise.all(
      reports.map(async (item) => {
        const post = await Post.findOne({ postId: item._id }).lean();
        if (!post) return null;
        
        return {
          ...post,
          reportCount: item.reportCount,
          reports: item.reports
        };
      })
    );
    
    const filteredPosts = reportedPosts.filter(p => p !== null);
    
    console.log(`✅ Found ${filteredPosts.length} reported posts`);
    res.json(filteredPosts);
  } catch (error) {
    console.error('❌ Get reported posts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SETTINGS PROXY TO APP BACKEND =====
router.get('/settings', async (req, res) => {
  try {
    const axios = require('axios');
    
    console.log('📤 Forwarding settings request to app backend...');
    
    // Forward the request to your APP BACKEND (port 5000)
    const response = await axios.get('http://localhost:5000/api/admin/settings', {
      headers: {
        'Authorization': req.headers.authorization // Pass the same token
      }
    });
    
    console.log('✅ Settings received from app backend');
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Failed to get settings from app backend:', error.message);
    res.status(500).json({ error: 'App backend not reachable' });
  }
});

// ===== UPDATE SETTINGS PROXY =====
router.put('/settings/:section', async (req, res) => {
  try {
    const axios = require('axios');
    const { section } = req.params;
    
    console.log(`📤 Forwarding ${section} settings update to app backend...`);
    
    const response = await axios.put(
      `http://localhost:5000/api/admin/settings/${section}`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ ${section} settings updated in app backend`);
    res.json(response.data);
    
  } catch (error) {
    console.error(`❌ Failed to update settings in app backend:`, error.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;