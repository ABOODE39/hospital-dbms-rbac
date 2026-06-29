'use strict';

// =====================================================================
//  مسارات المصادقة — /api/v1/auth
// =====================================================================

const express = require('express');
const router  = express.Router();

const { register, login, me } = require('../controllers/authController');
const { authenticate }        = require('../middleware/auth');

// POST /api/v1/auth/register — عام (بلا مصادقة)
router.post('/register', register);

// POST /api/v1/auth/login — عام
router.post('/login', login);

// GET /api/v1/auth/me — محمي: يتطلب Bearer Token
router.get('/me', authenticate, me);

module.exports = router;
