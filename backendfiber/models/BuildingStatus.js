const mongoose = require('mongoose');

const buildingStatusSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#64748b'
  },
  managerOnly: {
    type: Boolean,
    default: false,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 100
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BuildingStatus', buildingStatusSchema);
