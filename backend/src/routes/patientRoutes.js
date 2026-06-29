'use strict';

// =====================================================================
//  مسارات المرضى — /api/v1/patients
//  النموذج المرجعي: authenticate ثم requirePermission ثم المتحكم
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }                  = require('../middleware/auth');
const { requirePermission }             = require('../middleware/rbac');
const {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
} = require('../controllers/patientController');

// كل مسارات المرضى تتطلب مصادقة
router.use(authenticate);

// GET /api/v1/patients — قائمة المرضى (receptionist, doctor, nurse, admin, patient)
router.get(
  '/',
  requirePermission('patients:read'),
  listPatients
);

// POST /api/v1/patients — تسجيل مريض جديد (receptionist, admin)
router.post(
  '/',
  requirePermission('patients:create'),
  createPatient
);

// GET /api/v1/patients/:id — ملف مريض محدد
router.get(
  '/:id',
  requirePermission('patients:read'),
  getPatient
);

// PATCH /api/v1/patients/:id — تعديل بيانات مريض
router.patch(
  '/:id',
  requirePermission('patients:update'),
  updatePatient
);

module.exports = router;
