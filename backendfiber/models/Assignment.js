const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true
  },
  technicianIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: true
  }],
  assignedBy: {
    type: String,
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate assignments
assignmentSchema.index({ itemId: 1, status: 1 });
assignmentSchema.index({ technicianIds: 1, status: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
