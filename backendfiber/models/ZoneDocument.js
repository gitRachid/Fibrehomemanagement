const mongoose = require('mongoose');

const zoneDocumentSchema = new mongoose.Schema({
  zone: {
    type: String,
    required: true,
    index: true,
  },
  kind: {
    type: String,
    required: true,
    enum: ['planTirageFusionPdf'],
  },
  fileName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    default: 'application/pdf',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  fileData: {
    type: Buffer,
    required: true,
  },
  importedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

zoneDocumentSchema.index({ zone: 1, kind: 1, importedAt: -1 });

module.exports = mongoose.model('ZoneDocument', zoneDocumentSchema);
