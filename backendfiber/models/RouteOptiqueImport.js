const mongoose = require('mongoose');

const routeOptiqueImportSchema = new mongoose.Schema({
  zone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  fileData: {
    type: Buffer,
    required: true,
  },
  sheets: [{
    type: String,
  }],
  rowCount: {
    type: Number,
    default: 0,
  },
  fiberColorMap: {
    type: Map,
    of: new mongoose.Schema({
      hex: String,
      label: String,
    }, { _id: false }),
    default: {},
  },
  importedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

routeOptiqueImportSchema.index({ zone: 1, importedAt: -1 });

module.exports = mongoose.model('RouteOptiqueImport', routeOptiqueImportSchema);
