const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Photo = require('../models/Photo');
const Building = require('../models/Building');
const { writePhotoMetadataOnImage } = require('../utils/photoMetadataStamp');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/photos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Get photos for a building
router.get('/building/:buildingId', async (req, res) => {
  try {
    const photos = await Photo.find({ 
      buildingId: req.params.buildingId 
    }).sort({ timestamp: -1 });

    res.json({ success: true, count: photos.length, data: photos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload single photo
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { 
      buildingId, 
      type, 
      name,
      id,
      timestamp,
      idImmeuble,
      gpsLatitude,
      gpsLongitude
    } = req.body;

    // Verify building exists
    const building = await Building.findById(buildingId);
    if (!building) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    const savedTimestamp = timestamp ? new Date(timestamp) : new Date();
    const savedIdImmeuble = idImmeuble || building.idImmeuble || '';
    const savedGpsLatitude = gpsLatitude || '';
    const savedGpsLongitude = gpsLongitude || '';

    await writePhotoMetadataOnImage(req.file.path, {
      timestamp: savedTimestamp,
      idImmeuble: savedIdImmeuble,
      gpsLatitude: savedGpsLatitude,
      gpsLongitude: savedGpsLongitude,
    });
    const updatedFileStats = fs.statSync(req.file.path);

    const photo = await Photo.create({
      id: id || Date.now().toString(),
      uri: `${req.protocol}://${req.get('host')}/uploads/photos/${req.file.filename}`,
      name: name || req.file.originalname,
      type: type || 'Photo Autre',
      timestamp: savedTimestamp,
      buildingId,
      idImmeuble: savedIdImmeuble,
      gpsLatitude: savedGpsLatitude,
      gpsLongitude: savedGpsLongitude,
      filePath: req.file.path,
      fileSize: updatedFileStats.size,
      mimeType: 'image/jpeg'
    });

    res.status(201).json({ 
      success: true, 
      message: 'Photo uploaded successfully',
      data: photo 
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload multiple photos
router.post('/upload-multiple', upload.array('photos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const { buildingId } = req.body;

    // Verify building exists
    const building = await Building.findById(buildingId);
    if (!building) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    const photoPromises = req.files.map(async (file, index) => {
      return Photo.create({
        id: `${Date.now()}_${index}`,
        uri: `${req.protocol}://${req.get('host')}/uploads/photos/${file.filename}`,
        name: file.originalname,
        type: req.body[`type_${index}`] || 'Photo Autre',
        timestamp: new Date(),
        buildingId,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype
      });
    });

    const photos = await Promise.all(photoPromises);

    res.status(201).json({
      success: true,
      message: `${photos.length} photos uploaded successfully`,
      data: photos
    });
  } catch (error) {
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete photo
router.delete('/:id', async (req, res) => {
  try {
    const photo = await Photo.findOneAndDelete({
      $or: [
        { _id: req.params.id },
        { id: req.params.id }
      ]
    });

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Delete file from disk
    if (fs.existsSync(photo.filePath)) {
      fs.unlinkSync(photo.filePath);
    }

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get photo by ID
router.get('/:id', async (req, res) => {
  try {
    const photo = await Photo.findOne({
      $or: [
        { _id: req.params.id },
        { id: req.params.id }
      ]
    });

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    res.json({ success: true, data: photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
