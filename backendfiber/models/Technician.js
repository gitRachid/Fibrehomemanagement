const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const technicianSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['technician', 'supervisor', 'manager'],
    default: 'technician'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },
  assignedBuildings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
technicianSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Index for faster queries (email index is already created by unique: true)
technicianSchema.index({ status: 1, role: 1 });

module.exports = mongoose.model('Technician', technicianSchema);
