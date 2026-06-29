'use strict';

// =====================================================================
//  medicalRecordController — CRUD للسجلات الطبية (medical_records)
//
//  سياسات RLS المفعّلة تلقائياً عبر withUserContext:
//    - SELECT: الطبيب المالك أو المريض صاحب السجل أو الممرض (عبر appointment)
//    - INSERT: الطبيب المالك فقط (doctor_id = app_current_doctor_id())
//    - UPDATE: الطبيب المالك أو الممرض (vital_signs/ملاحظات عامة)
//    - DELETE: لا أحد (سياسة RLS تمنع الحذف — سلامة طبية)
//
//  الأدوار الخارجية (middleware):
//    - GET /medical-records         : medical_records:read  (doctor, nurse, admin)
//    - POST /medical-records        : medical_records:create (doctor فقط)
//    - GET /medical-records/:id     : medical_records:read
//    - PATCH /medical-records/:id   : medical_records:update (doctor, nurse)
//    - GET /:id/diagnoses           : diagnoses:read
//    - POST /:id/diagnoses          : diagnoses:create (doctor فقط)
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/medical-records
//  قائمة السجلات مع فلتر patient_id/doctor_id/date-range وpagination
//  الأدوار: doctor, nurse, admin
// =====================================================================
const listMedicalRecords = asyncHandler(async (req, res) => {
  const page       = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit      = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset     = (page - 1) * limit;
  const patientId  = req.query.patient_id  || null;
  const doctorId   = req.query.doctor_id   || null;
  const dateFrom   = req.query.date_from   || null;
  const dateTo     = req.query.date_to     || null;

  // بناء شروط WHERE ديناميكياً
  const conditions = [];
  const params     = [];

  if (patientId) { params.push(patientId); conditions.push(`mr.patient_id = $${params.length}`); }
  if (doctorId)  { params.push(doctorId);  conditions.push(`mr.doctor_id  = $${params.length}`); }
  if (dateFrom)  { params.push(dateFrom);  conditions.push(`mr.visit_date >= $${params.length}`); }
  if (dateTo)    { params.push(dateTo);    conditions.push(`mr.visit_date <= $${params.length}`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // إجمالي الصفوف (لـ meta)
  const countResult = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT COUNT(*) FROM medical_records mr ${whereClause}`,
      params
    );
  });

  // الصفحة الفعلية — JOIN مع patients و doctors/staff للاسم
  params.push(limit, offset);
  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT mr.id,
              mr.patient_id,
              p.first_name  || ' ' || p.last_name  AS patient_name,
              p.medical_record_number,
              mr.doctor_id,
              s.first_name  || ' ' || s.last_name  AS doctor_name,
              mr.appointment_id,
              mr.visit_date,
              mr.chief_complaint,
              mr.vital_signs,
              mr.created_at
         FROM medical_records mr
         JOIN patients p ON p.id = mr.patient_id
         JOIN doctors  d ON d.id = mr.doctor_id
         JOIN staff    s ON s.id = d.staff_id
         ${whereClause}
        ORDER BY mr.visit_date DESC
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
//  GET /api/v1/medical-records/:id
//  سجل طبي مفرد مع ملاحظاته الكاملة
//  الأدوار: doctor, nurse, admin, patient(own)
// =====================================================================
const getMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT mr.id,
              mr.patient_id,
              p.first_name  || ' ' || p.last_name  AS patient_name,
              p.medical_record_number,
              mr.doctor_id,
              s.first_name  || ' ' || s.last_name  AS doctor_name,
              mr.appointment_id,
              mr.visit_date,
              mr.chief_complaint,
              mr.examination_notes,
              mr.vital_signs,
              mr.created_at
         FROM medical_records mr
         JOIN patients p ON p.id = mr.patient_id
         JOIN doctors  d ON d.id = mr.doctor_id
         JOIN staff    s ON s.id = d.staff_id
        WHERE mr.id = $1`,
      [id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('السجل الطبي غير موجود أو ليس لديك صلاحية الوصول إليه', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  POST /api/v1/medical-records
//  إنشاء سجل طبي جديد لزيارة
//  الأدوار: doctor فقط
// =====================================================================
const createMedicalRecord = asyncHandler(async (req, res) => {
  const {
    patient_id,
    appointment_id,
    chief_complaint,
    examination_notes,
    vital_signs,         // كائن JSON: { bp, pulse, temp, weight, height, ... }
    visit_date,
  } = req.body;

  // الحقول الإلزامية
  if (!patient_id) {
    throw new AppError('patient_id مطلوب', 400, 'VALIDATION_ERROR');
  }

  // التحقق من بنية vital_signs إن أُرسلت
  if (vital_signs !== undefined && (typeof vital_signs !== 'object' || Array.isArray(vital_signs))) {
    throw new AppError('vital_signs يجب أن يكون كائن JSON صالحاً', 400, 'VALIDATION_ERROR');
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // doctor_id مشتق من JWT عبر staff_id ← doctors.id
    // RLS تتحقق تلقائياً: INSERT WITH CHECK (doctor_id = app_current_doctor_id())
    return client.query(
      `INSERT INTO medical_records
         (patient_id, doctor_id, appointment_id, visit_date, chief_complaint,
          examination_notes, vital_signs)
       VALUES (
         $1,
         (SELECT d.id FROM doctors d
           JOIN staff s ON s.id = d.staff_id
           JOIN users  u ON u.staff_id = s.id
          WHERE u.id = $2),
         $3, $4, $5, $6, $7
       )
       RETURNING *`,
      [
        patient_id,
        req.user.id,
        appointment_id || null,
        visit_date     || 'NOW()',
        chief_complaint   || null,
        examination_notes || null,
        vital_signs ? JSON.stringify(vital_signs) : null,
      ]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError(
      'تعذّر إنشاء السجل الطبي — تأكد من صلاحياتك أو صحة patient_id',
      403,
      'OPERATION_FAILED'
    );
  }

  res.status(201).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/medical-records/:id
//  تعديل السجل الطبي (الملاحظات / vital_signs)
//  الأدوار: doctor(مالك السجل), nurse (vital_signs فقط — يُفرَّق بالأدوار في RLS)
// =====================================================================
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // الحقول المسموح بتعديلها (whitelist)
  const allowed = ['chief_complaint', 'examination_notes', 'vital_signs'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  if (updates.vital_signs !== undefined) {
    if (typeof updates.vital_signs !== 'object' || Array.isArray(updates.vital_signs)) {
      throw new AppError('vital_signs يجب أن يكون كائن JSON صالحاً', 400, 'VALIDATION_ERROR');
    }
    updates.vital_signs = JSON.stringify(updates.vital_signs);
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `UPDATE medical_records
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING id, patient_id, doctor_id, appointment_id,
                  visit_date, chief_complaint, examination_notes, vital_signs, created_at`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('السجل الطبي غير موجود أو ليس لديك صلاحية تعديله', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  GET /api/v1/medical-records/:id/diagnoses
//  قائمة تشخيصات سجل طبي محدد
//  الأدوار: doctor, nurse, admin, patient(own)
// =====================================================================
const listDiagnoses = asyncHandler(async (req, res) => {
  const { id: medicalRecordId } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT d.id, d.medical_record_id, d.icd10_code,
              d.description, d.diagnosis_type, d.diagnosed_at
         FROM diagnoses d
        WHERE d.medical_record_id = $1
        ORDER BY d.diagnosed_at ASC`,
      [medicalRecordId]
    );
  });

  res.status(200).json({
    success: true,
    data: result.rows,
    meta: { total: result.rows.length },
  });
});

// =====================================================================
//  POST /api/v1/medical-records/:id/diagnoses
//  إضافة تشخيص لسجل طبي
//  الأدوار: doctor (مالك السجل فقط — RLS تتحقق)
// =====================================================================
const addDiagnosis = asyncHandler(async (req, res) => {
  const { id: medicalRecordId } = req.params;
  const { icd10_code, description, diagnosis_type } = req.body;

  if (!description) {
    throw new AppError('description مطلوب', 400, 'VALIDATION_ERROR');
  }

  const validTypes = ['primary', 'secondary', 'provisional'];
  if (diagnosis_type && !validTypes.includes(diagnosis_type)) {
    throw new AppError(
      `diagnosis_type يجب أن يكون: ${validTypes.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // تحقق أن رمز ICD-10 بصيغة صحيحة إن أُرسل (حرف + 2-7 أرقام/أحرف)
  if (icd10_code && !/^[A-Z]\d{2}(\.\d{1,4})?$/.test(icd10_code.toUpperCase())) {
    throw new AppError('icd10_code غير صالح (مثال صحيح: A09 أو J06.9)', 400, 'VALIDATION_ERROR');
  }

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    // RLS تتحقق: INSERT WITH CHECK يتطلب medical_record.doctor_id = app_current_doctor_id()
    return client.query(
      `INSERT INTO diagnoses (medical_record_id, icd10_code, description, diagnosis_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        medicalRecordId,
        icd10_code ? icd10_code.toUpperCase() : null,
        description,
        diagnosis_type || 'primary',
      ]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError(
      'تعذّر إضافة التشخيص — تأكد أنك الطبيب المالك للسجل',
      403,
      'OPERATION_FAILED'
    );
  }

  res.status(201).json({ success: true, data: result.rows[0] });
});

module.exports = {
  listMedicalRecords,
  getMedicalRecord,
  createMedicalRecord,
  updateMedicalRecord,
  listDiagnoses,
  addDiagnosis,
};
