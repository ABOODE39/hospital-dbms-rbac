'use strict';

// =====================================================================
//  مسارات الوصفات الطبية — /api/v1/prescriptions
//
//  جدول الأدوار والصلاحيات:
//    prescriptions:read   → doctor(own), pharmacist, admin, patient(own)
//    prescriptions:create → doctor
//    prescriptions:update → pharmacist (status→dispensed), doctor (cancelled/items)
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  listPrescriptions,
  getPrescription,
  createPrescription,
  updatePrescriptionStatus,
  updatePrescriptionItem,
} = require('../controllers/prescriptionController');

router.use(authenticate);

// GET /api/v1/prescriptions — قائمة الوصفات مع فلتر
router.get(
  '/',
  requirePermission('prescriptions:read'),
  listPrescriptions
);

// POST /api/v1/prescriptions — إنشاء وصفة جديدة مع بنودها (doctor فقط)
router.post(
  '/',
  requirePermission('prescriptions:create'),
  createPrescription
);

// GET /api/v1/prescriptions/:id — تفاصيل وصفة مع بنودها
router.get(
  '/:id',
  requirePermission('prescriptions:read'),
  getPrescription
);

// PATCH /api/v1/prescriptions/:id/status — تغيير الحالة (dispensed/cancelled)
router.patch(
  '/:id/status',
  requirePermission('prescriptions:update'),
  updatePrescriptionStatus
);

// PATCH /api/v1/prescriptions/:id/items/:itemId — تعديل بند في الوصفة (doctor)
router.patch(
  '/:id/items/:itemId',
  requirePermission('prescriptions:update'),
  updatePrescriptionItem
);

module.exports = router;
