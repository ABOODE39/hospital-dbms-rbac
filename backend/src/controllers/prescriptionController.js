'use strict';

// =====================================================================
//  prescriptionController — الوصفات الطبية (prescriptions + prescription_items)
//
//  سياسات RLS المفعّلة تلقائياً عبر withUserContext:
//    - SELECT: الطبيب المالك | المريض صاحب الوصفة | الصيدلي (pharmacist)
//    - INSERT: الطبيب المالك فقط (doctor_id = app_current_doctor_id())
//    - UPDATE حالة الوصفة:
//        الطبيب ← أي تعديل على وصفاته
//        الصيدلي ← تحديث status إلى 'dispensed' فقط (لوصفات active)
//    - DELETE: لا أحد (الحذف عبر CASCADE من medical_record فقط)
//
//  prescription_items:
//    - SELECT: نفس سياسة prescriptions (ترث عبر JOIN)
//    - INSERT: طبيب الوصفة فقط (ضمن عملية إنشاء الوصفة)
//    - UPDATE: طبيب الوصفة (تعديل جرعة أو كمية قبل الصرف)
//    - DELETE: طبيب الوصفة (حذف بند — نادر لكن مسموح قبل الصرف)
//
//  الأدوار الخارجية (middleware):
//    - GET /prescriptions              : prescriptions:read (doctor, pharmacist, admin)
//    - POST /prescriptions             : prescriptions:create (doctor)
//    - GET /prescriptions/:id          : prescriptions:read
//    - PATCH /prescriptions/:id/status : prescriptions:update (pharmacist, doctor)
//    - PATCH /prescriptions/:id/items/:itemId : prescriptions:update (doctor)
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/prescriptions
//  قائمة الوصفات مع فلتر status/patient_id/doctor_id وpagination
//  الأدوار: doctor(own), pharmacist, admin
// =====================================================================
const listPrescriptions = asyncHandler(async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit    = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset   = (page - 1) * limit;
  const status   = req.query.status    || null;
  const patientId = req.query.patient_id || null;
  const doctorId  = req.query.doctor_id  || null;

  const conditions = [];
  const params     = [];

  if (status)    { params.push(status);    conditions.push(`pr.status     = $${params.length}`); }
  if (patientId) { params.push(patientId); conditions.push(`pr.patient_id = $${params.length}`); }
  if (doctorId)  { params.push(doctorId);  conditions.push(`pr.doctor_id  = $${params.length}`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(`SELECT COUNT(*) FROM prescriptions pr ${whereClause}`, params);
  });

  params.push(limit, offset);
  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT pr.id,
              pr.medical_record_id,
              pr.patient_id,
              p.first_name  || ' ' || p.last_name AS patient_name,
              pr.doctor_id,
              s.first_name  || ' ' || s.last_name AS doctor_name,
              pr.issued_at,
              pr.status,
              pr.notes,
              COUNT(pi.id) AS items_count
         FROM prescriptions pr
         JOIN patients p ON p.id = pr.patient_id
         JOIN doctors  d ON d.id = pr.doctor_id
         JOIN staff    s ON s.id = d.staff_id
    LEFT JOIN prescription_items pi ON pi.prescription_id = pr.id
         ${whereClause}
      GROUP BY pr.id, p.first_name, p.last_name, s.first_name, s.last_name
      ORDER BY pr.issued_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
});

// =====================================================================
//  GET /api/v1/prescriptions/:id
//  تفاصيل وصفة مع بنودها وأسماء الأدوية
//  الأدوار: doctor(own), pharmacist, admin, patient(own)
// =====================================================================
const getPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT pr.id,
              pr.medical_record_id,
              pr.patient_id,
              p.first_name  || ' ' || p.last_name AS patient_name,
              p.medical_record_number,
              pr.doctor_id,
              s.first_name  || ' ' || s.last_name AS doctor_name,
              pr.issued_at,
              pr.status,
              pr.notes
         FROM prescriptions pr
         JOIN patients p ON p.id = pr.patient_id
         JOIN doctors  d ON d.id = pr.doctor_id
         JOIN staff    s ON s.id = d.staff_id
        WHERE pr.id = $1`,
      [id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('الوصفة غير موجودة أو ليس لديك صلاحية الوصول إليها', 404, 'RESOURCE_NOT_FOUND');
  }

  // جلب البنود في استعلام منفصل (أوضح من JSON_AGG للصيانة)
  const itemsResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT pi.id,
              pi.prescription_id,
              pi.medication_id,
              m.name         AS medication_name,
              m.generic_name,
              m.form,
              m.strength,
              pi.dosage,
              pi.frequency,
              pi.duration_days,
              pi.quantity,
              pi.instructions
         FROM prescription_items pi
         JOIN medications m ON m.id = pi.medication_id
        WHERE pi.prescription_id = $1
        ORDER BY pi.id`,
      [id]
    );
  });

  res.status(200).json({
    success: true,
    data: { ...result.rows[0], items: itemsResult.rows },
  });
});

