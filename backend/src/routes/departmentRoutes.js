'use strict';

// =====================================================================
//  مسارات الأقسام — /api/v1/departments
//
//  ترتيب middleware ثابت (النموذج المرجعي):
//    authenticate → requirePermission/requireRole → controller
//
//  permission_matrix المعتمد:
//    GET  /      → departments:read   (جميع الموظّفين المصادَقين)
//    POST /      → departments:create (admin فقط)
//    GET  /:id   → departments:read
//    PATCH /:id  → departments:update (admin فقط)
//
//  ملاحظة: المريض (patient) لا يصل لمسارات الأقسام إطلاقاً؛
//  requirePermission('departments:read') تكفي لأن الصلاحية لا تُمنح له.
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
} = require('../controllers/departmentController');

// كل مسارات الأقسام تتطلب مصادقة
router.use(authenticate);

// GET /api/v1/departments — قائمة الأقسام مع رئيس القسم وعدد الموظّفين
// (receptionist, doctor, nurse, lab_technician, pharmacist, admin — لا patient)
router.get(
  '/',
  requirePermission('departments:read'),
  listDepartments
);

// POST /api/v1/departments — إنشاء قسم جديد (admin فقط)
router.post(
  '/',
  requirePermission('departments:create'),
  createDepartment
);

// GET /api/v1/departments/:id — تفاصيل قسم محدد مع قائمة موظّفيه
router.get(
  '/:id',
  requirePermission('departments:read'),
  getDepartment
);

// PATCH /api/v1/departments/:id — تعديل القسم (admin فقط)
router.patch(
  '/:id',
  requirePermission('departments:update'),
  updateDepartment
);

module.exports = router;
