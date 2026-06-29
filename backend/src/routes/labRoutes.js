'use strict';

// =====================================================================
//  مسارات المختبر — /api/v1/lab-tests و /api/v1/lab-orders
//
//  Permission matrix:
//    lab_tests:read   — lab_technician, doctor, nurse, admin
//    lab_tests:create — admin
//    lab_tests:update — admin
//    lab_orders:read   — lab_technician, doctor, admin, patient(own)
//    lab_orders:create — doctor
//    lab_orders:update — lab_technician
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const {
  listLabTests,
  getLabTest,
  createLabTest,
  updateLabTest,
} = require('../controllers/labTestController');

const {
  listLabOrders,
  getLabOrder,
  createLabOrder,
  updateLabOrderResult,
} = require('../controllers/labOrderController');

// كل مسارات المختبر تتطلب مصادقة
router.use(authenticate);

// ─── كتالوج أنواع الفحوص (lab_tests) ─────────────────────────────────

// GET /api/v1/lab-tests — قائمة أنواع الفحوص
router.get(
  '/lab-tests',
  requirePermission('lab_tests:read'),
  listLabTests
);

// POST /api/v1/lab-tests — إضافة نوع فحص (admin فقط)
router.post(
  '/lab-tests',
  requirePermission('lab_tests:create'),
  createLabTest
);

// GET /api/v1/lab-tests/:id — تفاصيل نوع فحص
router.get(
  '/lab-tests/:id',
  requirePermission('lab_tests:read'),
  getLabTest
);

// PATCH /api/v1/lab-tests/:id — تعديل نوع فحص (admin فقط)
router.patch(
  '/lab-tests/:id',
  requirePermission('lab_tests:update'),
  updateLabTest
);

// ─── طلبات الفحص (lab_orders) ────────────────────────────────────────

// GET /api/v1/lab-orders — قائمة طلبات الفحص
router.get(
  '/lab-orders',
  requirePermission('lab_orders:read'),
  listLabOrders
);

// POST /api/v1/lab-orders — طلب فحص جديد (doctor فقط)
router.post(
  '/lab-orders',
  requirePermission('lab_orders:create'),
  createLabOrder
);

// GET /api/v1/lab-orders/:id — تفاصيل طلب فحص
router.get(
  '/lab-orders/:id',
  requirePermission('lab_orders:read'),
  getLabOrder
);

// PATCH /api/v1/lab-orders/:id/result — إدخال نتيجة (lab_technician فقط)
router.patch(
  '/lab-orders/:id/result',
  requirePermission('lab_orders:update'),
  updateLabOrderResult
);

module.exports = router;
