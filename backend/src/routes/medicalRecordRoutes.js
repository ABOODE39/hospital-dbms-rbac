'use strict';

// =====================================================================
//  مسارات السجلات الطبية — /api/v1/medical-records
//
//  سلسلة الحماية لكل مسار:
//    authenticate → requirePermission → controller
//
//  جدول الأدوار والصلاحيات:
//    medical_records:read   → doctor, nurse, admin, patient(own)
//    medical_records:create → doctor
//    medical_records:update → doctor, nurse
//    diagnoses:read         → doctor, nurse, admin, patient(own)
//    diagnoses:create       → doctor
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  listMedicalRecords,
  getMedicalRecord,
  createMedicalRecord,
  updateMedicalRecord,
  listDiagnoses,
  addDiagnosis,
} = require('../controllers/medicalRecordController');

const { getDiagnosis, updateDiagnosis } = require('../controllers/diagnosisController');

// كل مسارات السجلات الطبية تتطلب مصادقة
router.use(authenticate);

// ---- السجلات الطبية ----

// GET /api/v1/medical-records — قائمة السجلات (doctor, nurse, admin)
router.get(
  '/',
  requirePermission('medical_records:read'),
  listMedicalRecords
);

// POST /api/v1/medical-records — إنشاء سجل طبي جديد (doctor فقط)
router.post(
  '/',
  requirePermission('medical_records:create'),
  createMedicalRecord
);

// GET /api/v1/medical-records/:id — تفاصيل سجل محدد
router.get(
  '/:id',
  requirePermission('medical_records:read'),
  getMedicalRecord
);

// PATCH /api/v1/medical-records/:id — تعديل ملاحظات/vital_signs
router.patch(
  '/:id',
  requirePermission('medical_records:update'),
  updateMedicalRecord
);

// ---- التشخيصات عبر مسار السجل الطبي ----

// GET /api/v1/medical-records/:id/diagnoses — قائمة تشخيصات سجل طبي
router.get(
  '/:id/diagnoses',
  requirePermission('diagnoses:read'),
  listDiagnoses
);

// POST /api/v1/medical-records/:id/diagnoses — إضافة تشخيص (doctor فقط)
router.post(
  '/:id/diagnoses',
  requirePermission('diagnoses:create'),
  addDiagnosis
);

module.exports = router;
