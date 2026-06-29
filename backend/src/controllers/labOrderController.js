'use strict';

// =====================================================================
//  labOrderController — طلبات الفحص المختبري (lab_orders)
//
//  RLS (02_rbac_rls.sql — lab_orders):
//    SELECT: ordered_by_doctor_id = الطبيب الحالي
//            OR patient_id = المريض الحالي
//            OR app_has_role('lab_technician')
//    INSERT WITH CHECK: ordered_by_doctor_id = الطبيب الحالي
//    UPDATE: lab_technician يحدّث النتيجة/الحالة؛
//            الطبيب الأصلي يُعدِّل فقط في نطاقه
//
//  الصلاحيات:
//    lab_orders:read   — lab_technician, doctor, admin, patient(own)
//    lab_orders:create — doctor
//    lab_orders:update — lab_technician
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/lab-orders
//  قائمة طلبات الفحص مع فلترة متعددة وpagination
//  الأدوار: lab_technician, doctor(own), admin
// =====================================================================
const listLabOrders = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset = (page - 1) * limit;

  const { status, patient_id, doctor_id } = req.query;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];

    if (status)     conditions.push(`lo.status = $${params.push(status)}`);
    if (patient_id) conditions.push(`lo.patient_id = $${params.push(patient_id)}`);
    if (doctor_id)  conditions.push(`lo.ordered_by_doctor_id = $${params.push(doctor_id)}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    // RLS تُصفّي الصفوف تلقائياً حسب دور المستخدم
    return client.query(
      `SELECT lo.id,
              lo.medical_record_id,
              lo.patient_id,
              lo.lab_test_id,
              lt.name            AS lab_test_name,
              lt.category        AS lab_test_category,
              lo.ordered_by_doctor_id,
              lo.performed_by_staff_id,
              lo.status,
              lo.result_value,
              lo.result_notes,
              lo.ordered_at,
              lo.resulted_at
         FROM lab_orders lo
         JOIN lab_tests lt ON lt.id = lo.lab_test_id
         ${where}
        ORDER BY lo.ordered_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  });

  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    const conditions = [];
    const params     = [];
    if (status)     conditions.push(`status = $${params.push(status)}`);
    if (patient_id) conditions.push(`patient_id = $${params.push(patient_id)}`);
    if (doctor_id)  conditions.push(`ordered_by_doctor_id = $${params.push(doctor_id)}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return client.query(`SELECT COUNT(*) FROM lab_orders ${where}`, params);
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
});

// =====================================================================
//  GET /api/v1/lab-orders/:id
//  تفاصيل طلب فحص محدد
//  الأدوار: lab_technician, doctor(own), admin, patient(own)
// =====================================================================
const getLabOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT lo.id,
              lo.medical_record_id,
              lo.patient_id,
              p.first_name || ' ' || p.last_name AS patient_name,
              lo.lab_test_id,
              lt.name            AS lab_test_name,
              lt.category        AS lab_test_category,
              lt.reference_range,
              lt.unit,
              lo.ordered_by_doctor_id,
              lo.performed_by_staff_id,
              lo.status,
              lo.result_value,
              lo.result_notes,
              lo.ordered_at,
              lo.resulted_at
         FROM lab_orders lo
         JOIN lab_tests  lt ON lt.id = lo.lab_test_id
         JOIN patients   p  ON p.id  = lo.patient_id
        WHERE lo.id = $1`,
      [id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('طلب الفحص غير موجود أو ليس لديك صلاحية الوصول إليه', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/lab-orders
//  طلب فحص مختبري — يُنشئه الطبيب مرتبطاً بسجل طبي
//  الأدوار: doctor فقط
// =====================================================================
const createLabOrder = asyncHandler(async (req, res) => {
  const {
    medical_record_id,
    patient_id,
    lab_test_id,
    ordered_by_doctor_id,
  } = req.body;

  // التحقق من الحقول الإلزامية
  if (!medical_record_id || !patient_id || !lab_test_id || !ordered_by_doctor_id) {
    throw new AppError(
      'medical_record_id و patient_id و lab_test_id و ordered_by_doctor_id مطلوبة',
      400,
      'VALIDATION_ERROR'
    );
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // التحقق من وجود السجل الطبي والمريض بشكل صامت (RLS تُصفّي إذا لم يكن مُخوَّلاً)
    const recordCheck = await client.query(
      'SELECT id FROM medical_records WHERE id = $1 AND patient_id = $2',
      [medical_record_id, patient_id]
    );
    if (recordCheck.rows.length === 0) {
      throw new AppError(
        'السجل الطبي غير موجود أو لا يتطابق مع المريض المحدد',
        404,
        'RESOURCE_NOT_FOUND'
      );
    }

    // RLS تتحقق أن ordered_by_doctor_id يطابق الطبيب الحالي
    return client.query(
      `INSERT INTO lab_orders
         (medical_record_id, patient_id, lab_test_id, ordered_by_doctor_id, status)
       VALUES ($1, $2, $3, $4, 'ordered')
       RETURNING *`,
      [medical_record_id, patient_id, lab_test_id, ordered_by_doctor_id]
    );
  });

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/lab-orders/:id/result
//  إدخال نتيجة الفحص وتغيير الحالة — لفنّي المختبر فقط
//  الأدوار: lab_technician
// =====================================================================
const updateLabOrderResult = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowed = ['status', 'result_value', 'result_notes', 'performed_by_staff_id'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  // التحقق من قيمة status
  const validStatuses = ['ordered', 'in_progress', 'completed', 'cancelled'];
  if (updates.status && !validStatuses.includes(updates.status)) {
    throw new AppError(
      `قيمة status غير صالحة — المقبول: ${validStatuses.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // إذا اكتمل الفحص نُضيف resulted_at تلقائياً
  if (updates.status === 'completed') {
    updates.resulted_at = new Date().toISOString();
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS تتحقق أن المستخدم lab_technician أو الطبيب الأصلي
    return client.query(
      `UPDATE lab_orders
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError(
      'طلب الفحص غير موجود أو ليس لديك صلاحية تعديله',
      404,
      'RESOURCE_NOT_FOUND'
    );
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { listLabOrders, getLabOrder, createLabOrder, updateLabOrderResult };