// =====================================================================
//  POST /api/v1/prescriptions
//  إنشاء وصفة جديدة مرتبطة بسجل طبي + بنود prescription_items
//  الأدوار: doctor فقط
//
//  Body المتوقع:
//  {
//    "medical_record_id": 5,
//    "patient_id": 12,
//    "notes": "...",
//    "items": [
//      { "medication_id": 3, "dosage": "1 tablet", "frequency": "twice daily",
//        "duration_days": 7, "quantity": 14, "instructions": "بعد الأكل" }
//    ]
//  }
// =====================================================================
const createPrescription = asyncHandler(async (req, res) => {
  const { medical_record_id, patient_id, notes, items } = req.body;

  if (!medical_record_id || !patient_id) {
    throw new AppError('medical_record_id و patient_id مطلوبان', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items مطلوب ويجب أن يحتوي على بند واحد على الأقل', 400, 'VALIDATION_ERROR');
  }

  // التحقق من كل بند
  for (const [i, item] of items.entries()) {
    if (!item.medication_id || !item.dosage || !item.frequency) {
      throw new AppError(
        `البند [${i}]: medication_id و dosage و frequency مطلوبة`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  // كل العمليات داخل معاملة واحدة عبر withUserContext
  const prescription = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // إنشاء رأس الوصفة — RLS تتحقق أن الطبيب مالك السجل الطبي
    const prResult = await client.query(
      `INSERT INTO prescriptions
         (medical_record_id, patient_id, doctor_id, notes)
       VALUES (
         $1, $2,
         (SELECT d.id FROM doctors d
           JOIN staff s ON s.id = d.staff_id
           JOIN users  u ON u.staff_id = s.id
          WHERE u.id = $3),
         $4
       )
       RETURNING *`,
      [medical_record_id, patient_id, req.user.id, notes || null]
    );

    if (prResult.rows.length === 0) {
      throw new AppError(
        'تعذّر إنشاء الوصفة — تأكد من صلاحياتك وصحة medical_record_id',
        403,
        'OPERATION_FAILED'
      );
    }

    const prescriptionId = prResult.rows[0].id;

    // إدراج البنود
    const insertedItems = [];
    for (const item of items) {
      const itemResult = await client.query(
        `INSERT INTO prescription_items
           (prescription_id, medication_id, dosage, frequency, duration_days, quantity, instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          prescriptionId,
          item.medication_id,
          item.dosage,
          item.frequency,
          item.duration_days || null,
          item.quantity      || null,
          item.instructions  || null,
        ]
      );
      insertedItems.push(itemResult.rows[0]);
    }

    return { ...prResult.rows[0], items: insertedItems };
  });

  res.status(201).json({ success: true, data: prescription });
});

// =====================================================================
//  PATCH /api/v1/prescriptions/:id/status
//  تغيير حالة الوصفة
//
//  الصيدلي: active → dispensed (يُنقص stock_quantity تلقائياً)
//  الطبيب : active → cancelled
//  الأدوار: pharmacist (dispensed), doctor (cancelled)
// =====================================================================
const updatePrescriptionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['dispensed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    throw new AppError(
      `status يجب أن يكون: ${validStatuses.join(' أو ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // التحقق من الحالة الحالية أولاً
    const current = await client.query(
      `SELECT id, status FROM prescriptions WHERE id = $1`,
      [id]
    );

    if (current.rows.length === 0) {
      throw new AppError('الوصفة غير موجودة أو ليس لديك صلاحية الوصول إليها', 404, 'RESOURCE_NOT_FOUND');
    }

    if (current.rows[0].status !== 'active') {
      throw new AppError(
        `لا يمكن تعديل وصفة بحالة "${current.rows[0].status}" — يُقبل التعديل على الوصفات الفعّالة فقط`,
        409,
        'INVALID_STATE_TRANSITION'
      );
    }

    // تحديث الحالة — RLS تتحقق من الدور
    const updated = await client.query(
      `UPDATE prescriptions
          SET status = $2
        WHERE id = $1
        RETURNING *`,
      [id, status]
    );

    // عند الصرف: خصم المخزون لكل بند
    if (status === 'dispensed') {
      await client.query(
        `UPDATE medications m
            SET stock_quantity = stock_quantity - pi.quantity
           FROM prescription_items pi
          WHERE pi.prescription_id = $1
            AND pi.medication_id   = m.id
            AND pi.quantity IS NOT NULL`,
        [id]
      );
    }

    return updated;
  });

  if (result.rows.length === 0) {
    throw new AppError('تعذّر تحديث حالة الوصفة', 403, 'OPERATION_FAILED');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/prescriptions/:id/items/:itemId
//  تعديل بند في وصفة (جرعة/كمية/تعليمات) قبل صرفها
//  الأدوار: doctor (مالك الوصفة فقط — RLS تتحقق)
// =====================================================================
const updatePrescriptionItem = asyncHandler(async (req, res) => {
  const { id: prescriptionId, itemId } = req.params;

  const allowed = ['dosage', 'frequency', 'duration_days', 'quantity', 'instructions'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // التحقق أن الوصفة لا تزال active قبل التعديل
    const prCheck = await client.query(
      `SELECT status FROM prescriptions WHERE id = $1`,
      [prescriptionId]
    );

    if (prCheck.rows.length === 0) {
      throw new AppError('الوصفة غير موجودة أو ليس لديك صلاحية الوصول إليها', 404, 'RESOURCE_NOT_FOUND');
    }

    if (prCheck.rows[0].status !== 'active') {
      throw new AppError('لا يمكن تعديل بنود وصفة مصروفة أو ملغاة', 409, 'INVALID_STATE_TRANSITION');
    }

    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 3}`);
    const values     = [itemId, prescriptionId, ...Object.values(updates)];

    return client.query(
      `UPDATE prescription_items
          SET ${setClauses.join(', ')}
        WHERE id = $1 AND prescription_id = $2
        RETURNING *`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('البند غير موجود أو ليس لديك صلاحية تعديله', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = {
  listPrescriptions,
  getPrescription,
  createPrescription,
  updatePrescriptionStatus,
  updatePrescriptionItem,
};
