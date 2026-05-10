const fs = require('fs');
const sharp = require('sharp');

const escapeSvgText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const formatPhotoTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
};

const writePhotoMetadataOnImage = async (filePath, metadata) => {
  const image = sharp(filePath);
  const imageMetadata = await image.metadata();
  const width = imageMetadata.width || 1200;
  const height = imageMetadata.height || 900;
  const fontSize = Math.max(9, Math.round(width * 0.011));
  const lineHeight = Math.round(fontSize * 1.35);
  const padding = Math.round(fontSize * 0.7);
  const lines = [
    `timestamp: ${formatPhotoTimestamp(metadata.timestamp)}`,
    `idImmeuble: ${metadata.idImmeuble || '-'}`,
    `gpsLatitude: ${metadata.gpsLatitude || '-'}`,
    `gpsLongitude: ${metadata.gpsLongitude || '-'}`,
  ];
  const boxWidth = Math.min(width - padding * 2, Math.round(width * 0.36));
  const boxHeight = lineHeight * lines.length + padding * 2;
  const x = padding;
  const y = Math.max(padding, height - boxHeight - padding);

  const textRows = lines.map((line, index) => (
    `<text x="${x + padding}" y="${y + padding + fontSize + index * lineHeight}" fill="#ffffff" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="700">${escapeSvgText(line)}</text>`
  )).join('');
  const svg = `
    <svg width="${width}" height="${height}">
      <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(fontSize * 0.35)}" fill="#000000" opacity="0.28"/>
      ${textRows}
    </svg>
  `;
  const stampedPath = `${filePath}.stamped.jpg`;

  await sharp(filePath)
    .rotate()
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toFile(stampedPath);

  await fs.promises.unlink(filePath);
  await fs.promises.rename(stampedPath, filePath);
};

module.exports = {
  writePhotoMetadataOnImage,
};
