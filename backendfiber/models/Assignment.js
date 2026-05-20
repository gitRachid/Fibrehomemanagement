const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
    index: true
  },
  /** Business technician ids (e.g. TECH-001) — DB technicians may use string _id, not ObjectId. */
  technicianIds: [{
    type: String,
    required: true,
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
