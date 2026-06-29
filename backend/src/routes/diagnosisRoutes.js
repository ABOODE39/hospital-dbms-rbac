'use strict';

// =====================================================================
//  مسارات التشخيصات المستقلة — /api/v1/diagnoses
//
//  ملاحظة: إنشاء التشخيصات يتم عبر:
//    POST /api/v1/medical-records/:id/diagnoses
//  هذا الملف يغطّي العمليات على تشخيص مفرد بمعرّفه المباشر.
//
//  diagnoses:read   → doctor, nurse, admin, patient(own)
//  diagnoses:update → doctor (مالك السجل الأب)
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { getDiagnosis, updateDiagnosis } = require('../controllers/diagnosisController');

router.use(authenticate);

// GET /api/v1/diagnoses/:id — تفاصيل تشخيص محدد
router.get(
  '/:id',
  requirePermission('diagnoses:read'),
  getDiagnosis
);

// PATCH /api/v1/diagnoses/:id — تعديل تشخيص (تصحيح كود/وصف)
router.patch(
  '/:id',
  requirePermission('diagnoses:update'),
  updateDiagnosis
);

module.exports = router;
