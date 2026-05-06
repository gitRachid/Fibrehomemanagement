const express = require('express');
const router = express.Router();
const Building = require('../models/Building');
const Assignment = require('../models/Assignment');
const Photo = require('../models/Photo');
const Technician = require('../models/Technician');
const mongoose = require('mongoose');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveBuildingId = async (value) => {
  if (!value) return null;
  if (isValidObjectId(value)) return value;
  const building = await Building.findOne({ idImmeuble: value }).select('_id');
  return building?._id?.toString() || null;
};

const resolveTechnicianIds = async (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return [];
  const directObjectIds = values.filter((id) => typeof id === 'string' && isValidObjectId(id));
  const customIds = values.filter((id) => typeof id === 'string' && !isValidObjectId(id));
  let resolvedFromCustomIds = [];
  if (customIds.length > 0) {
    const technicians = await Technician.find({ id: { $in: customIds } }).select('_id');
    resolvedFromCustomIds = technicians.map((tech) => tech._id.toString());
  }
  return Array.from(new Set([...directObjectIds, ...resolvedFromCustomIds]));
};

// Sync endpoint for offline data synchronization
router.post('/', async (req, res) => {
  try {
    const { 
      pendingChanges, 
      deviceId, 
      lastSync 
    } = req.body;

    const results = {
      buildings: { updated: 0, created: 0, errors: [] },
      assignments: { updated: 0, created: 0, errors: [] },
      photos: { uploaded: 0, errors: [] }
    };

    // Process each pending change
    for (const change of pendingChanges) {
      try {
        switch (change.type) {
          case 'buildings_update':
          case 'manual_save':
            // Update or create buildings
            for (const buildingData of change.data) {
              const existing = await Building.findOne({ idImmeuble: buildingData.idImmeuble });
              
              if (existing) {
                await Building.findByIdAndUpdate(existing._id, {
                  ...buildingData,
                  lastModified: new Date()
                });
                results.buildings.updated++;
              } else {
                await Building.create(buildingData);
                results.buildings.created++;
              }
            }
            break;

          case 'assignment':
            // Handle assignment changes
            {
              const sourceBuildingId = change.itemId || change.buildingId;
              const resolvedBuildingId = await resolveBuildingId(sourceBuildingId);
              const resolvedTechnicianIds = await resolveTechnicianIds(change.technicianIds);
              if (!resolvedBuildingId || resolvedTechnicianIds.length === 0) {
                results.assignments.errors.push({
                  type: change.type,
                  error: 'Invalid building or technician IDs in pending assignment',
                });
                break;
              }
              await Assignment.create({
                itemId: resolvedBuildingId,
                technicianIds: resolvedTechnicianIds,
                assignedBy: change.assignedBy || 'system',
                status: 'active'
              });
              results.assignments.created++;
            }
            break;

          default:
            console.log('Unknown change type:', change.type);
        }
      } catch (error) {
        const bucket = change.type === 'assignment' ? results.assignments.errors : results.buildings.errors;
        bucket.push({
          type: change.type,
          error: error.message
        });
      }
    }

    // Get updated data since last sync
    const updatedBuildings = await Building.find({
      lastModified: { $gt: new Date(lastSync || 0) }
    }).populate('photos');

    const updatedAssignments = await Assignment.find({
      updatedAt: { $gt: new Date(lastSync || 0) }
    }).populate('technicianIds');

    res.json({
      success: true,
      results,
      syncTimestamp: new Date().toISOString(),
      data: {
        buildings: updatedBuildings,
        assignments: updatedAssignments
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sync status
router.get('/status', async (req, res) => {
  try {
    const { lastSync } = req.query;
    
    const pendingBuildings = await Building.countDocuments({
      lastModified: { $gt: new Date(lastSync || 0) }
    });

    const pendingAssignments = await Assignment.countDocuments({
      updatedAt: { $gt: new Date(lastSync || 0) }
    });

    res.json({
      success: true,
      hasPendingChanges: pendingBuildings > 0 || pendingAssignments > 0,
      pendingBuildings,
      pendingAssignments,
      serverTimestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Conflict resolution endpoint
router.post('/resolve', async (req, res) => {
  try {
    const { conflicts } = req.body;
    const resolved = [];

    for (const conflict of conflicts) {
      const { buildingId, serverVersion, clientVersion, resolution } = conflict;

      if (resolution === 'server') {
        resolved.push({ buildingId, data: serverVersion });
      } else if (resolution === 'client') {
        await Building.findOneAndUpdate(
          { idImmeuble: buildingId },
          { ...clientVersion, lastModified: new Date() }
        );
        resolved.push({ buildingId, data: clientVersion });
      } else if (resolution === 'merge') {
        const merged = { ...serverVersion, ...clientVersion, lastModified: new Date() };
        await Building.findOneAndUpdate(
          { idImmeuble: buildingId },
          merged
        );
        resolved.push({ buildingId, data: merged });
      }
    }

    res.json({ success: true, resolved });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
