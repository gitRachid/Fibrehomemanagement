const mongoose = require('mongoose');

const routeOptiqueRowSchema = new mongoose.Schema({
  zone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  importId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RouteOptiqueImport',
    required: true,
    index: true,
  },
  sheetName: {
    type: String,
    required: true,
    index: true,
  },
  rowNumber: {
    type: Number,
    required: true,
  },
  tiroirOdf: {
    type: String,
    required: true,
    trim: true,
  },
  pm: {
    type: String,
    default: '',
    trim: true,
  },
  destinationPbo: {
    type: String,
    default: '',
    trim: true,
  },
  longPboSro: {
    type: String,
    default: '',
    trim: true,
  },
  fields: [{
    header: {
      type: String,
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
    },
    colorIndex: {
      type: Number,
    },
    colorHex: {
      type: String,
    },
    colorLabel: {
      type: String,
    },
  }],
}, {
  timestamps: true,
});

routeOptiqueRowSchema.index({ zone: 1, tiroirOdf: 1 }, { unique: true });
routeOptiqueRowSchema.index({ zone: 1, sheetName: 1 });

module.exports = mongoose.model('RouteOptiqueRow', routeOptiqueRowSchema);
