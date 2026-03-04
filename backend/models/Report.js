const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  reporterUid: {
    type: String,
    required: true
  },
  reportedUid: {
    type: String,
    default: ''
  },
  postId: {
    type: String,
    default: ''
  },
  commentId: {
    type: String,
    default: ''
  },
  reason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);