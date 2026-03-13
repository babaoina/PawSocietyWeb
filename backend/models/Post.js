const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  postId: {
    type: String,
    required: true,
    unique: true
  },
  firebaseUid: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  petName: {
    type: String,
    required: true
  },
  petType: String,
  status: {
    type: String,
    enum: ['Lost', 'Found', 'Adoption'],
    required: true
  },
  description: String,
  location: String,
  reward: String,
  contactInfo: String,
  imageUrls: [String],
  likesCount: {
    type: Number,
    default: 0
  },
  reported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', postSchema);