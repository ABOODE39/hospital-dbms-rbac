'use strict';

// =====================================================================
//  مسارات المواعيد — /api/v1/appointments
//
//  ترتيب middleware ثابت (النموذج المرجعي):
//    authenticate → requirePermission → controller
//
//  permission_matrix المعتمد:
//    GET  /             → appointments:read   (receptionist, admin, doctor, nurse)
//    POST /             → appointments:create (receptionist, admin, patient)
//    GET  /:id          → appointments:read
//    PATCH /:id         → appointments:update (receptionist, admin, doctor)
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
} = require('../controllers/appointmentController');

// كل مسارات المواعيد تتطلب مصادقة
router.use(authenticate);

// GET /api/v1/appointments — قائمة المواعيد مع فلترة (receptionist, admin, doctor, nurse)
router.get(
  '/',
  requirePermission('appointments:read'),
  listAppointments
);

// POST /api/v1/appointments — حجز موعد جديد (receptionist, admin, patient)
router.post(
  '/',
  requirePermission('appointments:create'),
  createAppointment
);

// GET /api/v1/appointments/:id — تفاصيل موعد محدد
router.get(
  '/:id',
  requirePermission('appointments:read'),
  getAppointment
);

// PATCH /api/v1/appointments/:id — تعديل الحالة / إعادة الجدولة (receptionist, admin, doctor)
router.patch(
  '/:id',
  requirePermission('appointments:update'),
  updateAppointment
);

module.exports = router;
