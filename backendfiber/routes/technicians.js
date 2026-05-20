const express = require('express');
const router = express.Router();
const Technician = require('../models/Technician');
const { requireAuth, requireManager } = require('../middleware/auth');

// Get all technicians
router.get('/', async (req, res) => {
  try {
    const { status = 'active', role } = req.query;
    let query = {};
    
    if (status && status !== 'all') query.status = status;
    if (role) query.role = role;

    const technicians = await Technician.find(query)
      .populate('assignedBuildings')
      .select('-password');
    
    res.json({ success: true, count: technicians.length, data: technicians });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single technician
router.get('/:id', async (req, res) => {
  try {
    const technician = await Technician.findOne({
      $or: [
        { _id: req.params.id },
        { id: req.params.id }
      ]
    })
      .populate('assignedBuildings')
      .select('-password');

    if (!technician) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    res.json({ success: true, data: technician });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create technician (manager only — requireAuth ici aussi pour le mode dev sans API_REQUIRE_AUTH)
router.post('/', requireAuth, requireManager, async (req, res) => {
  try {
    const technician = await Technician.create(req.body);
    const technicianResponse = technician.toObject();
    delete technicianResponse.password;
    res.status(201).json({ success: true, data: technicianResponse });
  } catch (error) {
    if (error.code === 11000) {
      // Check which field caused the duplicate key error
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      const message = field 
        ? `Un technicien avec ce ${field === 'email' ? 'email' : 'identifiant'} (${value}) existe déjà`
        : 'Technician with this email or ID already exists';
      return res.status(400).json({ success: false, message, field });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update technician (manager only)
router.put('/:id', requireAuth, requireManager, async (req, res) => {
  try {
    // Find the technician first
    const technician = await Technician.findOne({
      $or: [
        { _id: req.params.id },
        { id: req.params.id }
      ]
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (key !== '_id' && key !== 'id') {
        technician[key] = req.body[key];
      }
    });

    // Save to trigger pre-save middleware (password hashing)
    await technician.save();

    // Return without password
    const technicianResponse = technician.toObject();
    delete technicianResponse.password;

    res.json({ success: true, data: technicianResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete technician (manager only)
router.delete('/:id', requireAuth, requireManager, async (req, res) => {
  try {
    const technician = await Technician.findOneAndDelete({
      $or: [
        { _id: req.params.id },
        { id: req.params.id }
      ]
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    res.json({ success: true, message: 'Technician deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
