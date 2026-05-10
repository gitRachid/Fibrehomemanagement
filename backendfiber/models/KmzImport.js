const mongoose = require('mongoose');

const kmzImportSchema = new mongoose.Schema({
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
  importedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

kmzImportSchema.index({ zone: 1, importedAt: -1 });

module.exports = mongoose.model('KmzImport', kmzImportSchema);
