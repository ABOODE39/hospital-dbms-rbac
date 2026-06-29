'use strict';

// =====================================================================
//  appointmentController — إدارة المواعيد (appointments)
//
//  صلاحيات الوصول حسب permission_matrix:
//    - list:   receptionist, admin, doctor(مواعيده فقط عبر RLS), nurse
//    - get:    receptionist, admin, doctor(own), nurse, patient(own)
//    - create: receptionist, admin, patient(own)
//    - update: receptionist, admin, doctor(own) — تغيير الحالة / السبب
//
//  RLS (02_rbac_rls.sql) تُصفِّر الصفوف تلقائياً خارج نطاق المستخدم:
//    SELECT  → admin/receptionist يريان الكل؛ doctor يرى مواعيده؛
//              patient يرى مواعيده؛ nurse يرى مواعيد قسمه
//    INSERT  → receptionist/admin أو patient لنفسه
//    UPDATE  → receptionist/admin أو doctor لمواعيده أو patient لإلغاء فقط
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/appointments
//  قائمة المواعيد مع فلترة doctor_id / patient_id / status / date-range
//  الأدوار: receptionist, admin, doctor(own), nurse
// =====================================================================
const listAppointments = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset = (page - 1) * limit;

  // فلاتر اختيارية من query string
  const { doctor_id, patient_id, status, date_from, date_to } = req.query;

  // بناء شروط WHERE ديناميكياً
  const conditions = [];
  const params     = [];

  if (doctor_id) {
    params.push(parseInt(doctor_id, 10));
    conditions.push(`a.doctor_id = $${params.length}`);
  }
  if (patient_id) {
    params.push(parseInt(patient_id, 10));
    conditions.push(`a.patient_id = $${params.length}`);
  }
  if (status) {
    const validStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        `status يجب أن يكون أحد القيم: ${validStatuses.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (date_from) {
    params.push(date_from);
    conditions.push(`a.scheduled_at >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    conditions.push(`a.scheduled_at <= $${params.length}`);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // إضافة LIMIT/OFFSET بعد شروط الفلترة
  params.push(limit);
  params.push(offset);

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS تُطبَّق تلقائياً — الطبيب لا يرى إلا مواعيده
    return client.query(
      `SELECT
          a.id,
          a.patient_id,
          CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
          p.medical_record_number,
          a.doctor_id,
          CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
          d.specialty,
          a.department_id,
          dep.name AS department_name,
          a.scheduled_at,
          a.duration_minutes,
          a.status,
          a.reason,
          a.created_at
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d  ON d.id = a.doctor_id
       JOIN staff  s   ON s.id = d.staff_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       ${whereClause}
       ORDER BY a.scheduled_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  });

  // عدد الإجمالي للـ meta (نفس الفلاتر بلا LIMIT/OFFSET)
  const countParams = params.slice(0, params.length - 2);
  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT COUNT(*) FROM appointments a ${whereClause}`,
      countParams
    );
  });

  const total = parseInt(countResult.rows[0].count, 10);

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

// =====================================================================
//  GET /api/v1/appointments/:id
//  تفاصيل موعد محدد — RLS تمنع الوصول خارج نطاق المستخدم
//  الأدوار: receptionist, admin, doctor(own), nurse, patient(own)
// =====================================================================
const getAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT
          a.id,
          a.patient_id,
          CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
          p.medical_record_number,
          p.phone AS patient_phone,
          a.doctor_id,
          CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
          d.specialty,
          d.consultation_fee,
          a.department_id,
          dep.name AS department_name,
          dep.location AS department_location,
          a.scheduled_at,
          a.duration_minutes,
          a.status,
          a.reason,
          a.created_by,
          a.created_at
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d  ON d.id = a.doctor_id
       JOIN staff  s   ON s.id = d.staff_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       WHERE a.id = $1`,
      [id]
    );
  });

  // صفر صفوف: الموعد غير موجود أو RLS منعت الوصول (نُعطي 404 للاثنين أماناً)
  if (result.rows.length === 0) {
    throw new AppError(
      'الموعد غير موجود أو ليس لديك صلاحية الوصول إليه',
      404,
      'RESOURCE_NOT_FOUND'
    );
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/appointments
//  حجز موعد جديد — يتحقق من تعارض جدول الطبيب (UNIQUE doctor+time)
//  الأدوار: receptionist, admin, patient(own)
// =====================================================================
const createAppointment = asyncHandler(async (req, res) => {
  const {
    patient_id,
    doctor_id,
    department_id,
    scheduled_at,
    duration_minutes,
    reason,
  } = req.body;

  // التحقق من الحقول الإلزامية
  if (!patient_id || !doctor_id || !scheduled_at) {
    throw new AppError(
      'patient_id و doctor_id و scheduled_at مطلوبة',
      400,
      'VALIDATION_ERROR'
    );
  }

  // scheduled_at يجب أن يكون في المستقبل
  if (new Date(scheduled_at) <= new Date()) {
    throw new AppError(
      'scheduled_at يجب أن يكون في المستقبل',
      400,
      'VALIDATION_ERROR'
    );
  }

  let result;
  try {
    result = await withUserContext(req.user.id, req.user.roles, async (client) => {
      // RLS WITH CHECK ستتحقق تلقائياً من صلاحية الإدراج
      return client.query(
        `INSERT INTO appointments
           (patient_id, doctor_id, department_id, scheduled_at,
            duration_minutes, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          parseInt(patient_id, 10),
          parseInt(doctor_id, 10),
          department_id ? parseInt(department_id, 10) : null,
          scheduled_at,
          duration_minutes ? parseInt(duration_minutes, 10) : 30,
          reason || null,
          req.user.id,
        ]
      );
    });
  } catch (err) {
    // UNIQUE violation على (doctor_id, scheduled_at) — تعارض في جدول الطبيب
    if (err.code === '23505') {
      throw new AppError(
        'الطبيب محجوز في هذا الموعد، يرجى اختيار وقت آخر',
        409,
        'APPOINTMENT_CONFLICT'
      );
    }
    throw err;
  }

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/appointments/:id
//  تعديل الموعد: الحالة (status) أو سبب الزيارة (reason) أو إعادة الجدولة
//  الأدوار: receptionist, admin, doctor(own) — patient يُلغي فقط (عبر RLS)
// =====================================================================
const updateAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // الحقول المسموح بتعديلها (whitelist)
  const allowed = ['status', 'reason', 'scheduled_at', 'duration_minutes', 'department_id'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  // التحقق من قيمة status إن أُرسلت
  if (updates.status) {
    const validStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(updates.status)) {
      throw new AppError(
        `status يجب أن يكون أحد القيم: ${validStatuses.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  // التحقق من scheduled_at في المستقبل إن أُرسلت
  if (updates.scheduled_at && new Date(updates.scheduled_at) <= new Date()) {
    throw new AppError(
      'scheduled_at الجديد يجب أن يكون في المستقبل',
      400,
      'VALIDATION_ERROR'
    );
  }

  // بناء SET ديناميكي
  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS UPDATE USING/WITH CHECK تتحقق تلقائياً
    return client.query(
      `UPDATE appointments
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING id, patient_id, doctor_id, department_id,
                  scheduled_at, duration_minutes, status, reason`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError(
      'الموعد غير موجود أو ليس لديك صلاحية تعديله',
      404,
      'RESOURCE_NOT_FOUND'
    );
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { listAppointments, getAppointment, createAppointment, updateAppointment };
