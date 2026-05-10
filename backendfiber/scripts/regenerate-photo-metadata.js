require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const Photo = require('../models/Photo');
const { writePhotoMetadataOnImage } = require('../utils/photoMetadataStamp');

const createBackupIfNeeded = async (filePath) => {
  const backupPath = `${filePath}.before-restamp`;
  if (fs.existsSync(backupPath)) return backupPath;
  await fs.promises.copyFile(filePath, backupPath);
  return backupPath;
};

const regeneratePhoto = async (photo) => {
  if (!photo.filePath || !fs.existsSync(photo.filePath)) {
    return { status: 'missing-file', id: photo._id, filePath: photo.filePath };
  }

  await createBackupIfNeeded(photo.filePath);
  await writePhotoMetadataOnImage(photo.filePath, {
    timestamp: photo.timestamp,
    idImmeuble: photo.idImmeuble,
    gpsLatitude: photo.gpsLatitude,
    gpsLongitude: photo.gpsLongitude,
  });

  const stats = await fs.promises.stat(photo.filePath);
  photo.fileSize = stats.size;
  photo.mimeType = 'image/jpeg';
  await photo.save();

  return { status: 'updated', id: photo._id, filePath: photo.filePath };
};

const run = async () => {
  await connectDatabase();

  const photos = await Photo.find({}).sort({ timestamp: -1 });
  let updated = 0;
  let missing = 0;
  let failed = 0;

  console.log(`[PHOTO_RESTAMP] photos found: ${photos.length}`);
  console.log('[PHOTO_RESTAMP] Existing stamped text cannot be removed without original image files.');

  for (const photo of photos) {
    try {
      const result = await regeneratePhoto(photo);
      if (result.status === 'updated') updated += 1;
      if (result.status === 'missing-file') missing += 1;
      console.log(`[PHOTO_RESTAMP] ${result.status}: ${photo.id || photo._id} ${result.filePath || ''}`);
    } catch (error) {
      failed += 1;
      console.error(`[PHOTO_RESTAMP] failed: ${photo.id || photo._id}`, error.message);
    }
  }

  console.log(`[PHOTO_RESTAMP] done. updated=${updated}, missing=${missing}, failed=${failed}`);
  await mongoose.disconnect();

  if (failed > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error('[PHOTO_RESTAMP] fatal', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
