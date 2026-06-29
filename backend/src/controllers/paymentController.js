'use strict';

// =====================================================================
//  paymentController — مدفوعات الفواتير (payments)
//
//  RLS (02_rbac_rls.sql — القسم ج-10 — payments):
//    SELECT:  admin OR receptionist
//             OR EXISTS(invoices i WHERE i.id = payments.invoice_id
//                       AND i.patient_id = app_current_patient_id())
//    INSERT WITH CHECK: admin OR receptionist
//    UPDATE/DELETE: لا سياسة → مرفوض للجميع (append-only للنزاهة المالية)
//
//  الصلاحيات:
//    payments:read   — receptionist, admin, patient(own)
//    payments:create — receptionist, admin
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  POST /api/v1/billing/invoices/:invoiceId/payments
//  تسجيل دفعة جديدة لفاتورة محددة
//  الأدوار: receptionist, admin
// =====================================================================
const createPayment = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { amount, method, reference_no } = req.body;

  // التحقق من الحقول الإلزامية
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    throw new AppError('amount يجب أن يكون رقماً موجباً أكبر من صفر', 400, 'VALIDATION_ERROR');
  }

  const validMethods = ['cash', 'card', 'transfer', 'insurance'];
  if (!method || !validMethods.includes(method)) {
    throw new AppError(
      `method مطلوب ويجب أن يكون: ${validMethods.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // التحقق من وجود الفاتورة وحالتها (RLS تتحقق من الصلاحية)
    const invoiceCheck = await client.query(
      `SELECT id, total_amount, status FROM invoices WHERE id = $1`,
      [invoiceId]
    );

    if (invoiceCheck.rows.length === 0) {
      throw new AppError('الفاتورة غير موجودة', 404, 'RESOURCE_NOT_FOUND');
    }

    const invoice = invoiceCheck.rows[0];

    if (invoice.status === 'cancelled') {
      throw new AppError('لا يمكن إضافة دفعة لفاتورة ملغاة', 400, 'BUSINESS_RULE_VIOLATION');
    }

    if (invoice.status === 'paid') {
      throw new AppError('الفاتورة مسدّدة بالكامل بالفعل', 400, 'BUSINESS_RULE_VIOLATION');
    }

    // إدراج الدفعة
    const paymentRes = await client.query(
      `INSERT INTO payments (invoice_id, amount, method, received_by, reference_no)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        invoiceId,
        Number(amount),
        method,
        req.user.id,
        reference_no || null,
      ]
    );

    const payment = paymentRes.rows[0];

    // حساب إجمالي المدفوعات لتحديث حالة الفاتورة تلقائياً
    const paidResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1`,
      [invoiceId]
    );

    const totalPaid = parseFloat(paidResult.rows[0].total_paid);
    const totalAmount = parseFloat(invoice.total_amount);

    // تحديث حالة الفاتورة بناءً على المبلغ المدفوع
    let newStatus = 'partially_paid';
    if (totalPaid >= totalAmount) {
      newStatus = 'paid';
    }

    await client.query(
      `UPDATE invoices SET status = $1 WHERE id = $2`,
      [newStatus, invoiceId]
    );

    return { payment, invoice_status: newStatus, total_paid: totalPaid };
  });

  res.status(201).json({
    success: true,
    data: {
      payment:        result.payment,
      invoice_status: result.invoice_status,
      total_paid:     result.total_paid,
    },
  });
});

// =====================================================================
//  GET /api/v1/billing/invoices/:invoiceId/payments
//  سجل الدفعات لفاتورة محددة
//  الأدوار: receptionist, admin, patient(own عبر RLS)
// =====================================================================
const listPayments = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS تتحقق من صلاحية الوصول للفاتورة أولاً
    const invoiceCheck = await client.query(
      `SELECT id, invoice_number, patient_id, total_amount, status
         FROM invoices WHERE id = $1`,
      [invoiceId]
    );

    if (invoiceCheck.rows.length === 0) {
      throw new AppError('الفاتورة غير موجودة أو ليس لديك صلاحية الوصول إليها', 404, 'RESOURCE_NOT_FOUND');
    }

    const payments = await client.query(
      `SELECT p.id, p.amount, p.method, p.paid_at, p.received_by, p.reference_no
         FROM payments p
        WHERE p.invoice_id = $1
        ORDER BY p.paid_at ASC`,
      [invoiceId]
    );

    const sumResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1`,
      [invoiceId]
    );

    return {
      invoice:    invoiceCheck.rows[0],
      payments:   payments.rows,
      total_paid: parseFloat(sumResult.rows[0].total_paid),
    };
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = { createPayment, listPayments };
