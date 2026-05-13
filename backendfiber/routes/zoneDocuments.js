const express = require('express');
const multer = require('multer');
const ZoneDocument = require('../models/ZoneDocument');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(isPdf ? null : new Error('Only PDF files are allowed'), isPdf);
  },
});

const cleanValue = (value) => String(value ?? '').trim();

router.post('/import-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier PDF envoyé.' });
    }

    const zone = cleanValue(req.body.zone);
    if (!zone) {
      return res.status(400).json({ success: false, message: 'Zone obligatoire.' });
    }

    const document = await ZoneDocument.create({
      zone,
      kind: 'planTirageFusionPdf',
      fileName: req.file.originalname,
      mimeType: req.file.mimetype || 'application/pdf',
      fileSize: req.file.size,
      fileData: req.file.buffer,
    });

    return res.status(201).json({
      success: true,
      message: 'PDF importé avec succès.',
      data: {
        documentId: document._id,
        zone: document.zone,
        kind: document.kind,
        fileName: document.fileName,
        fileSize: document.fileSize,
        importedAt: document.importedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Impossible d’importer le PDF.',
    });
  }
});

router.get('/zone/:zone', async (req, res) => {
  const zone = cleanValue(req.params.zone);
  const documents = await ZoneDocument.find({ zone })
    .select('-fileData')
    .sort({ importedAt: -1 })
    .lean();

  return res.json({
    success: true,
    count: documents.length,
    data: documents,
  });
});

router.get('/zone/:zone/latest-download', async (req, res) => {
  const zone = cleanValue(req.params.zone);
  const document = await ZoneDocument.findOne({ zone, kind: 'planTirageFusionPdf' })
    .sort({ importedAt: -1 });

  if (!document) {
    return res.status(404).json({ success: false, message: 'PDF introuvable pour cette zone.' });
  }

  res.setHeader('Content-Type', document.mimeType || 'application/pdf');
  res.setHeader('Content-Length', document.fileSize || document.fileData.length);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
  return res.send(document.fileData);
});

router.get('/:id/download', async (req, res) => {
  const document = await ZoneDocument.findById(req.params.id);

  if (!document) {
    return res.status(404).json({ success: false, message: 'PDF introuvable.' });
  }

  res.setHeader('Content-Type', document.mimeType || 'application/pdf');
  res.setHeader('Content-Length', document.fileSize || document.fileData.length);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
  return res.send(document.fileData);
});

router.delete('/:id', async (req, res) => {
  const document = await ZoneDocument.findByIdAndDelete(req.params.id);

  if (!document) {
    return res.status(404).json({ success: false, message: 'PDF introuvable.' });
  }

  return res.json({
    success: true,
    message: 'PDF supprimé.',
    data: {
      documentId: document._id,
      zone: document.zone,
      fileName: document.fileName,
    },
  });
});

module.exports = router;
