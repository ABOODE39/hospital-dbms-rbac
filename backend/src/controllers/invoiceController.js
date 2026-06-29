'use strict';

// =====================================================================
//  invoiceController — الفواتير وبنودها (invoices + invoice_items)
//
//  RLS (02_rbac_rls.sql — invoices):
//    SELECT: admin OR receptionist OR patient_id = المريض الحالي
//    INSERT/UPDATE WITH CHECK: app_has_role('receptionist')
//    DELETE: لا سياسة (الإلغاء عبر status فقط)
//
//  RLS (02_rbac_rls.sql — القسم ج-11 — invoice_items):
//    SELECT:       admin OR receptionist OR EXISTS(invoices WHERE patient_id = app_current_patient_id())
//    INSERT:       admin OR receptionist
//    UPDATE USING: admin OR receptionist
//
//  الصلاحيات:
//    invoices:read   — receptionist, admin, patient(own)
//    invoices:create — receptionist, admin
//    invoices:update — receptionist, admin
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// ---- توليد رقم فاتورة فريد ----
function generateInvoiceNumber() {
  // صيغة: INV-YYYYMMDD-XXXXX
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `INV-${date}-${suffix}`;
}

// =====================================================================
//  GET /api/v1/billing/invoices
//  قائمة الفواتير مع فلتر status/patient_id وpagination
//  الأدوار: receptionist, admin, patient(own عبر RLS)
// =====================================================================
const listInvoices = asyncHandler(async (req, res) => {
  const page      = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit     = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset    = (page - 1) * limit;
  const { status, patient_id } = req.query;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];

    if (status)     conditions.push(`i.status = $${params.push(status)}`);
    if (patient_id) conditions.push(`i.patient_id = $${params.push(patient_id)}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    return client.query(
      `SELECT i.id,
              i.invoice_number,
              i.patient_id,
              p.first_name || ' ' || p.last_name AS patient_name,
              i.appointment_id,
              i.total_amount,
              i.status,
              i.issued_at,
              i.due_date,
              i.created_by,
              COALESCE(SUM(pay.amount), 0)       AS total_paid
         FROM invoices i
         JOIN patients p ON p.id = i.patient_id
    LEFT JOIN payments pay ON pay.invoice_id = i.id
         ${where}
        GROUP BY i.id, p.first_name, p.last_name
        ORDER BY i.issued_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  });

  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];
    if (status)     conditions.push(`status = $${params.push(status)}`);
    if (patient_id) conditions.push(`patient_id = $${params.push(patient_id)}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return client.query(`SELECT COUNT(*) FROM invoices ${where}`, params);
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
});

// =====================================================================
//  GET /api/v1/billing/invoices/:id
//  تفاصيل فاتورة مع البنود والمدفوعات والإجمالي
//  الأدوار: receptionist, admin, patient(own)
// =====================================================================
const getInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // رأس الفاتورة
  const invoiceResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT i.id,
              i.invoice_number,
              i.patient_id,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.phone AS patient_phone,
              i.appointment_id,
              i.total_amount,
              i.status,
              i.issued_at,
              i.due_date,
              i.created_by
         FROM invoices i
         JOIN patients p ON p.id = i.patient_id
        WHERE i.id = $1`,
      [id]
    );
  });

  if (invoiceResult.rows.length === 0) {
    throw new AppError('الفاتورة غير موجودة أو ليس لديك صلاحية الوصول إليها', 404, 'RESOURCE_NOT_FOUND');
  }

  // بنود الفاتورة — RLS invoice_items ترث صلاحية invoices
  const itemsResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT id, item_type, description, quantity, unit_price, line_total, reference_id
         FROM invoice_items
        WHERE invoice_id = $1
        ORDER BY id ASC`,
      [id]
    );
  });

  // المدفوعات
  const paymentsResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT id, amount, method, paid_at, received_by, reference_no
         FROM payments
        WHERE invoice_id = $1
        ORDER BY paid_at ASC`,
      [id]
    );
  });

  res.status(200).json({
    success: true,
    data: {
      ...invoiceResult.rows[0],
      items:    itemsResult.rows,
      payments: paymentsResult.rows,
    },
  });
});

