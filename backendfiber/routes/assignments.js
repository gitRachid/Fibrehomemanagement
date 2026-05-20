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

/** Resolve request values to stable business technician ids stored on assignments. */
const resolveTechnicianIds = async (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return [];

  const unique = [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
  const objectIdValues = unique.filter((id) => isValidObjectId(id));
  const otherValues = unique.filter((id) => !isValidObjectId(id));

  const orConditions = [];
  if (objectIdValues.length > 0) {
    orConditions.push({ _id: { $in: objectIdValues } });
  }
  if (otherValues.length > 0) {
    orConditions.push({ id: { $in: otherValues } });
    orConditions.push({ email: { $in: otherValues.map((e) => e.toLowerCase()) } });
  }
  if (orConditions.length === 0) return [];

  const techs = await Technician.find({ $or: orConditions }).select('id _id');
  return [...new Set(techs.map((tech) => tech.id).filter(Boolean))];
};

const enrichAssignmentsWithTechnicians = async (assignments) => {
  const raw = assignments.map((a) => (typeof a.toObject === 'function' ? a.toObject() : a));
  const lookupKeys = new Set();
  for (const assignment of raw) {
    for (const tid of assignment.technicianIds || []) {
      lookupKeys.add(String(tid));
    }
  }
  if (lookupKeys.size === 0) return raw;

  const keys = [...lookupKeys];
  const objectIdKeys = keys.filter(isValidObjectId);
  const otherKeys = keys.filter((k) => !isValidObjectId(k));

  const orConditions = [];
  if (objectIdKeys.length > 0) {
    orConditions.push({ _id: { $in: objectIdKeys } });
  }
  if (otherKeys.length > 0) {
    orConditions.push({ id: { $in: otherKeys } });
    orConditions.push({ email: { $in: otherKeys.map((e) => e.toLowerCase()) } });
  }

  const techs = orConditions.length > 0 ? await Technician.find({ $or: orConditions }) : [];
  const byBusinessId = new Map(techs.map((t) => [t.id, t]));
  const byLegacyKey = new Map(techs.map((t) => [String(t._id), t]));

  return raw.map((assignment) => ({
    ...assignment,
    technicianIds: (assignment.technicianIds || []).map((tid) => {
      const key = String(tid);
      return byBusinessId.get(key) || byLegacyKey.get(key) || { id: key, _id: key };
    }),
  }));
};

// Get all assignments
router.get('/', async (req, res) => {
  try {
    const { technicianId, status = 'active' } = req.query;
    const query = { status };

    if (technicianId) {
      const resolved = await resolveTechnicianIds([technicianId]);
      query.technicianIds = resolved[0] || technicianId;
    }

    const assignments = await Assignment.find(query).populate('itemId');
    const data = await enrichAssignmentsWithTechnicians(assignments);

    res.json({ success: true, count: data.length, data });
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
    });
    const data = await enrichAssignmentsWithTechnicians(assignments);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get assignments for a technician
router.get('/technician/:technicianId', async (req, res) => {
  try {
    const resolved = await resolveTechnicianIds([req.params.technicianId]);
    const techKey = resolved[0] || req.params.technicianId;

    const assignments = await Assignment.find({
      technicianIds: techKey,
      status: 'active',
    }).populate('itemId');

    const buildingIds = assignments.map((a) => a.itemId);

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

    const building = resolvedBuildingId ? await Building.findById(resolvedBuildingId) : null;
    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }
    if (resolvedTechnicianIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one valid technician is required' });
    }

    await Assignment.updateMany(
      { itemId: resolvedBuildingId, status: 'active' },
      { status: 'cancelled' },
    );

    const assignment = await Assignment.create({
      itemId: resolvedBuildingId,
      technicianIds: resolvedTechnicianIds,
      assignedBy: assignedBy || 'system',
      notes,
      status: 'active',
    });

    const [data] = await enrichAssignmentsWithTechnicians([assignment]);

    res.status(201).json({ success: true, data });
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
    const data = await enrichAssignmentsWithTechnicians(created);

    res.status(201).json({
      success: true,
      message: `${created.length} assignments created`,
      data,
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
      { new: true },
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
