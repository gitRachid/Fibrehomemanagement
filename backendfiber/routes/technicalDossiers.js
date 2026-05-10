const express = require('express');
const XlsxPopulate = require('xlsx-populate');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const Building = require('../models/Building');
const Photo = require('../models/Photo');

const router = express.Router();

// Structure principale pour intégrer les photos dans le template Excel.
// Pour chaque type photo, renseigner:
// - placeholders: les balises à mettre dans Excel
// - depart: cellule de départ du cadre photo
// - arrive: cellule d'arrivée du cadre photo
// - sheet: optionnel, uniquement si on veut insérer par plage sans placeholder.
// Si depart/arrive sont vides, l'image sera insérée à la cellule du placeholder.
const PHOTO_TEMPLATE_CONFIG = [
  {
    type: 'Photo Façade',
    placeholders: ['{{photo_facade}}', '{{photo_façade}}'],
    depart: 'D37',
    arrive: 'Z67',
  },
  {
    type: 'Photo Immeuble',
    placeholders: ['{{photo_immeuble}}'],
    depart: 'D16',
    arrive: 'N28',
  },
  {
    type: 'Photo Entrée',
    placeholders: ['{{photo_entree}}', '{{photo_entrée}}'],
    depart: 'O16',
    arrive: 'Y28',
  },
  {
    type: 'Photo Adduction',
    placeholders: ['{{photo_adduction}}'],
    depart: 'D17',
    arrive: 'Y38',
  },
  {
    type: 'Plan des infrastructures',
    placeholders: ['{{plan_des_infrastructures}}'],
    depart: 'D15',
    arrive: 'W48',
  },
  {
    type: 'PLAN DE SITUATION',
    placeholders: ['{{plan_de_situation}}'],
    depart: 'D15',
    arrive: 'W35',
  },
  {
    type: 'PLAN DE CHEMINEMENT',
    placeholders: ['{{plan_de_cheminement}}'],
    depart: 'D38',
    arrive: 'W65',
  },
  {
    type: 'EMPLACEMENT BPO1',
    placeholders: ['{{emplacement_bpo1}}'],
    depart: 'D42',
    arrive: 'N63',
  },
  {
    type: 'EMPLACEMENT BPO2',
    placeholders: ['{{emplacement_bpo2}}'],
    depart: 'O42',
    arrive: 'Y63',
  },
  {
    type: 'SITUATION-CHAMBRE BPE',
    placeholders: ['{{situation_chambre_bpe}}'],
    depart: 'D16',
    arrive: 'N28',
  },
  {
    type: 'BPE OUVERTE',
    placeholders: ['{{bpe_ouverte}}'],
    depart: 'O16',
    arrive: 'Y28',
  },
  {
    type: 'Fixation BPE',
    placeholders: ['{{fixation_bpe}}'],
    depart: 'D30',
    arrive: 'N42',
  },
  {
    type: 'Ettiqutage CHA',
    placeholders: ['{{ettiqutage_cha}}'],
    depart: 'O30',
    arrive: 'Y42',
  },
  {
    type: 'Ettiqtage PBO1 CHA',
    placeholders: ['{{ettiqtage_pbo1_cha}}'],
    depart: 'D44',
    arrive: 'N56',
  },
  {
    type: 'Ettiqtage PBO2 CHA',
    placeholders: ['{{ettiqtage_pbo2_cha}}'],
    depart: 'O44',
    arrive: 'Y56',
  },
  {
    type: 'POSE PBO1',
    placeholders: ['{{pose_pbo1}}'],
    depart: 'D30',
    arrive: 'N42',
  },
  {
    type: 'POSE PBO2',
    placeholders: ['{{pose_pbo2}}'],
    depart: 'O30',
    arrive: 'Y42',
  },
  {
    type: 'POSE PBO3',
    placeholders: ['{{pose_pbo3}}'],
    depart: 'D44',
    arrive: 'N56',
  },
  {
    type: 'POSE PBO4',
    placeholders: ['{{pose_pbo4}}'],
    depart: 'O44',
    arrive: 'Y56',
  },
  {
    type: 'Photo Autre',
    placeholders: ['{{photo_autre}}'],
    depart: '',
    arrive: '',
  },
  // Compatibilité anciens templates.
  {
    type: 'Photo Technique',
    placeholders: ['{{photo_technique}}'],
    depart: '',
    arrive: '',
  },
];

