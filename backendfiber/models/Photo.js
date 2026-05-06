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
    enum: ['Photo Adduction', 'Photo Immeuble', 'Photo Façade', 'Photo Entrée', 'Photo Technique', 'Photo Autre'],
    required: true
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
