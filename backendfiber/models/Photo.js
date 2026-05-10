const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  uri: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true
  },
  idImmeuble: {
    type: String,
    default: ''
  },
  gpsLatitude: {
    type: String,
    default: ''
  },
  gpsLongitude: {
    type: String,
    default: ''
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
photoSchema.index({ buildingId: 1, type: 1 });
photoSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Photo', photoSchema);
