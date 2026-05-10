const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const RouteOptiqueImport = require('../models/RouteOptiqueImport');
const RouteOptiqueRow = require('../models/RouteOptiqueRow');

const router = express.Router();

const FIBER_COLOR_MAP = {
  1: { hex: '#FF0000', label: 'Rouge' },
  2: { hex: '#0000FF', label: 'Bleu' },
  3: { hex: '#00FF00', label: 'Vert' },
  4: { hex: '#FFFF00', label: 'Jaune' },
  5: { hex: '#7030A0', label: 'Violet' },
  6: { hex: '#FFFFFF', label: 'Blanc' },
  7: { hex: '#FF9900', label: 'Orange' },
  8: { hex: '#808080', label: 'Gris' },
  9: { hex: '#800000', label: 'Marron' },
  10: { hex: '#000000', label: 'Noir' },
  11: { hex: '#00FFFF', label: 'Cyan' },
  12: { hex: '#FF66CC', label: 'Rose' },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isExcel =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls');

    cb(isExcel ? null : new Error('Only Excel files are allowed'), isExcel);
  },
});

const cleanHeader = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const cleanValue = (value) => String(value ?? '').trim();

const getBaseHeader = (header) => cleanHeader(header).replace(/_\d+$/, '');

const buildField = (header, value) => {
  const field = { header, value };
  const baseHeader = getBaseHeader(header);

  if (baseHeader === 'F' || baseHeader === 'T') {
    const colorIndex = Number(cleanValue(value));
    const color = FIBER_COLOR_MAP[colorIndex];
    if (color) {
      field.colorIndex = colorIndex;
      field.colorHex = color.hex;
      field.colorLabel = color.label;
    }
  }

  return field;
};

const normalizeHeaderKey = (header, index, counts) => {
  const label = cleanHeader(header) || `COL_${index + 1}`;
  const count = counts.get(label) ?? 0;
  counts.set(label, count + 1);
  return count === 0 ? label : `${label}_${count + 1}`;
};

const readSheetRows = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];

  const headerCounts = new Map();
  const headers = rows[0].map((header, index) => normalizeHeaderKey(header, index, headerCounts));

  return rows.slice(1)
    .map((row, index) => {
      const fieldsByHeader = {};
      const fields = [];
      headers.forEach((header, columnIndex) => {
        const value = row[columnIndex] ?? '';
        fieldsByHeader[header] = value;
        fields.push(buildField(header, value));
      });

      return {
        rowNumber: index + 2,
        fields,
        tiroirOdf: cleanValue(fieldsByHeader['Tiroir(ODF)']),
        pm: cleanValue(fieldsByHeader.PM),
        destinationPbo: cleanValue(fieldsByHeader['Destination(PBO)']),
        longPboSro: cleanValue(fieldsByHeader['Long.(PBO-SRO)']),
      };
    })
    .filter((row) => row.fields.some((field) => cleanValue(field.value)));
};

router.post('/import', upload.single('routeOptique'), async (req, res) => {
  try {
    console.log('[ROUTE_OPTIQUE_IMPORT] request received', {
      zone: req.body?.zone,
      hasFile: Boolean(req.file),
      fileName: req.file?.originalname,
      mimeType: req.file?.mimetype,
      fileSize: req.file?.size,
    });

    if (!req.file) {
      console.warn('[ROUTE_OPTIQUE_IMPORT] rejected: no file uploaded');
      return res.status(400).json({ success: false, message: 'No Excel file uploaded' });
    }

    const zone = cleanValue(req.body.zone);
    if (!zone) {
      console.warn('[ROUTE_OPTIQUE_IMPORT] rejected: missing zone');
      return res.status(400).json({ success: false, message: 'Zone is required' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sroSheetNames = workbook.SheetNames.filter((name) => name.toUpperCase().startsWith('SRO'));
    console.log('[ROUTE_OPTIQUE_IMPORT] workbook parsed', {
      allSheets: workbook.SheetNames,
      sroSheets: sroSheetNames,
    });

    if (sroSheetNames.length === 0) {
      console.warn('[ROUTE_OPTIQUE_IMPORT] rejected: no SRO sheets found');
      return res.status(400).json({
        success: false,
        message: 'Aucune feuille SRO trouvée dans le fichier.',
      });
    }

    const parsedRows = sroSheetNames.flatMap((sheetName) =>
      readSheetRows(workbook, sheetName).map((row) => ({ ...row, sheetName })),
    );
    const validRows = parsedRows.filter((row) => row.tiroirOdf);
    console.log('[ROUTE_OPTIQUE_IMPORT] rows parsed', {
      parsedRows: parsedRows.length,
      validRows: validRows.length,
      invalidRows: parsedRows.length - validRows.length,
      sampleTiroirOdf: validRows.slice(0, 5).map((row) => row.tiroirOdf),
    });

    if (validRows.length === 0) {
      console.warn('[ROUTE_OPTIQUE_IMPORT] rejected: no valid Tiroir(ODF)', {
        firstRows: parsedRows.slice(0, 3),
      });
      return res.status(400).json({
        success: false,
        message: 'Aucune ligne valide avec Tiroir(ODF) trouvée dans les feuilles SRO.',
      });
    }

    const importDocument = await RouteOptiqueImport.create({
      zone,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: req.file.buffer,
      sheets: sroSheetNames,
      rowCount: validRows.length,
      fiberColorMap: FIBER_COLOR_MAP,
    });
    console.log('[ROUTE_OPTIQUE_IMPORT] import document created', {
      importId: importDocument._id,
      zone,
      rowCount: importDocument.rowCount,
    });

    const operations = validRows.map((row) => ({
      updateOne: {
        filter: { zone, tiroirOdf: row.tiroirOdf },
        update: {
          $set: {
            zone,
            importId: importDocument._id,
            sheetName: row.sheetName,
            rowNumber: row.rowNumber,
            tiroirOdf: row.tiroirOdf,
            pm: row.pm,
            destinationPbo: row.destinationPbo,
            longPboSro: row.longPboSro,
            fields: row.fields,
          },
        },
        upsert: true,
      },
    }));

    const result = await RouteOptiqueRow.bulkWrite(operations, { ordered: false });
    const stored = await RouteOptiqueRow.countDocuments({ importId: importDocument._id });
    const zoneTotal = await RouteOptiqueRow.countDocuments({ zone });
    console.log('[ROUTE_OPTIQUE_IMPORT] bulk write completed', {
      importId: importDocument._id,
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      stored,
      zoneTotal,
    });

    return res.status(201).json({
      success: true,
      message: 'Route optique importée avec succès',
      data: {
        importId: importDocument._id,
        zone,
        fileName: importDocument.fileName,
        sheets: sroSheetNames,
        rows: validRows.length,
        inserted: result.upsertedCount || 0,
        updated: result.modifiedCount || 0,
        stored,
        zoneTotal,
        fiberColorMap: FIBER_COLOR_MAP,
      },
    });
  } catch (error) {
    console.error('[ROUTE_OPTIQUE_IMPORT] failed', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/zone/:zone', async (req, res) => {
  try {
    const rows = await RouteOptiqueRow.find({ zone: req.params.zone }).sort({ sheetName: 1, rowNumber: 1 });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
