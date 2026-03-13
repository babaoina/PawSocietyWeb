const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  fromUserId: {
    type: String,
    required: true
  },
  fromUserName: {
    type: String,
    required: true
  },
  fromUserImage: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    required: true,
    enum: ['like', 'comment', 'follow', 'report_update']
  },
  postId: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);