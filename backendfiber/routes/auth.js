const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Technician = require('../models/Technician');

const router = express.Router();

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@fiber.local';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be configured in production');
}

// Pre-hash the default password once at module load time
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check MongoDB users first. This lets a real technician account use the same
    // email as ADMIN_EMAIL without being forced into the default manager role.
    const technician = await Technician.findOne({
      email: normalizedEmail,
      status: 'active'
    });

    if (technician) {
      if (!technician.password) {
        return res.status(401).json({ 
          success: false, 
          message: 'Account has no password set. Please contact administrator.' 
        });
      }
      const isValidPassword = await bcrypt.compare(String(password), technician.password);
      if (isValidPassword) {
        // Update last login
        technician.lastLogin = new Date();
        await technician.save();

        const token = jwt.sign(
          { sub: technician.id, email: technician.email, role: technician.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        return res.json({
          success: true,
          data: {
            token,
            user: {
              id: technician.id,
              name: technician.name,
              email: technician.email,
              role: technician.role,
            },
          },
        });
      }
    }

    // Fallback: default admin from environment.
    if (normalizedEmail === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      const isValidPassword = await bcrypt.compare(String(password), DEFAULT_PASSWORD_HASH);
      if (isValidPassword) {
        const token = jwt.sign(
          { sub: 'admin', email: normalizedEmail, role: 'manager' },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        return res.json({
          success: true,
          data: {
            token,
            user: { id: 'admin', email: normalizedEmail, role: 'manager' },
          },
        });
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
