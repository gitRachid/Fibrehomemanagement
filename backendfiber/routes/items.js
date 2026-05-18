const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

// Get all items with optional filters
router.get('/', async (req, res) => {
  try {
    const { serviceId, status = 'active', search } = req.query;

    let query = {};
    
    if (serviceId) query.serviceId = serviceId;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const items = await Item.find(query).sort({ lastModified: -1 });

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get items by service
router.get('/service/:serviceId', async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const items = await Item.find({ 
      serviceId: req.params.serviceId,
      status
    }).sort({ lastModified: -1 });

    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findOne({ 
      $or: [
        { _id: req.params.id },
        { id: req.params.id }
      ]
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new item
router.post('/', async (req, res) => {
  try {
    const itemData = req.body;
    
    // Check if item with same ID already exists
    const existingItem = await Item.findOne({ id: itemData.id });
    if (existingItem) {
      return res.status(400).json({ 
        success: false, 
        message: `Item with id '${itemData.id}' already exists` 
      });
    }

    const item = new Item(itemData);
    await item.save();

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update item
router.put('/:id', async (req, res) => {
  try {
    const item = await Item.findOneAndUpdate(
      {
        $or: [
          { _id: req.params.id },
          { id: req.params.id }
        ]
      },
      { ...req.body, lastModified: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Archive/Delete item (soft delete) — manager only when authenticated
router.delete('/:id', async (req, res) => {
  try {
    if (req.user && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const item = await Item.findOneAndUpdate(
      {
        $or: [
          { _id: req.params.id },
          { id: req.params.id }
        ]
      },
      { status: 'inactive', lastModified: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, message: 'Item archived successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