const PHOTO_PLACEHOLDERS = PHOTO_TEMPLATE_CONFIG.reduce((acc, config) => {
  for (const placeholder of config.placeholders) {
    acc[placeholder] = config.type;
  }
  return acc;
}, {});

const buildPhotoRanges = (config) => {
  if (!config.depart || !config.arrive) return [];
  const departs = Array.isArray(config.depart) ? config.depart : [config.depart];
  const arrives = Array.isArray(config.arrive) ? config.arrive : [config.arrive];
  return departs
    .map((depart, index) => {
      const arrive = arrives[index];
      if (!depart || !arrive) return null;
      return `${depart}:${arrive}`;
    })
    .filter(Boolean);
};

const PHOTO_RANGE_BY_PLACEHOLDER = PHOTO_TEMPLATE_CONFIG.reduce((acc, config) => {
  const ranges = buildPhotoRanges(config);
  if (ranges.length === 0) return acc;
  for (const placeholder of config.placeholders) {
    acc[placeholder] = ranges;
  }
  return acc;
}, {});

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: false,
};

const xmlParser = new XMLParser(XML_OPTIONS);

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const relsPathForPart = (partPath) => {
  const lastSlash = partPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? partPath.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? partPath.slice(lastSlash + 1) : partPath;
  return `${dir}/_rels/${fileName}.rels`;
};

const resolveRelationshipTarget = (sourcePartPath, target) => {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  const sourceDir = sourcePartPath.slice(0, sourcePartPath.lastIndexOf('/'));
  return path.posix.normalize(`${sourceDir}/${target}`);
};

const readXmlFromZip = async (zip, filePath) => {
  const file = zip.file(filePath);
  if (!file) return null;
  return xmlParser.parse(await file.async('string'));
};

const ensureContentTypeDefault = async (sourceZip, targetZip, extension) => {
  const sourceContentTypesFile = sourceZip.file('[Content_Types].xml');
  const targetContentTypesFile = targetZip.file('[Content_Types].xml');
  if (!sourceContentTypesFile || !targetContentTypesFile) return;

  const sourceContentTypes = await sourceContentTypesFile.async('string');
  const targetContentTypes = await targetContentTypesFile.async('string');
  const defaultRegex = new RegExp(`<Default[^>]+Extension="${extension}"[^>]*/>`);
  if (defaultRegex.test(targetContentTypes)) return;

  const sourceDefault = sourceContentTypes.match(defaultRegex)?.[0];
  if (!sourceDefault) return;
  targetZip.file('[Content_Types].xml', targetContentTypes.replace('</Types>', `${sourceDefault}</Types>`));
};

const getWorkbookSheetPaths = async (zip) => {
  const workbook = await readXmlFromZip(zip, 'xl/workbook.xml');
  const workbookRels = await readXmlFromZip(zip, 'xl/_rels/workbook.xml.rels');
  const relationships = toArray(workbookRels?.Relationships?.Relationship);
  const targetById = new Map(relationships.map((relationship) => [
    relationship['@_Id'],
    resolveRelationshipTarget('xl/workbook.xml', relationship['@_Target']),
  ]));

  return toArray(workbook?.workbook?.sheets?.sheet).reduce((acc, sheet) => {
    const relationshipId = sheet['@_r:id'];
    const sheetPath = targetById.get(relationshipId);
    if (sheet['@_name'] && sheetPath) acc[sheet['@_name']] = sheetPath;
    return acc;
  }, {});
};

const getRelativeTarget = (fromPartPath, toPartPath) => {
  const fromDir = fromPartPath.slice(0, fromPartPath.lastIndexOf('/'));
  return path.posix.relative(fromDir, toPartPath);
};

const insertBeforeWorksheetEnd = (worksheetXml, fragment) => {
  if (worksheetXml.includes('<extLst')) {
    return worksheetXml.replace('<extLst', `${fragment}<extLst`);
  }
  return worksheetXml.replace('</worksheet>', `${fragment}</worksheet>`);
};

