'use strict';

// =====================================================================
//  مسارات الفوترة — /api/v1/billing
//
//  Permission matrix:
//    invoices:read   — receptionist, admin, patient(own عبر RLS)
//    invoices:create — receptionist, admin
//    invoices:update — receptionist, admin
//    payments:read   — receptionist, admin, patient(own عبر RLS)
//    payments:create — receptionist, admin
// =====================================================================

const express = require('express');
const router  = express.Router();

const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
} = require('../controllers/invoiceController');

const {
  createPayment,
  listPayments,
} = require('../controllers/paymentController');

// كل مسارات الفوترة تتطلب مصادقة
router.use(authenticate);

// ─── الفواتير (invoices) ──────────────────────────────────────────────

// GET /api/v1/billing/invoices — قائمة الفواتير
router.get(
  '/invoices',
  requirePermission('invoices:read'),
  listInvoices
);

// POST /api/v1/billing/invoices — إنشاء فاتورة مع بنودها
router.post(
  '/invoices',
  requirePermission('invoices:create'),
  createInvoice
);

// GET /api/v1/billing/invoices/:id — تفاصيل فاتورة مع البنود والمدفوعات
router.get(
  '/invoices/:id',
  requirePermission('invoices:read'),
  getInvoice
);

// PATCH /api/v1/billing/invoices/:id — تعديل الحالة أو تاريخ الاستحقاق
router.patch(
  '/invoices/:id',
  requirePermission('invoices:update'),
  updateInvoice
);

// ─── المدفوعات (payments) ────────────────────────────────────────────

// GET /api/v1/billing/invoices/:invoiceId/payments — سجل الدفعات
router.get(
  '/invoices/:invoiceId/payments',
  requirePermission('payments:read'),
  listPayments
);

// POST /api/v1/billing/invoices/:invoiceId/payments — تسجيل دفعة
router.post(
  '/invoices/:invoiceId/payments',
  requirePermission('payments:create'),
  createPayment
);

module.exports = router;
