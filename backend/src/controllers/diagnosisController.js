'use strict';

// =====================================================================
//  diagnosisController — CRUD مستقل للتشخيصات (diagnoses)
//
//  ملاحظة التصميم:
//    التشخيصات يُصل إليها بطريقتين:
//      (أ) عبر مسار السجل الطبي: POST /medical-records/:id/diagnoses
//          ← هذا يُعالَج داخل medicalRecordController.addDiagnosis
//      (ب) عبر مسار مستقل: GET/PATCH /diagnoses/:id
//          ← هذا الملف
//
//  سياسات RLS:
//    - SELECT: طبيب السجل الأب أو المريض صاحب السجل
//    - INSERT: طبيب السجل الأب فقط (يُعالَج في medicalRecordController)
//    - UPDATE: طبيب السجل الأب (تصحيح كود/وصف بعد الإنشاء)
//    - DELETE: لا سياسة — محظور بعد التثبيت
// =====================================================================

const { withUserContext } = require('../config/db');
const asyncHandler        = require('../utils/asyncHandler');
const AppError            = require('../utils/AppError');

// =====================================================================
//  GET /api/v1/diagnoses/:id
//  تفاصيل تشخيص واحد
//  الأدوار: doctor, nurse, admin, patient(own)
// =====================================================================
const getDiagnosis = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `SELECT d.id, d.medical_record_id, d.icd10_code,
              d.description, d.diagnosis_type, d.diagnosed_at,
              mr.patient_id, mr.doctor_id, mr.visit_date
         FROM diagnoses d
         JOIN medical_records mr ON mr.id = d.medical_record_id
        WHERE d.id = $1`,
      [id]
    );
  });

  if (result.rows.length === 0) {
    throw new AppError('التشخيص غير موجود أو ليس لديك صلاحية الوصول إليه', 404, 'RESOURCE_NOT_FOUND');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

// =====================================================================
//  PATCH /api/v1/diagnoses/:id
//  تعديل تشخيص (تصحيح الكود أو الوصف أو النوع)
//  الأدوار: doctor (مالك السجل الأب فقط — تُفرَّض بـ RLS)
// =====================================================================
const updateDiagnosis = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowed = ['icd10_code', 'description', 'diagnosis_type'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('لم تُرسَل أي حقول للتعديل', 400, 'VALIDATION_ERROR');
  }

  // التحقق من قيمة diagnosis_type
  const validTypes = ['primary', 'secondary', 'provisional'];
  if (updates.diagnosis_type && !validTypes.includes(updates.diagnosis_type)) {
    throw new AppError(
      `diagnosis_type يجب أن يكون: ${validTypes.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // التحقق من صيغة icd10_code
  if (updates.icd10_code) {
    updates.icd10_code = updates.icd10_code.toUpperCase();
    if (!/^[A-Z]\d{2}(\.\d{1,4})?$/.test(updates.icd10_code)) {
      throw new AppError('icd10_code غير صالح (مثال: A09 أو J06.9)', 400, 'VALIDATION_ERROR');
    }
  }

  const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);
  const values     = [id, ...Object.values(updates)];

  const result = await withUserContext(req.user.id, req.user.roles, async (client) => {
    return client.query(
      `UPDATE diagnoses
          SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *`,
      values
    );
  });

  if (result.rows.length === 0) {
    throw new AppError(
      'التشخيص غير موجود أو ليس لديك صلاحية تعديله',
      404,
      'RESOURCE_NOT_FOUND'
    );
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});

module.exports = { getDiagnosis, updateDiagnosis };
