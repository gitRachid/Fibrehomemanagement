const express = require('express');
const multer = require('multer');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const KmzImport = require('../models/KmzImport');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const isKmz = fileName.endsWith('.kmz') || file.mimetype === 'application/vnd.google-earth.kmz';
    console.log('[KMZ_IMPORT][BACKEND] file filter', {
      fileName: file.originalname,
      mimeType: file.mimetype,
      accepted: isKmz,
    });
    cb(isKmz ? null : new Error('Only KMZ files are allowed'), isKmz);
  },
});

const cleanValue = (value) => String(value ?? '').trim();

const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const collectPlacemarks = (node, result = []) => {
  if (!node || typeof node !== 'object') return result;
  if (node.Placemark) result.push(...asArray(node.Placemark));

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      asArray(value).forEach((item) => collectPlacemarks(item, result));
    }
  }

  return result;
};

const parseCoordinates = (coordinates) => {
  return cleanValue(coordinates)
    .split(/\s+/)
    .map((entry) => {
      const [first, second] = entry.split(',').map(Number);
      if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

      // KML normally stores coordinates as longitude,latitude.
      // Some field files are exported as latitude,longitude; detect Morocco-like coordinates.
      const looksLikeMoroccoLatLng =
        first >= 20 && first <= 38 &&
        second >= -18 && second <= 0;
      const longitude = looksLikeMoroccoLatLng ? second : first;
      const latitude = looksLikeMoroccoLatLng ? first : second;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    })
    .filter(Boolean);
};

const getPlacemarkDescription = (placemark) => {
  const description = placemark.description ?? placemark.Description ?? '';
  if (typeof description === 'string') return description;
  return cleanValue(description?.['#text'] ?? '');
};

const placemarkToFeatures = (placemark, index) => {
  const name = cleanValue(placemark.name ?? `Élément ${index + 1}`);
  const description = getPlacemarkDescription(placemark);
  const base = { id: `${index}`, name, description };
  const features = [];
  const geometrySources = [placemark, placemark.MultiGeometry].filter(Boolean);

  geometrySources.forEach((source, sourceIndex) => {
    asArray(source.Point).forEach((point, pointIndex) => {
      const coordinates = parseCoordinates(point.coordinates);
      if (coordinates[0]) {
        features.push({
          ...base,
          id: `${index}-point-${sourceIndex}-${pointIndex}`,
          type: 'point',
          coordinates: [coordinates[0]],
        });
      }
    });
  });

  geometrySources.forEach((source, sourceIndex) => {
    asArray(source.LineString).forEach((line, lineIndex) => {
      const coordinates = parseCoordinates(line.coordinates);
      if (coordinates.length >= 2) {
        features.push({
          ...base,
          id: `${index}-line-${sourceIndex}-${lineIndex}`,
          type: 'line',
          coordinates,
        });
      }
    });
  });

  geometrySources.forEach((source, sourceIndex) => {
    asArray(source.Polygon).forEach((polygon, polygonIndex) => {
      const coordinates = parseCoordinates(
        polygon.outerBoundaryIs?.LinearRing?.coordinates ||
        polygon.LinearRing?.coordinates,
      );
      if (coordinates.length >= 3) {
        features.push({
          ...base,
          id: `${index}-polygon-${sourceIndex}-${polygonIndex}`,
          type: 'polygon',
          coordinates,
        });
      }
    });
  });

  return features;
};

const extractKmzFeatures = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const kmlFileName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.kml'));
  if (!kmlFileName) return [];

  const kmlContent = await zip.files[kmlFileName].async('string');
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    parseTagValue: false,
  });
  const parsed = parser.parse(kmlContent);
  const placemarks = collectPlacemarks(parsed);
  const features = placemarks.flatMap((placemark, index) => placemarkToFeatures(placemark, index));
  const firstCoordinate = features.find((feature) => feature.coordinates?.[0])?.coordinates?.[0];
  console.log('[KMZ_FEATURES][BACKEND] parsed features', {
    kmlFileName,
    placemarks: placemarks.length,
    features: features.length,
    firstCoordinate,
  });
  return features;
};

router.post('/import', upload.single('kmz'), async (req, res) => {
  try {
    console.log('[KMZ_IMPORT][BACKEND] request received', {
      zone: req.body?.zone,
      hasFile: Boolean(req.file),
      fileName: req.file?.originalname,
      mimeType: req.file?.mimetype,
      fileSize: req.file?.size,
    });

    if (!req.file) {
      console.warn('[KMZ_IMPORT][BACKEND] rejected: no file uploaded');
      return res.status(400).json({ success: false, message: 'No KMZ file uploaded' });
    }

    const zone = cleanValue(req.body.zone);
    if (!zone) {
      console.warn('[KMZ_IMPORT][BACKEND] rejected: missing zone');
      return res.status(400).json({ success: false, message: 'Zone is required' });
    }

    const document = await KmzImport.create({
      zone,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: req.file.buffer,
    });
    console.log('[KMZ_IMPORT][BACKEND] document created', {
      importId: document._id,
      zone: document.zone,
      fileName: document.fileName,
      fileSize: document.fileSize,
    });

    return res.status(201).json({
      success: true,
      message: 'KMZ importé avec succès',
      data: {
        importId: document._id,
        zone: document.zone,
        fileName: document.fileName,
        fileSize: document.fileSize,
        importedAt: document.importedAt,
      },
    });
  } catch (error) {
    console.error('[KMZ_IMPORT][BACKEND] failed', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/zone/:zone', async (req, res) => {
  try {
    console.log('[KMZ_IMPORT][BACKEND] list by zone', { zone: req.params.zone });
    const files = await KmzImport.find({ zone: req.params.zone })
      .select('-fileData')
      .sort({ importedAt: -1 });

    res.json({ success: true, count: files.length, data: files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/zone/:zone/features', async (req, res) => {
  try {
    const file = await KmzImport.findOne({ zone: req.params.zone }).sort({ importedAt: -1 });
    if (!file) {
      return res.json({ success: true, count: 0, data: [], file: null });
    }

    const features = await extractKmzFeatures(file.fileData);
    return res.json({
      success: true,
      count: features.length,
      data: features,
      file: {
        id: file._id,
        zone: file.zone,
        fileName: file.fileName,
        importedAt: file.importedAt,
      },
    });
  } catch (error) {
    console.error('[KMZ_FEATURES][BACKEND] failed', {
      zone: req.params.zone,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
