const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Building = require('../models/Building');
const Assignment = require('../models/Assignment');
const Technician = require('../models/Technician');

const getAssignedBuildingIdsForUser = async (user) => {
  if (!user || user.role !== 'technician') return null;

  const technician = await Technician.findOne({
    $or: [
      { id: user.sub },
      { id: user.id },
      { email: user.email },
    ].filter((condition) => Object.values(condition)[0]),
  }).select('_id assignedBuildings');

  if (!technician) return [];

  const assignedFromAssignments = await Assignment.find({
    technicianIds: technician._id,
    status: 'active',
  }).distinct('itemId');

  return Array.from(
    new Set([
      ...(technician.assignedBuildings || []).map((id) => id.toString()),
      ...assignedFromAssignments.map((id) => id.toString()),
    ]),
  );
};

const applyTechnicianAccessFilter = async (req, query) => {
  const assignedBuildingIds = await getAssignedBuildingIdsForUser(req.user);
  if (!assignedBuildingIds) return query;
  return {
    ...query,
    _id: { $in: assignedBuildingIds },
  };
};

const canUserAccessBuilding = async (req, building) => {
  if (!req.user || req.user.role !== 'technician') return true;
  if (!building?._id) return false;
  const assignedBuildingIds = await getAssignedBuildingIdsForUser(req.user);
  return assignedBuildingIds?.includes(building._id.toString()) || false;
};

// Get all buildings with optional filters
router.get('/', async (req, res) => {
  try {
    const { 
      serviceId, 
      status = 'active', 
      zone,
      ville, 
      page = 1, 
      limit = 50,
      search 
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(200, Math.max(1, Number(limit) || 50));

    let query = {};
    
    if (serviceId) query.serviceId = serviceId;
    if (status && status !== 'all') query.status = status;
    if (zone) query.zone = zone;
    if (ville) query.ville = new RegExp(ville, 'i');
    if (search) {
      query.$or = [
        { idImmeuble: new RegExp(search, 'i') },
        { rueNomNom: new RegExp(search, 'i') },
        { syndic: new RegExp(search, 'i') }
      ];
    }
    query = await applyTechnicianAccessFilter(req, query);

    const buildings = await Building.find(query)
      .sort({ lastModified: -1 })
      .limit(limitNumber)
      .skip((pageNumber - 1) * limitNumber)
      .populate('photos');

    const count = await Building.countDocuments(query);

    res.json({
      success: true,
      count,
      totalPages: Math.ceil(count / limitNumber),
      currentPage: pageNumber,
      data: buildings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get buildings by service
router.get('/service/:serviceId', async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const query = await applyTechnicianAccessFilter(req, {
      serviceId: req.params.serviceId,
      status
    });
    const buildings = await Building.find(query).populate('photos');

    res.json({ success: true, count: buildings.length, data: buildings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single building by ID
router.get('/:id', async (req, res) => {
  try {
    const building = await Building.findOne({ 
      $or: [
        { _id: req.params.id },
        { idImmeuble: req.params.id }
      ]
    }).populate('photos');

    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }
    if (!(await canUserAccessBuilding(req, building))) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    res.json({ success: true, data: building });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new building
router.post('/', [
  body('idImmeuble').notEmpty().withMessage('idImmeuble is required'),
  body('idImmeubleSysteme').notEmpty().withMessage('idImmeubleSysteme is required'),
  body('ville').notEmpty().withMessage('ville is required'),
  body('rueNomNom').notEmpty().withMessage('rueNomNom is required'),
  body('numeroNomImmeuble').notEmpty().withMessage('numeroNomImmeuble is required'),
  body('serviceId').notEmpty().withMessage('serviceId is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const building = await Building.create(req.body);
    res.status(201).json({ success: true, data: building });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Building with this ID already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update building
router.put('/:id', async (req, res) => {
  try {
    const building = await Building.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { idImmeuble: req.params.id }
        ]
      },
      { ...req.body, lastModified: new Date() },
      { new: true, runValidators: true }
    );

    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    res.json({ success: true, data: building });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/Archive building
router.delete('/:id', async (req, res) => {
  try {
    const building = await Building.findOneAndUpdate(
      { 
        $or: [
          { _id: req.params.id },
          { idImmeuble: req.params.id }
        ]
      },
      { status: 'archived' },
      { new: true }
    );

    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    res.json({ success: true, message: 'Building archived successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk update buildings
router.post('/bulk-update', async (req, res) => {
  try {
    const { buildings } = req.body;
    if (!Array.isArray(buildings) || buildings.length === 0) {
      return res.status(400).json({ success: false, message: 'buildings must be a non-empty array' });
    }
    
    const operations = buildings.map(building => ({
      updateOne: {
        filter: { idImmeuble: building.idImmeuble },
        update: { ...building, lastModified: new Date() },
        upsert: true
      }
    }));

    const result = await Building.bulkWrite(operations);
    
    res.json({
      success: true,
      message: `${result.modifiedCount} buildings updated, ${result.upsertedCount} created`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
