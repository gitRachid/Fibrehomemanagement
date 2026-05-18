const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const Building = require('../models/Building');
const Technician = require('../models/Technician');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveBuildingId = async (value) => {
  if (!value) return null;
  if (isValidObjectId(value)) {
    return value;
  }
  const building = await Building.findOne({ idImmeuble: value }).select('_id');
  return building?._id?.toString() || null;
};

const resolveTechnicianIds = async (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return [];

  const directObjectIds = values.filter((id) => typeof id === 'string' && isValidObjectId(id));
  const customIds = values.filter((id) => typeof id === 'string' && !isValidObjectId(id));

  let resolvedFromCustomIds = [];
  if (customIds.length > 0) {
    const techs = await Technician.find({ id: { $in: customIds } }).select('_id');
    resolvedFromCustomIds = techs.map((tech) => tech._id.toString());
  }

  return Array.from(new Set([...directObjectIds, ...resolvedFromCustomIds]));
};

// Get all assignments
router.get('/', async (req, res) => {
  try {
    const { technicianId, status = 'active' } = req.query;
    let query = { status };
    
    if (technicianId) {
      query.technicianIds = technicianId;
    }

    const assignments = await Assignment.find(query)
      .populate('itemId')
      .populate('technicianIds');

    res.json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get assignments for a building (accepts Mongo _id or idImmeuble — must match stored itemId)
router.get('/building/:buildingId', async (req, res) => {
  try {
    const resolvedBuildingId = await resolveBuildingId(req.params.buildingId);
    const queryId =
      resolvedBuildingId ||
      (isValidObjectId(req.params.buildingId) ? req.params.buildingId : null);

    if (!queryId) {
      return res.json({ success: true, data: [] });
    }

    const assignments = await Assignment.find({
      itemId: queryId,
      status: 'active',
    }).populate('technicianIds');

    res.json({ success: true, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get assignments for a technician
router.get('/technician/:technicianId', async (req, res) => {
  try {
    const assignments = await Assignment.find({
      technicianIds: req.params.technicianId,
      status: 'active'
    }).populate('itemId');

    const buildingIds = assignments.map(a => a.itemId);
    
    res.json({ success: true, count: assignments.length, data: buildingIds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new assignment
router.post('/', async (req, res) => {
  try {
    const { itemId, technicianIds, assignedBy, notes } = req.body;
    const resolvedBuildingId = await resolveBuildingId(itemId);
    const resolvedTechnicianIds = await resolveTechnicianIds(technicianIds);

    // Check if building exists
    const building = resolvedBuildingId ? await Building.findById(resolvedBuildingId) : null;
    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }
    if (resolvedTechnicianIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one valid technician is required' });
    }

    // Deactivate existing assignments for this building
    await Assignment.updateMany(
      { itemId: resolvedBuildingId, status: 'active' },
      { status: 'cancelled' }
    );

    // Create new assignment
    const assignment = await Assignment.create({
      itemId: resolvedBuildingId,
      technicianIds: resolvedTechnicianIds,
      assignedBy: assignedBy || 'system',
      notes,
      status: 'active'
    });

    await assignment.populate('technicianIds');

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk create assignments
router.post('/bulk', async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ success: false, message: 'assignments must be a non-empty array' });
    }

    const normalizedAssignments = [];
    for (const assignment of assignments) {
      const resolvedBuildingId = await resolveBuildingId(assignment.itemId);
      const resolvedTechnicianIds = await resolveTechnicianIds(assignment.technicianIds);
      if (!resolvedBuildingId || resolvedTechnicianIds.length === 0) {
        continue;
      }
      normalizedAssignments.push({
        ...assignment,
        itemId: resolvedBuildingId,
        technicianIds: resolvedTechnicianIds,
        assignedBy: assignment.assignedBy || 'system',
      });
    }

    if (normalizedAssignments.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid assignments found' });
    }

    const buildingIds = normalizedAssignments.map((assignment) => assignment.itemId);
    await Assignment.updateMany(
      { itemId: { $in: buildingIds }, status: 'active' },
      { status: 'cancelled' },
    );

    const created = await Assignment.insertMany(normalizedAssignments);
    
    res.status(201).json({
      success: true,
      message: `${created.length} assignments created`,
      data: created
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel assignment
router.put('/:id/cancel', async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    res.json({ success: true, message: 'Assignment cancelled', data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