// =====================================================================
//  POST /api/v1/billing/invoices
//  إنشاء فاتورة جديدة مع بنود invoice_items في معاملة واحدة
//  الأدوار: receptionist, admin
// =====================================================================
const createInvoice = asyncHandler(async (req, res) => {
  const { patient_id, appointment_id, due_date, items } = req.body;

  if (!patient_id) {
    throw new AppError('patient_id مطلوب', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('يجب توفير بند واحد على الأقل في items', 400, 'VALIDATION_ERROR');
  }

  // التحقق من صحة كل بند
  const validItemTypes = ['consultation', 'medication', 'lab_test', 'procedure', 'other'];
  for (const item of items) {
    if (!item.item_type || !validItemTypes.includes(item.item_type)) {
      throw new AppError(
        `item_type يجب أن يكون: ${validItemTypes.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    if (!item.description) {
      throw new AppError('description مطلوب لكل بند', 400, 'VALIDATION_ERROR');
    }
    if (item.unit_price === undefined || Number(item.unit_price) < 0) {
      throw new AppError('unit_price يجب أن يكون رقماً موجباً أو صفراً', 400, 'VALIDATION_ERROR');
    }
  }

  // حساب الإجمالي من البنود
  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.unit_price) * (item.quantity || 1)),
    0
  );

  // توليد رقم فاتورة فريد
  let invoiceNumber;
  let attempts = 0;
  while (attempts < 5) {
    invoiceNumber = generateInvoiceNumber();
    const check = await withUserContext(req.user.id, req.user.roles, async (client) => {
      return client.query(
        'SELECT id FROM invoices WHERE invoice_number = $1',
        [invoiceNumber]
      );
    });
    if (check.rows.length === 0) break;
    attempts++;
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // إنشاء رأس الفاتورة
    const invoiceRes = await client.query(
      `INSERT INTO invoices
         (invoice_number, patient_id, appointment_id, total_amount, status, due_date, created_by)
       VALUES ($1, $2, $3, $4, 'unpaid', $5, $6)
       RETURNING *`,
      [
        invoiceNumber,
        patient_id,
        appointment_id || null,
        totalAmount,
        due_date        || null,
        req.user.id,
      ]
    );

    const invoice = invoiceRes.rows[0];

    // إدراج البنود — line_total عمود محسوب (GENERATED) لا نُرسله
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, item_type, description, quantity, unit_price, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          invoice.id,
          item.item_type,
          item.description,
          item.quantity    || 1,
          Number(item.unit_price),
          item.reference_id || null,
        ]
      );
    }

    // إعادة الفاتورة مع بنودها
    const itemsRes = await client.query(
      `SELECT id, item_type, description, quantity, unit_price, line_total, reference_id
         FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC`,
      [invoice.id]
    );

    return { invoice, items: itemsRes.rows };
  });

  res.status(201).json({
    success: true,
    data: { ...result.invoice, items: result.items },
  });
});

// =====================================================================
//  PATCH /api/v1/billing/invoices/:id
//  تعديل حالة الفاتورة أو تاريخ الاستحقاق (الإلغاء عبر status)
//  الأدوار: receptionist, admin
// =====================================================================
const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowed = ['status', 'due_date'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  const validStatuses = ['unpaid', 'partially_paid', 'paid', 'cancelled'];
  if (updates.status && !validStatuses.includes(updates.status)) {
    throw new AppError(
      `قيمة status غير صالحة — المقبول: ${validStatuses.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `UPDATE invoices
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError(
      'الفاتورة غير موجودة أو ليس لديك صلاحية تعديلها',
      404,
      'RESOURCE_NOT_FOUND'
    );
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice };
