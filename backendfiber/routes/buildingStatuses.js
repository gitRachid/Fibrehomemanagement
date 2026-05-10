const express = require('express');
const router = express.Router();
const BuildingStatus = require('../models/BuildingStatus');

const DEFAULT_STATUSES = [
  { value: 'active', label: 'Actif', color: '#16a34a', sortOrder: 10 },
  { value: 'pending', label: 'En attente', color: '#f59e0b', sortOrder: 20 },
  { value: 'archived', label: 'Archivé', color: '#dc2626', sortOrder: 30 },
  { value: 'inactive', label: 'Inactif', color: '#64748b', sortOrder: 40 },
];

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ensureDefaults = async () => {
  const count = await BuildingStatus.countDocuments();
  if (count === 0) await BuildingStatus.insertMany(DEFAULT_STATUSES);
};

router.get('/', async (req, res) => {
  try {
    await ensureDefaults();
    const statuses = await BuildingStatus.find().sort({ sortOrder: 1, label: 1 });
    res.json({ success: true, count: statuses.length, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const label = String(req.body?.label || '').trim();
    const value = slugify(req.body?.value || label);
    if (!label || !value) {
      return res.status(400).json({ success: false, message: 'Label is required' });
    }

    const status = await BuildingStatus.create({
      value,
      label,
      color: req.body?.color || '#64748b',
      managerOnly: Boolean(req.body?.managerOnly),
      sortOrder: Number(req.body?.sortOrder) || 100,
    });

    res.status(201).json({ success: true, data: status });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Status already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:value', async (req, res) => {
  try {
    const deleted = await BuildingStatus.findOneAndDelete({ value: req.params.value });
    if (!deleted) return res.status(404).json({ success: false, message: 'Status not found' });
    res.json({ success: true, message: 'Status deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