const appendRelationshipXml = (relsXml, relationship) => {
  const relationshipXml = `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${relationship.target}"/>`;
  if (relsXml) return relsXml.replace('</Relationships>', `${relationshipXml}</Relationships>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipXml}</Relationships>`;
};

const getNextPartNumber = (zip, regex, fallback = 1) => {
  const numbers = Object.keys(zip.files)
    .map((name) => name.match(regex)?.[1])
    .filter(Boolean)
    .map(Number);
  return numbers.length ? Math.max(...numbers) + 1 : fallback;
};

const getSheetPathByName = async (zip, sheetName) => {
  const sheets = await getWorkbookSheetPaths(zip);
  return sheets[sheetName];
};

const getSheetDrawing = async (zip, sheetPath) => {
  const sheetRelsPath = relsPathForPart(sheetPath);
  const sheetRels = await readXmlFromZip(zip, sheetRelsPath);
  const drawingRel = toArray(sheetRels?.Relationships?.Relationship)
    .find((relationship) => String(relationship['@_Type'] || '').includes('/drawing'));
  if (!drawingRel) return null;
  return {
    relId: drawingRel['@_Id'],
    drawingPath: resolveRelationshipTarget(sheetPath, drawingRel['@_Target']),
  };
};

const ensureSheetDrawing = async (zip, sheetPath) => {
  const existing = await getSheetDrawing(zip, sheetPath);
  if (existing) return existing;

  const drawingNumber = getNextPartNumber(zip, /^xl\/drawings\/drawing(\d+)\.xml$/);
  const drawingPath = `xl/drawings/drawing${drawingNumber}.xml`;
  zip.file(drawingPath, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></xdr:wsDr>');

  const sheetRelsPath = relsPathForPart(sheetPath);
  const currentRelsXml = zip.file(sheetRelsPath) ? await zip.file(sheetRelsPath).async('string') : '';
  const currentRels = await readXmlFromZip(zip, sheetRelsPath);
  const relIds = toArray(currentRels?.Relationships?.Relationship)
    .map((relationship) => Number(String(relationship['@_Id'] || '').replace(/^rId/, '')) || 0);
  const relId = `rId${relIds.length ? Math.max(...relIds) + 1 : 1}`;
  zip.file(sheetRelsPath, appendRelationshipXml(currentRelsXml, {
    id: relId,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
    target: getRelativeTarget(sheetPath, drawingPath),
  }));

  const sheetXml = await zip.file(sheetPath).async('string');
  zip.file(sheetPath, insertBeforeWorksheetEnd(sheetXml, `<drawing r:id="${relId}"/>`));
  return { relId, drawingPath };
};

const buildPictureAnchorXml = ({ range, relId, pictureId, name }) => {
  const parsedRange = parseRangeRef(range);
  if (!parsedRange) return '';
  const escapedName = String(name || `Photo ${pictureId}`).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<xdr:twoCellAnchor editAs="twoCell"><xdr:from><xdr:col>${parsedRange.start.column - 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${parsedRange.start.row - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${parsedRange.end.column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${parsedRange.end.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${pictureId}" name="${escapedName}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
};

const appendImageToDrawing = async (zip, drawingPath, photo, range) => {
  const extension = getImageExtension(photo);
  if (!extension || !photo.filePath || !fs.existsSync(photo.filePath)) return false;

  const mediaNumber = getNextPartNumber(zip, /^xl\/media\/image(\d+)\./);
  const imagePath = `xl/media/image${mediaNumber}.${extension === 'jpeg' ? 'jpeg' : 'png'}`;
  zip.file(imagePath, await fs.promises.readFile(photo.filePath));
  await ensureContentTypeDefault({ file: (name) => zip.file(name) }, zip, extension === 'jpeg' ? 'jpeg' : 'png');

  const drawingRelsPath = relsPathForPart(drawingPath);
  const drawingRelsXml = zip.file(drawingRelsPath) ? await zip.file(drawingRelsPath).async('string') : '';
  const drawingRels = await readXmlFromZip(zip, drawingRelsPath);
  const relIds = toArray(drawingRels?.Relationships?.Relationship)
    .map((relationship) => Number(String(relationship['@_Id'] || '').replace(/^rId/, '')) || 0);
  const relId = `rId${relIds.length ? Math.max(...relIds) + 1 : 1}`;
  zip.file(drawingRelsPath, appendRelationshipXml(drawingRelsXml, {
    id: relId,
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
    target: getRelativeTarget(drawingPath, imagePath),
  }));

  const drawingXml = await zip.file(drawingPath).async('string');
  const pictureId = mediaNumber + 1000;
  const anchorXml = buildPictureAnchorXml({ range, relId, pictureId, name: photo.name || photo.type });
  zip.file(drawingPath, drawingXml.replace('</xdr:wsDr>', `${anchorXml}</xdr:wsDr>`));
  return true;
};

const collectPhotoInsertions = (photoCells, photos) => {
  const photosByType = new Map();
  for (const photo of photos) {
    if (!photosByType.has(photo.type)) photosByType.set(photo.type, []);
    photosByType.get(photo.type).push(photo);
  }
  const getPhotosForType = (photoType) => {
    const typePhotos = photosByType.get(photoType) || [];
    if (typePhotos.length || photoType !== 'Photo Immeuble') return typePhotos;
    return photosByType.get('Photo Façade') || [];
  };

  const insertions = [];
  const insertedFixedTypes = new Set();
  for (const photoCell of photoCells) {
    const photoType = PHOTO_PLACEHOLDERS[photoCell.token];
    const typePhotos = getPhotosForType(photoType);
    const fixedRanges = PHOTO_RANGE_BY_PLACEHOLDER[photoCell.token];
    if (fixedRanges?.length) {
      if (insertedFixedTypes.has(photoType)) continue;
      typePhotos.slice(0, fixedRanges.length).forEach((photo, index) => {
        insertions.push({ sheetName: photoCell.sheetName, range: fixedRanges[index], photo });
      });
      insertedFixedTypes.add(photoType);
      continue;
    }
    if (typePhotos[0]) insertions.push({ sheetName: photoCell.sheetName, range: photoCell.address, photo: typePhotos[0] });
  }
  return insertions;
};

const insertPhotosIntoXlsxBuffer = async (buffer, photoCells, photos) => {
  const zip = await JSZip.loadAsync(buffer);
  const insertions = collectPhotoInsertions(photoCells, photos);
  for (const insertion of insertions) {
    const sheetPath = await getSheetPathByName(zip, insertion.sheetName);
    if (!sheetPath) continue;
    const { drawingPath } = await ensureSheetDrawing(zip, sheetPath);
    await appendImageToDrawing(zip, drawingPath, insertion.photo, insertion.range);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
};

const cleanupPlaceholdersInXlsxBuffer = async (buffer, replacements) => {
  const zip = await JSZip.loadAsync(buffer);
  const tokens = [
    ...Object.keys(replacements),
    ...Object.keys(PHOTO_PLACEHOLDERS),
  ];

  for (const fileName of Object.keys(zip.files)) {
    const file = zip.files[fileName];
    if (file.dir || !fileName.endsWith('.xml')) continue;
    let xml = await file.async('string');
    const originalXml = xml;
    for (const token of tokens) {
      xml = xml.split(token).join(replacements[token] || '');
    }
    if (xml !== originalXml) zip.file(fileName, xml);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
};

const getTemplatePath = () => {
  const candidates = [
    path.resolve(__dirname, '..', 'templates', 'dossier_technique_template.xlsx'),
    path.resolve(__dirname, '..', '..', 'templates', 'dossier_technique_template.xlsx'),
    path.resolve(process.cwd(), 'templates', 'dossier_technique_template.xlsx'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const getProjectRootPath = () => {
  return path.basename(process.cwd()).toLowerCase() === 'backendfiber'
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
};

const sanitizeFileName = (value) =>
  String(value || 'immeuble')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);

const getAddress = (building) =>
  [building.rueNomNom, building.numeroNomImmeuble, building.codePostal, building.ville]
    .filter(Boolean)
    .join(' ');

const formatReplacementValue = (value) => {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(formatReplacementValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if (typeof value.toString === 'function' && value.toString() !== '[object Object]') {
      return value.toString();
    }
    return JSON.stringify(value);
  }
  return String(value);
};

const getUserLabel = (user) => {
  if (!user) return process.env.ADMIN_EMAIL || process.env.USERNAME || '';
  return user.name || user.email || user.sub || user.id || '';
};

const addReplacementToken = (acc, key, value) => {
  const formattedValue = formatReplacementValue(value);
  const variants = new Set([
    key,
    key.toUpperCase(),
    key.toLowerCase(),
    key.charAt(0).toUpperCase() + key.slice(1),
  ]);
  for (const variant of variants) {
    acc[`{{${variant}}}`] = formattedValue;
  }
};

const buildReplacements = (building, user) => {
  const plain = building.toObject ? building.toObject() : building;
  const replacements = Object.entries(plain).reduce((acc, [key, value]) => {
    if (key === 'photos') return acc;
    acc[key] = value;
    return acc;
  }, {
    id: plain._id,
    adresse: getAddress(plain),
    User: getUserLabel(user),
    user: getUserLabel(user),
    utilisateur: getUserLabel(user),
    technicien: getUserLabel(user),
  });

  return Object.entries(replacements).reduce((acc, [key, value]) => {
    addReplacementToken(acc, key, value);
    return acc;
  }, {});
};

const getImageExtension = (photo) => {
  const mimeType = String(photo.mimeType || '').toLowerCase();
  const ext = path.extname(photo.filePath || photo.name || '').toLowerCase();
  if (mimeType.includes('png') || ext === '.png') return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg') || ext === '.jpeg' || ext === '.jpg') return 'jpeg';
  return null;
};

const columnNumberToName = (column) => {
  let value = column;
  let name = '';
  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }
  return name;
};

const parseCellRef = (cellRef) => {
  const match = String(cellRef || '').replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const column = match[1].toUpperCase().split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0);
  return { column, row: Number(match[2]) };
};

const parseRangeRef = (rangeRef) => {
  const [startRef, endRef] = String(rangeRef || '').split(':');
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef || startRef);
  if (!start || !end) return null;
  return { start, end };
};

const replaceTextTokens = (value, replacements) => {
  return Object.entries(replacements).reduce(
    (nextValue, [token, replacement]) => nextValue.split(token).join(replacement),
    value,
  );
};

const replacePlaceholdersXlsxPopulate = (workbook, replacements) => {
  const photoCells = [];
  workbook.sheets().forEach((sheet) => {
    const usedRange = sheet.usedRange();
    if (!usedRange) return;
    const values = usedRange.value();
    const matrix = Array.isArray(values?.[0]) ? values : [[values]];
    matrix.forEach((rowValues, rowIndex) => {
      rowValues.forEach((value, columnIndex) => {
        if (typeof value !== 'string') return;
        let nextValue = replaceTextTokens(value, replacements);
        for (const token of Object.keys(PHOTO_PLACEHOLDERS)) {
          if (!nextValue.includes(token)) continue;
          const rowNumber = rowIndex + 1;
          const columnNumber = columnIndex + 1;
          photoCells.push({
            sheetName: sheet.name(),
            address: `${columnNumberToName(columnNumber)}${rowNumber}`,
            token,
          });
          nextValue = nextValue.split(token).join('');
        }
        if (nextValue !== value) sheet.cell(rowIndex + 1, columnIndex + 1).value(nextValue);
      });
    });
  });
  return photoCells;
};

router.get('/building/:id', async (req, res) => {
  try {
    const templatePath = getTemplatePath();
    if (!templatePath) {
      return res.status(404).json({
        success: false,
        message: 'Template dossier_technique_template.xlsx introuvable.',
      });
    }

    const id = req.params.id;
    const filters = [{ idImmeuble: id }];
    if (mongoose.Types.ObjectId.isValid(id)) filters.push({ _id: id });

    const building = await Building.findOne({ $or: filters });
    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    const photos = await Photo.find({ buildingId: building._id }).sort({ timestamp: -1 });
    const replacements = buildReplacements(building, req.user);
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);
    const photoCells = replacePlaceholdersXlsxPopulate(workbook, replacements);

    const excelBuffer = await workbook.outputAsync();
    const photoBuffer = await insertPhotosIntoXlsxBuffer(Buffer.from(excelBuffer), photoCells, photos);
    const buffer = await cleanupPlaceholdersInXlsxBuffer(photoBuffer, replacements);
    const fileName = `dossier_technique_${sanitizeFileName(building.idImmeuble)}.xlsx`;
    const rootCopyPath = path.join(getProjectRootPath(), fileName);
    try {
      await fs.promises.writeFile(rootCopyPath, Buffer.from(buffer));
    } catch (copyError) {
      if (copyError.code !== 'EBUSY') throw copyError;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('[TECHNICAL_DOSSIER_EXPORT] failed', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
